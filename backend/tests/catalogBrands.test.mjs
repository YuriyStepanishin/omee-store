import test from 'node:test';
import assert from 'node:assert/strict';
import {IncomingMessage,ServerResponse} from 'node:http';
import {Socket} from 'node:net';
import {catalogDictionaries} from '../src/models/catalogDictionaries.js';
import {catalogRepository} from '../src/models/catalogAdmin.js';
import {catalogDetails} from '../src/models/catalogDetails.js';
import {createApp} from '../src/app.js';
import {getPool,closePool} from '../src/config/db.js';
import {signSession} from '../src/services/tokens.js';
const productId='11111111-1111-4111-8111-111111111111';
const categoryId='22222222-2222-4222-8222-222222222222';
const brandId='33333333-3333-4333-8333-333333333333';

test('brands use their own table and category edits cannot target legacy brand entries',async()=>{
 const calls=[];const repo=catalogDictionaries({async query(sql,args){calls.push({sql,args});return {rows:[{id:brandId}],rowCount:1};}});
 await repo.list('brands');assert.match(calls.at(-1).sql,/FROM brands/);
 await repo.list('categories');assert.match(calls.at(-1).sql,/FROM categories WHERE NOT.*import-%/);
 await repo.save('brands',{name:'Davroe',slug:'davroe',image:'',isActive:true},brandId);assert.match(calls.at(-1).sql,/UPDATE brands/);assert.equal(calls.at(-1).args[1],'davroe');
 await repo.archive('categories',brandId);assert.match(calls.at(-1).sql,/AND NOT.*import-%/);
 await assert.rejects(repo.save('categories',{slug:'import-test'}),{status:400});
 await assert.rejects(catalogDictionaries({query:async()=>({rows:[],rowCount:0})}).save('categories',{name:'Шампуні',slug:'shampuni',isActive:true},brandId),{status:404});
});

test('product edits persist separate brand and category IDs while preserving imported metadata',async()=>{
 const calls=[];const sourceData={brand:'Old brand',description:'Original source'};
 const client={async query(sql,args){calls.push({sql,args});if(sql.startsWith('SELECT id,name,slug FROM categories'))return {rows:[{id:categoryId,name:'Шампуні',slug:'shampuni'}]};if(sql.startsWith('SELECT characteristics'))return {rows:[{brand_id:brandId,characteristics:{sourceData,sourceGroups:['Шампуні'],sourceUrl:'https://example.com/a',pH:'4'}}]};if(sql.startsWith('SELECT id,name FROM brands'))return {rows:[{id:brandId,name:'Davroe'}]};return {rows:[{id:productId}],rowCount:1};},release(){}};
 await catalogRepository({connect:async()=>client}).saveProduct({categoryId,brandId,name:'Шампунь',slug:'shampoo',description:'Опис',price:100,oldPrice:null,stock:2,sku:'A1',isActive:false,images:[],characteristics:{pH:'5',brand:'untrusted'}},productId);
 const saved=calls.find(call=>call.sql.startsWith('UPDATE products SET category_id'));
 assert.equal(saved.args[0],categoryId);assert.equal(saved.args[10],brandId);
 const metadata=JSON.parse(saved.args[9]);assert.equal(metadata.brand,'Davroe');assert.equal(metadata.group,'Шампуні');assert.deepEqual(metadata.sourceData,sourceData);assert.equal(metadata.pH,'5');assert.equal(metadata.sourceUrl,'https://example.com/a');
 assert.equal(calls.at(-1).sql,'COMMIT');
 assert.equal(catalogDetails({brandName:'Renamed brand',characteristics:metadata}).brand,'Renamed brand');
});

test('a legacy brand cannot be saved as a category and invalid brand rolls back before product writes',async()=>{
 for(const badCategory of [true,false]){
  const calls=[];const client={async query(sql){calls.push(sql);if(sql.startsWith('SELECT id,name,slug'))return {rows:[{id:categoryId,name:'Category',slug:badCategory?'import-old':'shampuni'}]};if(sql.startsWith('SELECT characteristics'))return {rows:[{characteristics:{}}]};return {rows:[]};},release(){}};
  await assert.rejects(catalogRepository({connect:async()=>client}).saveProduct({categoryId,brandId,characteristics:{}},productId),{status:400});
  assert.equal(calls.at(-1),'ROLLBACK');assert.ok(!calls.some(sql=>sql.startsWith('UPDATE products')));
 }
});

function request(app,url,cookie,method='GET',body){
 return new Promise((resolve,reject)=>{const req=new IncomingMessage(new Socket());req.url=url;req.method=method;req.headers=cookie?{cookie}:{};if(body){const data=JSON.stringify(body);req.headers['content-type']='application/json';req.headers['content-length']=Buffer.byteLength(data);req.push(data);}req.push(null);const res=new ServerResponse(req);res.end=function(data){this.finished=true;this.emit('finish');resolve({status:this.statusCode,body:data?JSON.parse(data.toString()):null});return this;};app.handle(req,res,reject);});
}
test('brand API protects all CRUD operations and validates IDs and payloads',async()=>{
 const config={mode:'postgres',databaseUrl:'postgres://localhost/brands-test',origins:[],accessSecret:'a'.repeat(48),refreshSecret:'b'.repeat(48)};
 const pool=getPool(config.databaseUrl);let role='CUSTOMER';const queries=[];
 pool.query=async(sql,args)=>{queries.push({sql,args});return sql.includes('FROM users')?{rows:[{id:productId,role}]}:{rows:[{id:brandId,name:'Davroe'}],rowCount:1};};
 const app=createApp(config);const cookie='kss_access='+signSession({id:productId},config).access;
 try{
  for(const [method,path,body] of [['GET','/api/admin/brands'],['POST','/api/admin/brands',{}],['PUT','/api/admin/brands/'+brandId,{}],['DELETE','/api/admin/brands/'+brandId]]){
   assert.equal((await request(app,path,undefined,method,body)).status,401);
   assert.equal((await request(app,path,cookie,method,body)).status,403);
  }
  role='ADMIN';assert.equal((await request(app,'/api/admin/brands',cookie)).status,200);
  assert.equal((await request(app,'/api/admin/brands',cookie,'POST',{name:'Davroe',slug:'davroe',image:'',isActive:true})).status,201);
  assert.equal((await request(app,'/api/admin/brands/not-a-uuid',cookie,'DELETE')).status,400);
  assert.equal((await request(app,'/api/admin/brands',cookie,'POST',{name:'X',slug:'x'})).status,400);
  assert.ok(queries.some(query=>query.sql.startsWith('INSERT INTO brands')));
 }finally{await closePool();}
});
