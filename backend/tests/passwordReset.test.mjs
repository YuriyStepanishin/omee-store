import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { passwordReset } from '../src/services/passwordReset.js';
import { hashToken, signSession } from '../src/services/tokens.js';
import { authService } from '../src/services/auth.js';
import { parseAuth, resetSchema } from '../src/validators/auth.js';

const config = {mailKey:'test',mailFrom:'store@example.com',storeUrl:'https://example.com',accessSecret:'a'.repeat(48),refreshSecret:'b'.repeat(48)};
test('recovery stores only a digest and sends a short-lived token to the configured store', async()=>{
  const calls=[];
  let delivered;
  const pool={query:async(sql,args)=>{calls.push({sql,args});return {rows:sql.startsWith('SELECT')?[{id:'user'}]:[]};}};
  await passwordReset(pool,config,async(email,url)=>{delivered={email,url};}).request('user@example.com');
  const url=new URL(delivered.url);
  const token=url.hash.slice(1);
  assert.match(token,/^[a-f0-9]{64}$/);
  assert.equal(url.origin,'https://example.com');
  assert.equal(calls[1].args[0],hashToken(token));
  assert.notEqual(calls[1].args[0],token);
  assert.ok(calls[1].args[2].getTime()>Date.now()+29*60000);
  let sent=false;
  await passwordReset({query:async()=>({rows:[]})},config,async()=>{sent=true;}).request('unknown@example.com');
  assert.equal(sent,false);
  await assert.rejects(()=>passwordReset(pool,{}).request('user@example.com'),{status:503});
});

test('reset hashes the password, consumes tokens, revokes sessions and rolls back replay',async()=>{
  const calls=[];
  let consumed=false;
  let released=0;
  const client={query:async(sql,args)=>{
    calls.push({sql,args});
    if(sql.startsWith('SELECT')) return {rows:[{id:'user'}]};
    if(sql.startsWith('UPDATE password_reset_tokens SET used_at=now() WHERE token_hash')) {
      if(consumed) return {rows:[]};
      consumed=true;
      return {rows:[{user_id:'user'}]};
    }
    return {rows:[]};
  },release(){released++;}};
  const service=passwordReset({connect:async()=>client},config);
  await service.reset('a'.repeat(64),'Password123');
  const update=calls.find(call=>call.sql.startsWith('UPDATE users'));
  assert.ok(await bcrypt.compare('Password123',update.args[0]));
  assert.ok(calls.some(call=>call.sql.startsWith('UPDATE refresh_tokens')));
  assert.equal(calls.at(-1).sql,'COMMIT');
  await assert.rejects(()=>service.reset('a'.repeat(64),'Password123'),{status:400});
  assert.equal(calls.at(-1).sql,'ROLLBACK');
  assert.equal(released,2);
  assert.throws(()=>parseAuth(resetSchema,{token:'bad',password:'Password123'}),{status:400});
});

test('password change invalidates previously issued access tokens regardless of role',async()=>{
  const session=signSession({id:'user'},config);
  const service=authService({query:async()=>({rows:[{id:'user',role:'ADMIN',password_changed_at:new Date(Date.now()+1)}]})},config);
  await assert.rejects(()=>service.me(session.access),{status:401});
});
