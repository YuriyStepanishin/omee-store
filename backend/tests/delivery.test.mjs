import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDelivery} from '../src/validators/delivery.js';
import {createOrder} from '../src/models/orders.js';
import {validateOrder} from '../src/validators/order.js';
test('delivery accepts the three carriers and both receipt types, preserving old clients',()=>{
 for(const carrier of ['nova_poshta','ukrposhta','meest'])for(const type of ['branch','courier'])assert.deepEqual(validateDelivery({deliveryCarrier:carrier,deliveryType:type}),{method:carrier+':'+type,carrier,type});
 assert.equal(validateDelivery({}).method,'to_be_confirmed');
});
test('pickup is accepted only as a complete selection and is stored as pickup',()=>{
 assert.deepEqual(validateDelivery({deliveryCarrier:'pickup',deliveryType:'pickup'}),{method:'pickup',carrier:'pickup',type:'pickup'});
 for(const values of [{deliveryCarrier:'pickup',deliveryType:'branch'},{deliveryCarrier:'nova_poshta',deliveryType:'pickup'},{deliveryCarrier:'pickup'}])assert.throws(()=>validateDelivery(values),{status:400});
});
test('unknown or incomplete delivery selections are rejected',()=>{
 for(const values of [{deliveryCarrier:'other',deliveryType:'branch'},{deliveryCarrier:'meest'},{deliveryType:'courier'},{deliveryCarrier:null,deliveryType:null}])assert.throws(()=>validateDelivery(values),{status:400});
});
test('selected carrier is saved in PostgreSQL delivery_method and demo-order delivery',async()=>{
 const payment={fullName:'Тест Клієнт',phone:'+380971234567',email:'test@example.com',city:'Хмельницький',address:'29000, відділення №1',method:'on_confirmation',deliveryCarrier:'ukrposhta',deliveryType:'branch'};
 const id='11111111-1111-4111-8111-111111111111';const calls=[];
 const client={async query(sql,args){calls.push({sql,args});return {rows:sql.includes('JOIN product_variants v')?[{id,price:2000,stock:10,is_active:true,variant_active:true,variant_id:'33333333-3333-4333-8333-333333333333'}]:[]};},release(){}};
 await createOrder({connect:async()=>client},{items:[{productId:id,qty:1}],payment});
 const insert=calls.find(c=>c.sql.startsWith('INSERT INTO orders'));assert.equal(insert.args[7],'ukrposhta:branch');assert.equal(insert.args[6],payment.address);
 assert.deepEqual(insert.args.slice(9), [null, null]);
 assert.deepEqual(validateOrder({items:[{productId:'p-1',qty:1}],payment}).delivery,{method:'ukrposhta:branch',carrier:'ukrposhta',type:'branch'});
});
test('Nova Poshta checkout preserves exact branch and locker references and their display address', async () => {
 const deliveryCityRef = '11111111-1111-4111-8111-111111111111';
 const deliveryPointRef = '22222222-2222-4222-8222-222222222222';
 const productId = '33333333-3333-4333-8333-333333333333';
 const calls = [];
 const client = {
  async query(sql, args) {
   calls.push({sql, args});
   return {rows: sql.includes('JOIN product_variants v') ? [{
    id:productId, price:100, stock:5, is_active:true, variant_active:true, variant_id:productId,
   }] : []};
  },
  release() {},
 };
 for (const [deliveryType, address] of [['branch', 'Відділення №101'], ['locker', 'Поштомат №202']]) {
  const payment = {
   fullName:'Тест Клієнт', phone:'+380971234567', email:'test@example.com',
   city:'Хмельницький', address, method:'on_confirmation',
   deliveryCarrier:'nova_poshta', deliveryType, deliveryCityRef, deliveryPointRef,
  };
  await createOrder({connect:async()=>client}, {items:[{productId, qty:1}], payment});
  const insert = calls.findLast(({sql}) => sql.startsWith('INSERT INTO orders'));
  assert.match(insert.sql, /delivery_city_ref,delivery_point_ref/);
  assert.deepEqual(insert.args.slice(5, 8), [payment.city, address, `nova_poshta:${deliveryType}`]);
  assert.deepEqual(insert.args.slice(9), [deliveryCityRef, deliveryPointRef]);
  assert.deepEqual(validateOrder({items:[{productId:'p-1', qty:1}], payment}).delivery, {
   method:`nova_poshta:${deliveryType}`, carrier:'nova_poshta', type:deliveryType,
   cityRef:deliveryCityRef, pointRef:deliveryPointRef,
  });
  assert.throws(() => validateDelivery({...payment, deliveryPointRef:undefined}), {status:400});
  assert.throws(() => validateDelivery({...payment, deliveryType:'courier'}), {status:400});
 }
});
test('products without a confirmed positive price cannot be ordered',async()=>{
 const payment={fullName:'Тест Клієнт',phone:'+380971234567',email:'test@example.com',city:'Хмельницький',address:'Відділення №1',method:'on_confirmation'};
 const id='11111111-1111-4111-8111-111111111111';const calls=[];
 const client={async query(sql){calls.push(sql);return {rows:sql.includes('JOIN product_variants v')?[{id,price:'0.00',stock:10,is_active:true,variant_active:true,variant_id:'33333333-3333-4333-8333-333333333333'}]:[]};},release(){}};
 await assert.rejects(()=>createOrder({connect:async()=>client},{items:[{productId:id,qty:1}],payment}),{status:409});
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.ok(!calls.some(sql=>sql.startsWith('INSERT INTO orders')));
});
