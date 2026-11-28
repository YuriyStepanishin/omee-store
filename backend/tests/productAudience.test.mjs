import test from 'node:test';
import assert from 'node:assert/strict';
import {productAudience} from '../src/models/productAudience.js';
import {catalogDetails} from '../src/models/catalogDetails.js';
import {catalogRepository} from '../src/models/catalogAdmin.js';
import {validate,audienceSchema,productSchema} from '../src/validators/catalog.js';
test('products use hair, body, other groups; explicit choice takes precedence',()=>{
 assert.equal(productAudience(), 'other');assert.equal(productAudience({},['Шампунь для волосся']),'hair');
 assert.equal(productAudience({'Лінійка':'Догляд за тілом'},['Шампунь для волосся']),'body');
 assert.equal(productAudience({'Лінійка':'Догляд за волоссям'},['Крем для тіла']),'hair');
 assert.equal(catalogDetails({category:'Full Force',characteristics:{brand:'Full Force',sourceGroups:['Крем для тіла']}}).audience,'body');
});
test('line selection validates identifiers and preserves other characteristics using jsonb_set',async()=>{
 assert.throws(()=>validate(audienceSchema,{audience:'ADMIN'}),{status:400});assert.equal(validate(audienceSchema,{audience:'hair'}).audience,'hair');
 let query,args;const repo=catalogRepository({async query(sql,values){query=sql;args=values;return {rowCount:1,rows:[{id:'product'}]};}});
 await repo.saveAudience('product','body');assert.match(query,/jsonb_set/);assert.deepEqual(args,['Догляд за тілом','product']);
});

test('saving a product writes its selected line in the same transaction and preserves an omitted line', async () => {
 const id = '11111111-1111-4111-8111-111111111111';
 const writes = [];
 const client = {
  async query(sql, args) {
   if (sql.startsWith('SELECT id,name,slug')) return {rows: [{id, name: 'Шампуні'}]};
   if (sql.startsWith('SELECT characteristics')) return {rows: [{characteristics: {'Лінійка': 'Догляд за волоссям'}}]};
   if (sql.startsWith('UPDATE products SET category_id')) writes.push(JSON.parse(args[9]));
   return {rows: [{id}], rowCount: 1};
  },
  release() {},
 };
 const repo = catalogRepository({connect: async () => client});
 const input = {categoryId: id, name: 'Шампунь', slug: 'shampoo', price: 100, stock: 1, sku: 'A1'};
 await repo.saveProduct(productSchema.parse({...input, audience: 'body'}), id);
 await repo.saveProduct(productSchema.parse(input), id);
 assert.equal(writes[0]['Лінійка'], 'Догляд за тілом');
 assert.equal(writes[1]['Лінійка'], 'Догляд за волоссям');
 assert.equal(productSchema.safeParse({...input, audience: 'all'}).success, false);
});
