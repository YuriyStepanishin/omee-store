import test from 'node:test';
import assert from 'node:assert/strict';
import {productAudience} from '../src/models/productAudience.js';
import {catalogDetails} from '../src/models/catalogDetails.js';
import {catalogRepository} from '../src/models/catalogAdmin.js';
import {validate,audienceSchema} from '../src/validators/catalog.js';
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
