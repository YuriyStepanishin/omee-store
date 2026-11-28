import test from 'node:test';
import assert from 'node:assert/strict';
import {IncomingMessage,ServerResponse} from 'node:http';
import {Socket} from 'node:net';
import {createApp} from '../src/app.js';
import {getPool,closePool} from '../src/config/db.js';
import {signSession} from '../src/services/tokens.js';
import {validate,productSchema,categorySchema} from '../src/validators/catalog.js';
import {bannerSchema} from '../src/validators/content.js';
import {detectImage,detectVideo,uploadImage} from '../src/services/upload.js';
import {catalogRepository} from '../src/models/catalogAdmin.js';
import {configureCloudinary} from '../src/config/cloudinary.js';
const id='11111111-1111-4111-8111-111111111111';
const product={categoryId:id,name:'Шампунь',slug:'shampoo',description:'Догляд',price:720,oldPrice:800,stock:5,sku:'KM-1',isActive:true,images:['https://example.com/photo.jpg'],characteristics:{'Об’єм':'250 мл'}};
test('catalog validation rejects bad prices, quantities and unsafe links',()=>{
 assert.equal(validate(productSchema,product).price,720);
 assert.equal(validate(productSchema,{...product,isActive:undefined}).isActive,false);
 assert.deepEqual(validate(productSchema,{...product,price:2000,oldPrice:null,isActive:true}).isActive,true);
 assert.equal(validate(productSchema,{...product,price:2000,oldPrice:null,isActive:true}).price,2000);
 for(const values of [{price:-1},{price:1.234},{stock:1.5},{oldPrice:100},{images:['javascript:alert(1)']}])assert.throws(()=>validate(productSchema,{...product,...values}),{status:400});
 assert.throws(()=>validate(categorySchema,{name:'Маски',slug:'unsafe slug',isActive:true}),{status:400});
 assert.throws(()=>validate(bannerSchema,{title:'Акція',imageUrl:'https://example.com/a.jpg',link:'javascript:alert(1)',isActive:true}),{status:400});
 assert.throws(()=>validate(bannerSchema,{title:'Акція',imageUrl:'https://example.com/a.jpg',link:'//other.example',isActive:true}),{status:400});
});
test('file validation checks content instead of trusting filename or MIME type',()=>{
 assert.equal(detectImage(Buffer.from([137,80,78,71,13,10,26,10])),'png');
 assert.equal(detectImage(Buffer.from('<svg onload=alert(1)>')),null);
 assert.ok(detectVideo(Buffer.from([26,69,223,163])));
 assert.throws(()=>uploadImage({buffer:Buffer.from('<html>')},{}),{status:400});
 assert.throws(()=>uploadImage({buffer:Buffer.from([255,216,255])},{}),{status:503});
});
test('product and image replacement are one transaction; image failure rolls back',async()=>{
 let fail=false;let calls=[];let released=false;
 const client={async query(sql,args){calls.push({sql,args});if(fail&&sql.startsWith('INSERT INTO product_images'))throw Error('test image failure');return {rows:[{id}]};},release(){released=true;}};
 const repo=catalogRepository({connect:async()=>client});
 await repo.saveProduct(product,id);assert.equal(calls.at(-1).sql,'COMMIT');assert.ok(calls.some(c=>c.sql.startsWith('DELETE FROM product_images')));const saved=calls.find(c=>c.sql.startsWith('UPDATE products SET category_id'));assert.equal(saved.args[4],720);assert.equal(saved.args[8],true);assert.ok(released);
 calls=[];await repo.saveProduct({...product,price:2000,oldPrice:null},id);const confirmedPrice=calls.find(c=>c.sql.startsWith('UPDATE products SET category_id'));assert.equal(confirmedPrice.args[4],2000);assert.equal(confirmedPrice.args[8],true);
 fail=true;calls=[];released=false;await assert.rejects(()=>repo.saveProduct(product,id));assert.equal(calls.at(-1).sql,'ROLLBACK');assert.ok(released);
});
function request(app,url,cookie,method='GET',body){return new Promise((resolve,reject)=>{const req=new IncomingMessage(new Socket());req.method=method;req.url=url;req.headers={...(cookie?{cookie}:{}),...(body?{'content-type':'application/json','content-length':Buffer.byteLength(JSON.stringify(body))}:{})};if(body)req.push(JSON.stringify(body));req.push(null);const res=new ServerResponse(req);res.end=function(responseBody){this.finished=true;this.emit('finish');resolve({status:this.statusCode,body:responseBody?JSON.parse(responseBody.toString()):null});return this;};app.handle(req,res,reject);});}
test('editing an imported product preserves oversized existing fields and skips verification for saved photos',async()=>{
 const config={mode:'postgres',databaseUrl:'postgres://localhost/catalog-edit-test',origins:[],accessSecret:'a'.repeat(48),refreshSecret:'b'.repeat(48)};
 const pool=getPool(config.databaseUrl);
 const images=Array.from({length:9},(_,i)=>`https://res.cloudinary.com/legacy/image/upload/v1/imported-${i}.jpg`);
 const value='а'.repeat(501);
 const sourceData={characteristics:{Description:value}};
 const current={id,images,price:720,oldPrice:null,characteristics:{sourceData}};
 let saved;
 pool.query=async sql=>({rows:sql.includes('FROM users')?[{id,role:'ADMIN'}]:[current]});
 pool.connect=async()=>({async query(sql,values){
  if(sql.startsWith('UPDATE products SET category_id'))saved=values;
  return {rows:[{id,characteristics:{sourceData}}]};
 },release(){}});
 try{
  const cookie='kss_access='+signSession({id},config).access;
  const app=createApp(config);
  const edited={...product,name:'Нова назва',images,characteristics:{Description:value}};
  const url='/api/products/'+id;
  assert.equal((await request(app,url,cookie,'PUT',edited)).status,200);
  assert.equal(saved[1],'Нова назва');
  assert.deepEqual(JSON.parse(saved[9]),{sourceData,Description:value,sourceFieldsOverridden:true});
  assert.equal((await request(app,url,cookie,'PUT',{...edited,characteristics:{Description:value+'а'}})).status,400);
  assert.equal((await request(app,url,cookie,'PUT',{...edited,images:[...images.slice(1),'https://example.com/new.jpg']})).status,400);
  assert.equal((await request(app,url,cookie,'PUT',{...edited,characteristics:{}})).status,200);
  assert.equal(Object.hasOwn(JSON.parse(saved[9]),'Description'),false);
 }finally{await closePool();}
});
test('Express rejects guests and customers on admin routes, even with direct URL access',async()=>{
 const config={mode:'postgres',databaseUrl:'postgres://localhost/test',origins:[],accessSecret:'a'.repeat(48),refreshSecret:'b'.repeat(48)};
 const pool=getPool(config.databaseUrl);let role='CUSTOMER';pool.query=async sql=>({rows:sql.includes('FROM users')?[{id,name:'Тест',email:'test@example.com',role}]:[]});
 const originalCloudinaryEnv=Object.fromEntries(['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'].map(key=>[key,process.env[key]]));
 try{const app=createApp(config);assert.equal((await request(app,'/api/admin/categories')).status,401);assert.equal((await request(app,'/api/admin/catalog')).status,401);assert.equal((await request(app,'/api/admin/products/classify',undefined,'POST')).status,401);assert.equal((await request(app,'/api/admin/uploads/sign',undefined,'POST',{kind:'image',size:1024})).status,401);assert.equal((await request(app,'/api/admin/uploads/verify',undefined,'POST',{kind:'image'})).status,401);assert.equal((await request(app,'/api/products/'+id+'/line',undefined,'PUT')).status,401);assert.equal((await request(app,'/api/admin/products/'+id,undefined,'DELETE')).status,401);for(const removed of ['publish','test-stock','prepare'])assert.equal((await request(app,'/api/admin/products/'+removed,undefined,'POST')).status,404);const token=signSession({id},config).access;assert.equal((await request(app,'/api/admin/categories','kss_access='+token)).status,403);assert.equal((await request(app,'/api/admin/content','kss_access='+token)).status,403);assert.equal((await request(app,'/api/admin/catalog','kss_access='+token)).status,403);assert.equal((await request(app,'/api/admin/uploads/sign','kss_access='+token,'POST',{kind:'image',size:1024})).status,403);assert.equal((await request(app,'/api/admin/uploads/verify','kss_access='+token,'POST',{kind:'image'})).status,403);assert.equal((await request(app,'/api/products/'+id+'/line','kss_access='+token,'PUT')).status,403);assert.equal((await request(app,'/api/admin/products/'+id,'kss_access='+token,'DELETE')).status,403);for(const removed of ['publish','test-stock','prepare'])assert.equal((await request(app,'/api/admin/products/'+removed,'kss_access='+token,'POST')).status,404);assert.equal((await request(app,'/api/admin/products/classify','kss_access='+token,'POST')).status,403);role='ADMIN';process.env.CLOUDINARY_CLOUD_NAME='test-cloud';process.env.CLOUDINARY_API_KEY='test-api-key';process.env.CLOUDINARY_API_SECRET='test-api-secret';assert.equal((await request(app,'/api/admin/categories','kss_access='+token)).status,200);const signed=await request(app,'/api/admin/uploads/sign','kss_access='+token,'POST',{kind:'image',size:1024});assert.equal(signed.status,200);assert.equal(signed.body.upload_preset,'omee_signed_images');assert.equal(signed.body.folder,'omee/images');assert.equal(JSON.stringify(signed.body).includes('test-api-secret'),false);}finally{for(const [key,value] of Object.entries(originalCloudinaryEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await closePool();}
});
test('ADMIN can save an existing Cloudinary image URL after resource verification',async()=>{
 const config={mode:'postgres',databaseUrl:'postgres://localhost/cloudinary-save-test',origins:[],accessSecret:'a'.repeat(48),refreshSecret:'b'.repeat(48)};
 const pool=getPool(config.databaseUrl);
 const previousEnv=Object.fromEntries(['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'].map(key=>[key,process.env[key]]));
 const secureUrl='https://res.cloudinary.com/test-cloud/image/upload/v123/kateryna-studio/images/old-category.jpg';
 let savedValues;
 let cloudinary;
 let originalResource;
 try{
  process.env.CLOUDINARY_CLOUD_NAME='test-cloud';
  process.env.CLOUDINARY_API_KEY='test-api-key';
  process.env.CLOUDINARY_API_SECRET='test-api-secret';
  pool.query=async(sql,values)=>{
   if(sql.includes('FROM users'))return {rows:[{id,name:'Admin',email:'admin@example.com',role:'ADMIN'}]};
   if(sql.startsWith('INSERT INTO categories')){savedValues=values;return {rows:[{id}]};}
   if(sql.startsWith('SELECT id,name,slug,image'))return {rows:[]};
   return {rows:[]};
  };
  cloudinary=configureCloudinary(process.env);
  originalResource=cloudinary.api.resource;
  cloudinary.api.resource=async publicId=>({
   public_id:publicId,
   version:123,
   resource_type:'image',
   format:'jpg',
   secure_url:secureUrl,
  });
  const token=signSession({id},config).access;
  const result=await request(createApp(config),'/api/categories','kss_access='+token,'POST',{
   name:'Стара категорія',
   slug:'stara-kategoriya',
   image:secureUrl,
   isActive:true,
  });
  assert.equal(result.status,201);
  assert.deepEqual(savedValues,['Стара категорія','stara-kategoriya',secureUrl,true]);
 }finally{
  if(cloudinary&&originalResource)cloudinary.api.resource=originalResource;
  for(const [key,value] of Object.entries(previousEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  await closePool();
 }
});
