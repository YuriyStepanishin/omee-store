export function cartRepository(pool) {
  const read=async(client,userId)=>(await client.query('SELECT product_id AS "productId",quantity AS qty FROM cart_items WHERE user_id=$1 ORDER BY product_id',[userId])).rows;
  return {
    async get(userId){return {items:await read(pool,userId)};},
    async save(userId,items,merge=false){
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
        if(!merge)await client.query('DELETE FROM cart_items WHERE user_id=$1',[userId]);
        for(const item of items)await client.query(`INSERT INTO cart_items(user_id,product_id,quantity)
          SELECT $1,id,$3 FROM products WHERE id=$2
          ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=${merge?'GREATEST(cart_items.quantity,EXCLUDED.quantity)':'EXCLUDED.quantity'},updated_at=now()`,[userId,item.productId,item.qty]);
        const result=await read(client,userId);
        if(result.length>100)throw Object.assign(new Error('У кошику може бути щонайбільше 100 різних товарів.'),{status:400});
        await client.query('COMMIT');
        return {items:result};
      } catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    },
  };
}
