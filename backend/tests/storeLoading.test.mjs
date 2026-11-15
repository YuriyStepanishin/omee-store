import test from 'node:test';
import assert from 'node:assert/strict';
import {getPool,closePool,secureConnectionString} from '../src/config/db.js';
import {storeController} from '../src/controllers/store.js';

test('store info does not fetch products; catalog starts independent reads together',async()=>{
 const url='postgres://localhost/store-loading-test';
 const pool=getPool(url);const calls=[];let release;
 const gate=new Promise(resolve=>{release=resolve;});
 pool.query=async sql=>{calls.push(sql);await gate;return {rows:[]};};
 const controller=storeController({mode:'postgres',databaseUrl:url});
 let result;
 const pending=controller.catalog({}, {json(value){result=value;}});
 assert.equal(calls.length,6);
 release();await pending;
 assert.deepEqual(result.products,[]);assert.equal(result.preview,undefined);
 calls.length=0;
 await controller.info({}, {json(value){result=value;}});
 assert.equal(calls.length,1);assert.match(calls[0],/site_settings/);
 assert.equal(result.products,undefined);
 await closePool();
});

test('SSL aliases preserve full certificate checks without changing explicit libpq settings',()=>{
 const url='postgres://user:password@localhost/store?sslmode=require';
 assert.equal(new URL(secureConnectionString(url)).searchParams.get('sslmode'),'verify-full');
 assert.equal(new URL(secureConnectionString(url+'&uselibpqcompat=true')).searchParams.get('sslmode'),'require');
 assert.equal(new URL(secureConnectionString(url.replace('require','disable'))).searchParams.get('sslmode'),'disable');
});
