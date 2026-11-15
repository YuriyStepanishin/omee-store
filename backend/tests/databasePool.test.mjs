import test from 'node:test';
import assert from 'node:assert/strict';
import {getPool,closePool} from '../src/config/db.js';
import {databaseUnavailable} from '../src/utils/databaseErrors.js';
import {errorHandler} from '../src/middleware/errors.js';
test('hot reloaded modules reuse pools while different databases stay isolated',async()=>{
  const first=getPool('postgres://localhost/pool-test-a');
  const reloaded=await import('../src/config/db.js?hot-reload-test');
  assert.equal(reloaded.getPool('postgres://localhost/pool-test-a'),first);
  assert.notEqual(getPool('postgres://localhost/pool-test-b'),first);
  assert.equal(first.options.max,5);
  assert.equal(first.listenerCount('error'),1);
  await closePool();
  assert.notEqual(getPool('postgres://localhost/pool-test-a'),first);
  await closePool();
});
test('connection outages return 503 without exposing connection details',()=>{
  const error=new Error('Connection terminated due to connection timeout');
  assert.equal(databaseUnavailable(error),'CONNECTION_TIMEOUT');
  assert.equal(databaseUnavailable({code:'ECONNRESET'}),'ECONNRESET');
  assert.equal(databaseUnavailable({code:'23505',message:'duplicate'}),null);
  let status,body;
  const response={status(value){status=value;return this;},json(value){body=value;}};
  const previous=console.error;console.error=()=>{};
  try{errorHandler(error,{},response,()=>{});}finally{console.error=previous;}
  assert.equal(status,503);assert.ok(!JSON.stringify(body).includes('Connection terminated'));
});
