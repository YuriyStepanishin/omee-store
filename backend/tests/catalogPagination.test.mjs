import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalogPage,loadCatalogFacets} from '../src/models/catalog.js';
test('catalog pagination bounds inputs and parameterizes filters',async()=>{
 const calls=[];const pool={async query(sql,values){calls.push({sql,values});return {rows:calls.length===1?[{total:2}]:[]};}};
 const result=await loadCatalogPage(pool,{page:2.8,limit:999,search:'маска',brand:'Brand',category:'Маски',line:'hair',sort:'price_asc'});
 assert.deepEqual(result,{products:[],page:2,limit:48,total:2,pages:1});
 assert.deepEqual(calls[0].values,['маска','Brand','Маски','hair']);
 assert.deepEqual(calls[1].values,['маска','Brand','Маски','hair',48,48]);
 assert.match(calls[1].sql,/LIMIT 1/);assert.match(calls[1].sql,/ORDER BY p.price ASC,p.id/);
});
test('invalid sorting cannot inject SQL',async()=>{
 const calls=[];const pool={async query(sql,values){calls.push({sql,values});return {rows:calls.length===1?[{total:0}]:[]};}};
 await loadCatalogPage(pool,{search:'x'.repeat(200),sort:'DROP TABLE products',line:'invalid'});
 assert.equal(calls[0].values[0].length,120);assert.equal(calls[0].values[3],'');
 assert.match(calls[1].sql,/ORDER BY p.created_at DESC,p.id/);assert.doesNotMatch(calls[1].sql,/DROP TABLE/);
});
test('facets deduplicate brands and categories',async()=>{
 const pool={async query(){return {rows:[{category:'Шампуні',brand:'A'},{category:'Шампуні',brand:'B'},{category:'Маски',brand:'A'}]};}};
 assert.deepEqual(await loadCatalogFacets(pool),{categories:['Маски','Шампуні'],brands:['A','B']});
});
