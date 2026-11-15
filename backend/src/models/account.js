export function accountRepository(pool) {
  return {
    async orders(userId,page) {
      const {rows} = await pool.query(`SELECT o.id,o.status,o.total,o.created_at AS "createdAt",o.delivery_method AS "deliveryMethod",o.city,o.address,
        COALESCE((SELECT json_agg(json_build_object('name',COALESCE(i.product_name,p.name),'sku',COALESCE(i.product_sku,p.sku),'quantity',i.quantity,'price',i.price) ORDER BY i.id) FROM order_items i JOIN products p ON p.id=i.product_id WHERE i.order_id=o.id),'[]'::json) AS items
        FROM orders o WHERE o.user_id=$1 ORDER BY o.created_at DESC,o.id DESC LIMIT 20 OFFSET $2`,[userId,(page-1)*20]);
      return {items:rows,page,limit:20};
    },
    async favoriteIds(userId) {
      const {rows}=await pool.query('SELECT product_id FROM favorites WHERE user_id=$1 ORDER BY id',[userId]);
      return {ids:rows.map(row=>row.product_id)};
    },
    async favorites(userId,page) {
      const {rows}=await pool.query(`SELECT p.id,p.name AS title,p.sku,c.name AS category,p.price,p.old_price AS "oldPrice",p.stock,p.description,(p.is_active AND c.is_active) AS "isPublished",
        COALESCE((SELECT image_url FROM product_images WHERE product_id=p.id ORDER BY (image_url LIKE 'https://res.cloudinary.com/%') DESC,sort_order,id LIMIT 1),'') AS image
        FROM favorites f JOIN products p ON p.id=f.product_id JOIN categories c ON c.id=p.category_id WHERE f.user_id=$1 ORDER BY f.created_at DESC,f.id LIMIT 20 OFFSET $2`,[userId,(page-1)*20]);
      return {items:rows.map(row=>({...row,price:Number(row.price),oldPrice:row.oldPrice===null?null:Number(row.oldPrice)})),page,limit:20};
    },
    async addFavorite(userId,productId) {
      const {rowCount}=await pool.query('INSERT INTO favorites(user_id,product_id) SELECT $1,p.id FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=$2 AND p.is_active AND c.is_active ON CONFLICT(user_id,product_id) DO UPDATE SET product_id=EXCLUDED.product_id RETURNING id',[userId,productId]);
      if(!rowCount)throw Object.assign(new Error('Товар недоступний.'),{status:404});
    },
    async removeFavorite(userId,productId) {
      await pool.query('DELETE FROM favorites WHERE user_id=$1 AND product_id=$2',[userId,productId]);
    },
  };
}
