import test from 'node:test';
import assert from 'node:assert/strict';
import {IncomingMessage,ServerResponse} from 'node:http';
import {Socket} from 'node:net';
import {createApp} from '../src/app.js';
import {getPool,closePool} from '../src/config/db.js';
import {signSession} from '../src/services/tokens.js';
import {accountRepository} from '../src/models/account.js';
import {createOrder} from '../src/models/orders.js';
const userId='11111111-1111-4111-8111-111111111111';
const productId='22222222-2222-4222-8222-222222222222';
function request(app,url,cookie,method='GET',body) {
  return new Promise((resolve,reject)=>{
    const req=new IncomingMessage(new Socket());req.url=url;req.method=method;req.headers=cookie?{cookie}:{};if(body){const data=JSON.stringify(body);req.headers['content-type']='application/json';req.headers['content-length']=Buffer.byteLength(data);req.push(data);}req.push(null);
    const res=new ServerResponse(req);
    res.end=function(data){this.finished=true;this.emit('finish');resolve({status:this.statusCode,body:data?JSON.parse(data.toString()):null});return this;};
    app.handle(req,res,reject);
  });
}
test('account endpoints require a session and scope reads and writes to its user, ignoring injected user IDs',async()=>{
  const config={mode:'postgres',databaseUrl:'postgres://localhost/account-test',origins:[],accessSecret:'a'.repeat(48),refreshSecret:'b'.repeat(48)};
  const pool=getPool(config.databaseUrl);
  const calls=[];
  pool.query=async(sql,args)=>{calls.push({sql,args});return sql.includes('FROM users WHERE id')?{rows:[{id:userId,role:'CUSTOMER'}]}:{rows:[],rowCount:1};};
  try {
    const app=createApp(config);
    const cookie='kss_access='+signSession({id:userId},config).access;
    for(const [path,method] of [['orders','GET'],['cart','GET'],['favorites','GET'],['favorites/ids','GET'],['favorites/'+productId,'PUT'],['favorites/'+productId,'DELETE']]){
      assert.equal((await request(app,'/api/account/'+path,undefined,method)).status,401);
      calls.length=0;
      assert.ok([200,204].includes((await request(app,'/api/account/'+path+'?userId=someone-else',cookie,method)).status));
      const query=calls.find(call=>!call.sql.includes('FROM users WHERE id'));
      assert.equal(query.args[0],userId);
      assert.ok(!query.sql.includes('someone-else'));
      assert.ok(/user_id/.test(query.sql));
    }
    calls.length=0;
    assert.equal((await request(app,'/api/account/favorites/bad-id',cookie,'PUT')).status,400);
    assert.equal((await request(app,'/api/account/orders?page=-1',cookie)).status,400);
    assert.equal((await request(app,'/api/account/cart',cookie,'PUT',{expectedUserId:productId,items:[]})).status,409);
    assert.equal((await request(app,'/api/account/cart',cookie,'PUT',{expectedUserId:userId,items:[{productId,qty:100}]})).status,400);
    assert.equal((await request(app,'/api/account/cart',undefined,'PUT',{expectedUserId:userId,items:[]})).status,401);
    assert.ok(!calls.some(call=>call.sql.startsWith('INSERT')));
  } finally {await closePool();}
});
test('wishlist insert is idempotent, rejects unpublished products and removal is owner-scoped',async()=>{
  const calls=[];let rowCount=1;
  const repo=accountRepository({query:async(sql,args)=>{calls.push({sql,args});return {rows:[],rowCount};}});
  await repo.addFavorite(userId,productId);
  assert.ok(calls[0].sql.includes('ON CONFLICT(user_id,product_id)'));
  assert.ok(calls[0].sql.includes('p.is_active AND c.is_active'));
  rowCount=0;
  await assert.rejects(()=>repo.addFavorite(userId,productId),{status:404});
  await repo.removeFavorite(userId,productId);
  assert.ok(calls.at(-1).sql.includes('user_id=$1 AND product_id=$2'));
  assert.deepEqual(calls.at(-1).args,[userId,productId]);
});
test('checkout saves trusted account ownership and immutable product names with the order',async()=>{
  const calls=[];
  const client={query:async(sql,args)=>{calls.push({sql,args});return {rows:sql.includes('JOIN product_variants v')?[{id:productId,name:'Збережена назва',sku:'SKU-1',price:'100.00',stock:5,is_active:true,variant_active:true,variant_id:'33333333-3333-4333-8333-333333333333'}]:[]};},release(){}};
  const payload={items:[{productId,qty:1}],userId:'attacker',payment:{fullName:'Тест Покупець',phone:'+380961234567',email:'test@example.com',city:'Хмельницький',address:'Відділення 1',method:'on_confirmation',deliveryCarrier:'nova_poshta',deliveryType:'branch'}};
  await createOrder({connect:async()=>client},payload,userId);
  assert.equal(calls.find(call=>call.sql.startsWith('INSERT INTO orders')).args[8],userId);
  assert.deepEqual(calls.find(call=>call.sql.startsWith('INSERT INTO order_items')).args.slice(4),['Збережена назва','SKU-1']);
  calls.length=0;
  await createOrder({connect:async()=>client},payload);
  assert.equal(calls.find(call=>call.sql.startsWith('INSERT INTO orders')).args[8],null);
});
