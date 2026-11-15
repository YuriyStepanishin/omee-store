import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {waitForResponse} from '../src/utils/httpHandler.js';
test('Express adapter remains pending until the asynchronous response finishes',async()=>{
  const response=new EventEmitter();let settled=false;
  const pending=waitForResponse(()=>{}, {},response).then(()=>{settled=true;});
  await Promise.resolve();assert.equal(settled,false);
  response.emit('finish');await pending;
  assert.equal(settled,true);assert.equal(response.listenerCount('close'),0);assert.equal(response.listenerCount('error'),0);
});
test('adapter handles disconnects and both synchronous and asynchronous errors',async()=>{
  const response=new EventEmitter();const pending=waitForResponse(()=>{}, {},response);
  response.emit('close');await pending;assert.equal(response.listenerCount('finish'),0);
  for(const handler of [()=>{throw Error('sync');},async()=>{throw Error('async');}]){
    const failed=new EventEmitter();await assert.rejects(()=>waitForResponse(handler,{},failed));assert.equal(failed.listenerCount('finish'),0);
  }
});
