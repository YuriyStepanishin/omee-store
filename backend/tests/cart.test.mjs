import test from 'node:test';
import assert from 'node:assert/strict';
import {cartRepository} from '../src/models/cart.js';
test('cart replacement locks the owner, stores only server-scoped rows and commits atomically',async()=>{
  const calls=[];
  const client={query:async(sql,args)=>{calls.push({sql,args});return {rows:sql.startsWith('SELECT product_id')?[{productId:'product',qty:2}]:[]};},release(){}};
  const repo=cartRepository({connect:async()=>client});
  const result=await repo.save('owner',[{productId:'product',qty:2}]);
  assert.deepEqual(result.items,[{productId:'product',qty:2}]);
  assert.ok(calls[1].sql.includes('FOR UPDATE'));
  assert.deepEqual(calls.find(call=>call.sql.startsWith('DELETE')).args,['owner']);
  assert.deepEqual(calls.find(call=>call.sql.startsWith('INSERT')).args,['owner','product',2]);
  assert.equal(calls.at(-1).sql,'COMMIT');
});
test('guest merge is retry-safe and does not clear the account cart; failure rolls back',async()=>{
  const calls=[];let fail=false;
  const client={query:async(sql,args)=>{calls.push({sql,args});if(fail&&sql.startsWith('INSERT'))throw Error('failure');return {rows:[]};},release(){}};
  const repo=cartRepository({connect:async()=>client});
  await repo.save('owner',[{productId:'product',qty:2}],true);
  assert.ok(!calls.some(call=>call.sql.startsWith('DELETE')));
  assert.ok(calls.find(call=>call.sql.startsWith('INSERT')).sql.includes('GREATEST'));
  fail=true;
  await assert.rejects(()=>repo.save('owner',[{productId:'product',qty:2}]),/failure/);
  assert.equal(calls.at(-1).sql,'ROLLBACK');
});
