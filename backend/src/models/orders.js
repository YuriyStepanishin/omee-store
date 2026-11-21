import {validateDelivery} from '../validators/delivery.js';
import {randomUUID} from 'node:crypto';
// The server re-reads prices and locks inventory inside the same transaction.
export async function createOrder(pool,payload,userId=null) {
 const customer=payload?.payment;
 if(!customer || !['fullName','phone','email','city','address'].every(key=>typeof customer[key]==='string'&&customer[key].trim()&&customer[key].length<=(key==='address'?300:120))) throw Object.assign(new Error('Заповніть контактні дані й адресу.'),{status:400});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)||!/^\+?[\d\s()\-]{10,25}$/.test(customer.phone)||customer.phone.replace(/\D/g,'').length<10)throw Object.assign(new Error('Перевірте email і телефон.'),{status:400});
 if(customer.method!=='on_confirmation')throw Object.assign(new Error('Онлайн-оплата ще не підключена.'),{status:400});
 if(!Array.isArray(payload.items)||!payload.items.length||payload.items.length>100)throw Object.assign(new Error('Перевірте кошик.'),{status:400});
 const ids=new Set();
 for(const item of payload.items){if(!item||typeof item.productId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.productId)||!Number.isInteger(item.qty)||item.qty<1||item.qty>99||ids.has(item.productId))throw Object.assign(new Error('Некоректний товар або кількість.'),{status:400});ids.add(item.productId);}
 const delivery=validateDelivery(customer);
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const {rows}=await client.query(`SELECT p.id,card.name,card.is_active,card.category_id,v.volume_value,v.volume_unit,v.id AS variant_id,v.price,v.stock,v.sku,v.is_active AS variant_active FROM products p JOIN product_variants v ON v.source_product_id=p.id JOIN products card ON card.id=v.product_id JOIN categories c ON c.id=card.category_id WHERE p.id=ANY($1::uuid[]) AND c.is_active AND NOT EXISTS (SELECT 1 FROM product_merge_audit a WHERE a.source_product_id=card.id AND a.canonical_product_id<>card.id) ORDER BY p.id FOR UPDATE OF p,v`,[[...ids]]);
  const lines=payload.items.map(item=>{const p=rows.find(row=>row.id===item.productId);if(!p||!p.is_active||!p.variant_active||p.stock<item.qty||!Number.isFinite(Number(p.price))||Number(p.price)<=0)throw Object.assign(new Error('Товар недоступний або недостатньо залишку.'),{status:409});return {...item,price:p.price,cents:Math.round(Number(p.price)*100),variantId:p.variant_id};});
  const totalCents=lines.reduce((sum,line)=>sum+line.cents*line.qty,0);
  const orderId=randomUUID();
  await client.query(`INSERT INTO orders(id,status,total,delivery_method,payment_method,customer_name,customer_phone,customer_email,city,address,user_id) VALUES($1,'NEW',$2,$8,'on_confirmation',$3,$4,$5,$6,$7,$9)`,[orderId,(totalCents/100).toFixed(2),customer.fullName.trim(),customer.phone.trim(),customer.email.trim(),customer.city.trim(),customer.address.trim(),delivery.method,userId]);
  for(const line of lines){const product=rows.find(row=>row.id===line.productId);await client.query('INSERT INTO order_items(order_id,product_id,price,quantity,product_name,product_sku) VALUES($1,$2,$3,$4,$5,$6)',[orderId,line.productId,line.price,line.qty,product.volume_value == null || !product.volume_unit ? product.name : `${product.name} · ${product.volume_value} ${product.volume_unit}`,product.sku]);await client.query('UPDATE product_variants SET stock=stock-$1 WHERE id=$2',[line.qty,line.variantId]);await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2',[line.qty,line.productId]);}
  await client.query('COMMIT');
  return {orderId,status:'NEW',amount:totalCents/100};
 } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
}
