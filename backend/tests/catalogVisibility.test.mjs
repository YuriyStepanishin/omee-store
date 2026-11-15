import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog} from '../src/models/catalog.js';
import {catalogRepository} from '../src/models/catalogAdmin.js';
test('public catalog excludes drafts and chooses Cloudinary images first',async()=>{
 let sql;
 const rows=await loadCatalog({async query(query){sql=query;return {rows:[{images:['https://res.cloudinary.com/store/p.png'],price:'25.00',oldPrice:null}]};}});
 assert.match(sql,/WHERE p.is_active AND c.is_active/);assert.match(sql,/res\.cloudinary\.com/);
 assert.equal(rows[0].image,'https://res.cloudinary.com/store/p.png');assert.equal(rows[0].price,25);
});
test('explicit admin preview includes drafts; missing gallery maps to empty image',async()=>{
 let sql;const rows=await loadCatalog({async query(query){sql=query;return {rows:[{images:[],price:'0',oldPrice:null,isPublished:false}]};}},{includeDrafts:true});
 assert.doesNotMatch(sql,/WHERE p.is_active AND c.is_active/);assert.equal(rows[0].isPublished,false);assert.equal(rows[0].image,'');
});
test('public catalog search, categories and product details all exclude unpublished records',async()=>{
 const calls=[];
 const repo=catalogRepository({async query(sql){calls.push(sql);return sql.startsWith('SELECT count(*)')?{rows:[{count:'0'}]}:{rows:[],rowCount:0};}});
 await repo.categories();
 await repo.products({q:'conditioner',page:1,limit:20,sort:'newest'});
 await assert.rejects(()=>repo.product('11111111-1111-4111-8111-111111111111'));
 assert.match(calls[0],/\bWHERE\b.*\bis_active\b/);
 assert.match(calls[1],/\bp\.is_active AND c\.is_active\b/);
 assert.match(calls[2],/\bp\.is_active AND c\.is_active\b/);
 assert.match(calls[3],/\bp\.is_active AND c\.is_active\b/);
});
test('admin catalog continues to include drafts for editing',async()=>{
 const calls=[];
 const repo=catalogRepository({async query(sql){calls.push(sql);return sql.startsWith('SELECT count(*)')?{rows:[{count:'0'}]}:{rows:[]};}});
 await repo.categories(true);
 await repo.products({q:'draft',page:1,limit:20,sort:'newest'},true);
 await repo.product('11111111-1111-4111-8111-111111111111',true).catch(()=>{});
 assert.doesNotMatch(calls[0],/WHERE is_active/);
 assert.doesNotMatch(calls[1],/p\.is_active AND c\.is_active/);
 assert.doesNotMatch(calls[2],/p\.is_active AND c\.is_active/);
});
