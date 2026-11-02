import { orderTransitions } from '../validators/admin.js';
const fail = (message, status = 409) =>
  Object.assign(new Error(message), { status });
const columns = `id,status,total,delivery_method AS "deliveryMethod",payment_method AS "paymentMethod",comment,customer_name AS "customerName",customer_phone AS "customerPhone",customer_email AS "customerEmail",city,address,created_at AS "createdAt"`;
export function adminOrders(pool) {
  return {
    async list({ page, status }) {
      const values = [status || null];
      const total = Number(
        (
          await pool.query(
            'SELECT count(*) FROM orders WHERE ($1::text IS NULL OR status=$1)',
            values
          )
        ).rows[0].count
      );
      const { rows } = await pool.query(
        `SELECT ${columns} FROM orders WHERE ($1::text IS NULL OR status=$1) ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET $2`,
        [...values, (page - 1) * 20]
      );
      return { items: rows, total, page, limit: 20 };
    },
    async detail(id) {
      const order = (
        await pool.query(`SELECT ${columns} FROM orders WHERE id=$1`, [id])
      ).rows[0];
      if (!order) throw fail('Замовлення не знайдено.', 404);
      const { rows } = await pool.query(
        'SELECT i.product_id AS "productId",p.name,p.sku,i.price,i.quantity FROM order_items i JOIN products p ON p.id=i.product_id WHERE i.order_id=$1 ORDER BY p.name',
        [id]
      );
      return { ...order, items: rows };
    },
    async update(id, data) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const order = (
          await client.query(
            'SELECT status FROM orders WHERE id=$1 FOR UPDATE',
            [id]
          )
        ).rows[0];
        if (!order) throw fail('Замовлення не знайдено.', 404);
        if (order.status !== data.expectedStatus)
          throw fail('Статус уже змінився. Оновіть замовлення.');
        if (
          order.status !== data.status &&
          !orderTransitions[order.status]?.includes(data.status)
        )
          throw fail('Такий перехід статусу недоступний.');
        if (['DELIVERED', 'CANCELED'].includes(order.status))
          throw fail('Завершене замовлення недоступне для редагування.');
        if (data.status === 'CANCELED' && order.status !== 'CANCELED') {
          // Same product lock order as checkout; stock is returned only once.
          await client.query(
            'SELECT id FROM products WHERE id IN (SELECT product_id FROM order_items WHERE order_id=$1) ORDER BY id FOR UPDATE',
            [id]
          );
          await client.query(
            'UPDATE products p SET stock=p.stock+i.quantity FROM order_items i WHERE i.order_id=$1 AND p.id=i.product_id',
            [id]
          );
        }
        await client.query(
          'UPDATE orders SET status=$2,comment=$3,city=$4,address=$5 WHERE id=$1',
          [id, data.status, data.comment, data.city, data.address]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
