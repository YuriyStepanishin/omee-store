import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogRepository} from '../src/models/catalogAdmin.js';
const poolFor=(handler)=>({connect:async()=>({query:handler,release(){}})});
test('permanent deletion removes standalone variant before its product in a transaction',async()=>{
 const calls=[];
 const repo=catalogRepository(poolFor(async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('SELECT id FROM products'))return {rows:[{id:'id'}]};return {rows:[],rowCount:0};}));
 await repo.deleteProduct('id');
 assert.ok(calls.some(c=>c.sql.startsWith('DELETE FROM product_variants')));
 assert.ok(calls.some(c=>c.sql.startsWith('DELETE FROM products')));
 assert.equal(calls.at(-1).sql,'COMMIT');
});
test('missing products return 404; merged products are protected',async()=>{
 const missing=catalogRepository(poolFor(async(sql)=>sql.startsWith('SELECT id FROM products')?{rows:[]}: {rows:[]}));
 await assert.rejects(()=>missing.deleteProduct('missing'),{status:404});
 const merged=catalogRepository(poolFor(async(sql)=>sql.startsWith('SELECT id FROM products')?{rows:[{id:'id'}]}:sql.includes('FROM product_variants WHERE product_id')?{rowCount:1}:{rowCount:0}));
 await assert.rejects(()=>merged.deleteProduct('merged'),{status:409});
});
