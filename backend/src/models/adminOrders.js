import { orderTransitions } from '../validators/admin.js';
const fail = (message, status = 409) =>
  Object.assign(new Error(message), { status });
const columns = `id,status,total,delivery_method AS "deliveryMethod",payment_method AS "paymentMethod",
  payment_status AS "paymentStatus",tracking_number AS "trackingNumber",comment,customer_name AS "customerName",
  customer_phone AS "customerPhone",customer_email AS "customerEmail",city,address,created_at AS "createdAt",updated_at::text AS "updatedAt"`;
const trackableCarriers = new Set(['nova_poshta', 'ukrposhta', 'meest']);
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
        'SELECT i.product_id AS "productId",COALESCE(i.product_name,p.name) AS name,COALESCE(i.product_sku,p.sku) AS sku,i.price,i.quantity FROM order_items i JOIN products p ON p.id=i.product_id WHERE i.order_id=$1 ORDER BY p.name',
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
            `SELECT status,delivery_method,payment_status,payment_method,tracking_number,comment,city,address,updated_at::text AS "updatedAt"
             FROM orders WHERE id=$1 FOR UPDATE`,
            [id]
          )
        ).rows[0];
        if (!order) throw fail('Замовлення не знайдено.', 404);
        if (
          order.status !== data.expectedStatus ||
          (data.expectedUpdatedAt !== undefined && order.updatedAt !== data.expectedUpdatedAt)
        ) {
          throw fail('Замовлення змінилось. Оновіть картку перед збереженням.');
        }
        const statusChanged = order.status !== data.status;
        if (statusChanged && !orderTransitions[order.status]?.includes(data.status)) {
          throw fail('Такий перехід статусу недоступний.');
        }
        const pickup = order.delivery_method === 'pickup';
        const carrier = order.delivery_method?.split(':')[0];
        const trackable = trackableCarriers.has(carrier);
        const tracking = data.trackingNumber === undefined ? order.tracking_number : data.trackingNumber;
        if (tracking && !trackable) throw fail('Номер відправлення доступний для доставки перевізником.', 400);
        if (statusChanged && ((data.status === 'READY_FOR_PICKUP' && !pickup) || (data.status === 'SHIPPED' && pickup))) {
          throw fail('Цей статус не відповідає способу отримання.');
        }
        if (statusChanged && data.status === 'SHIPPED' && trackable && !tracking && data.trackingNumber !== undefined) {
          throw fail('Вкажіть номер відправлення перед передачею перевізнику.', 400);
        }
        if (order.status === 'CANCELED' || (order.status === 'DELIVERED' && (
          data.paymentStatus === undefined || order.city !== data.city ||
          order.address !== data.address || order.comment !== data.comment ||
          tracking !== order.tracking_number ||
          (data.paymentMethod !== undefined && data.paymentMethod !== order.payment_method)
        ))) {
          throw fail('Після завершення можна змінити лише стан оплати отриманого замовлення.');
        }
        const payment = data.paymentStatus ?? (data.status === 'PAID' && statusChanged ? 'PAID' : null);
        if (data.status === 'CANCELED' && order.status !== 'CANCELED') {
          // Same product lock order as checkout; stock is returned only once.
          await client.query(
            'SELECT id FROM products WHERE id IN (SELECT product_id FROM order_items WHERE order_id=$1) ORDER BY id FOR UPDATE',
            [id]
          );
          await client.query(
            'UPDATE product_variants v SET stock=v.stock+i.quantity FROM order_items i WHERE i.order_id=$1 AND v.source_product_id=i.product_id',
            [id]
          );
          await client.query(
            'UPDATE products p SET stock=p.stock+i.quantity FROM order_items i WHERE i.order_id=$1 AND p.id=i.product_id',
            [id]
          );
        }
        await client.query(
          `UPDATE orders SET status=$2,comment=$3,city=$4,address=$5,
            payment_status=COALESCE($6,payment_status),payment_method=COALESCE($7,payment_method),
            tracking_number=CASE WHEN $8 THEN $9 ELSE tracking_number END WHERE id=$1`,
          [id, data.status, data.comment, data.city, data.address, payment,
            data.paymentMethod ?? null, data.trackingNumber !== undefined, data.trackingNumber ?? null]
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
