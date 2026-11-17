import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {validateOrder} from '../src/validators/order.js';
import {saveDemoOrder} from '../src/services/fileOrderStore.js';
import {readEnv} from '../src/config/env.js';
import {createOrder} from '../src/models/orders.js';
const payload=()=>({items:[{productId:'p-1',qty:2,price:1}],payment:{fullName:'Тест Клієнт',phone:'+380971234567',email:'test@example.com',city:'Хмельницький',address:'Відділення 1',method:'on_confirmation'}});
test('demo order uses trusted prices and rejects invalid quantities',()=>{
 assert.equal(validateOrder(payload()).amount,1440);
 for(const qty of [0,-1,1.5,100,'2']){const p=payload();p.items[0].qty=qty;assert.throws(()=>validateOrder(p));}
 const p=payload();p.items.push(p.items[0]);assert.throws(()=>validateOrder(p));
});
test('demo order is persisted with customer data and NEW status',async()=>{
 const dir=await mkdtemp(new URL('./test-tmp-',import.meta.url));
 try{const order=validateOrder(payload());await saveDemoOrder(order,dir);const saved=JSON.parse(await readFile(join(dir,order.orderId+'.json'),'utf8'));assert.equal(saved.amount,1440);assert.equal(saved.status,'NEW');assert.equal(saved.customer.city,'Хмельницький');}
 finally{await rm(dir,{recursive:true,force:true});}
});
test('production cannot silently use demo orders or a missing database',()=>{
 assert.throws(()=>readEnv({NODE_ENV:'production'}));
 assert.throws(()=>readEnv({STORE_MODE:'postgres'}));
 assert.throws(()=>readEnv({PORT:'abc'}));
 assert.equal(readEnv({STORE_MODE:'postgres',DATABASE_URL:'postgres://localhost/store',JWT_ACCESS_SECRET:'a'.repeat(48),JWT_REFRESH_SECRET:'b'.repeat(48)}).mode,'postgres');
});
test('PostgreSQL order locks stock, ignores client price and rolls back shortages',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const p=payload();p.items[0].productId=id;
 let stock=5;let calls=[];let released=false;
 const client={async query(sql,args){calls.push({sql,args});if(sql.includes('JOIN product_variants v'))return {rows:[{id,price:'720.00',stock,is_active:true,variant_active:true,variant_id:'33333333-3333-4333-8333-333333333333'}]};return {rows:[]};},release(){released=true;}};
 const pool={async connect(){return client;}};
 const order=await createOrder(pool,p);
 assert.equal(order.amount,1440);assert.equal(order.status,'NEW');assert.ok(calls.some(c=>c.sql.includes('FOR UPDATE')));assert.equal(calls.find(c=>c.sql.startsWith('INSERT INTO orders')).args[1],'1440.00');assert.equal(calls.at(-1).sql,'COMMIT');assert.ok(released);
 calls=[];released=false;stock=1;
 await assert.rejects(()=>createOrder(pool,p),{status:409});
 assert.equal(calls.at(-1).sql,'ROLLBACK');assert.ok(!calls.some(c=>c.sql.startsWith('INSERT')));assert.ok(released);
});
