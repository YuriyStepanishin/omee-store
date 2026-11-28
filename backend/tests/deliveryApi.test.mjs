import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeliveryService} from '../src/services/delivery.js';
import {validateDelivery} from '../src/validators/delivery.js';
const ok=data=>({ok:true,json:async()=>data});
test('lockers accepted for NP/Meest, not offered for Ukrposhta',()=>{
 for(const carrier of ['nova_poshta','meest'])assert.equal(validateDelivery({deliveryCarrier:carrier,deliveryType:'locker'}).method,carrier+':locker');
 assert.throws(()=>validateDelivery({deliveryCarrier:'ukrposhta',deliveryType:'locker'}),{status:400});
});
test('status reveals only configuration flags and missing credentials prevent upstream requests',async()=>{
 const service=createDeliveryService({env:{},fetcher:()=>{throw new Error('must not call');}});
 assert.deepEqual(service.status(),{nova_poshta:{configured:false},ukrposhta:{configured:false},meest:{configured:true}});
 await assert.rejects(()=>service.lookup({carrier:'nova_poshta',kind:'cities',q:'Ки'}),{status:503});
});
test('NP maps cities and caches response without exposing key',async()=>{
 let calls=0;
 const service=createDeliveryService({env:{NOVA_POSHTA_API_KEY:'secret'},fetcher:async(url,options)=>{calls++;assert.equal(url,'https://api.novaposhta.ua/v2.0/json/');const body=JSON.parse(options.body);assert.equal(body.apiKey,'secret');assert.equal(body.calledMethod,'getCities');assert.equal(body.methodProperties.FindByString,'Ки');return ok({success:true,data:[{Ref:'city',Description:'Київ',AreaDescription:'Київська'}]});}});
 const query={carrier:'nova_poshta',kind:'cities',q:'Ки'};
 assert.deepEqual(await service.lookup(query),[{id:'city',label:'Київ, Київська'}]);await service.lookup(query);assert.equal(calls,1);
});
test('NP separates lockers from branches',async()=>{
 const service=createDeliveryService({env:{NOVA_POSHTA_API_KEY:'secret'},fetcher:async()=>ok({success:true,data:[{Ref:'locker',Description:'Поштомат №1',CategoryOfWarehouse:'Postomat'},{Ref:'branch',Description:'Відділення №1',CategoryOfWarehouse:'Branch'}]})});
 for(const type of ['locker','branch'])assert.equal((await service.lookup({carrier:'nova_poshta',kind:'points',cityRef:'city',type}))[0].id,type);
});
test('Meest requires no credentials, deduplicates city ids, requests lockers explicitly',async()=>{
 const calls=[];const row={city_id:'city',city:{ua:'Львів'},region:{ua:'Львівська'},br_id:'locker',num_showcase:10,street:{ua:'вул. Миру'},street_number:'1'};
 const service=createDeliveryService({env:{},fetcher:async(url)=>{calls.push(new URL(url));return ok({status:1,result:[row,row]});}});
 assert.deepEqual(await service.lookup({carrier:'meest',kind:'cities',q:'Ль'}),[{id:'city',label:'Львів, Львівська'}]);
 assert.equal((await service.lookup({carrier:'meest',kind:'points',cityRef:'city',type:'locker'}))[0].label,'Поштомат №10, вул. Миру, 1');
 assert.equal(calls[1].searchParams.get('type'),'poshtomat');assert.equal(calls[1].searchParams.get('city'),'city');
});
test('Meest branch labels keep the address when the provider omits the display number', async () => {
 const service = createDeliveryService({env: {}, fetcher: async () => ok({status: 1, result: [
  {br_id: 'a', num: 19, street: {ua: 'вул. Озерна'}, street_number: '16/1'},
  {br_id: 'b', street: {ua: 'вул. Проскурівська'}, street_number: '24'},
 ]})});
 assert.deepEqual(await service.lookup({carrier: 'meest', kind: 'points', cityRef: 'city'}), [
  {id: 'a', label: 'Відділення №19, вул. Озерна, 16/1'},
  {id: 'b', label: 'Відділення, вул. Проскурівська, 24'},
 ]);
});
test('Ukrposhta sends bearer server-side, handles singleton cities and filters closed offices',async()=>{
 const service=createDeliveryService({env:{UKRPOSHTA_BEARER:'secret'},fetcher:async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer secret');assert.equal(new URL(url).hostname,'www.ukrposhta.ua');return ok({Entries:{Entry:url.includes('get_city_')?{CITY_ID:'1',REGION_ID:'2',CITY_UA:'Київ'}:[{ID:'3',POSTINDEX:'01001',PO_SHORT:'Київ 1',ADDRESS:'Хрещатик, 22',LOCK_CODE:'0',IS_SECURITY:'0'},{ID:'closed',LOCK_CODE:'1'},{ID:'restricted',LOCK_CODE:'0',IS_SECURITY:'1'}]}});}});
 assert.deepEqual(await service.lookup({carrier:'ukrposhta',kind:'cities',q:'Ки'}),[{id:'1',regionRef:'2',label:'Київ'}]);
 assert.deepEqual(await service.lookup({carrier:'ukrposhta',kind:'points',cityRef:'1',regionRef:'2'}),[{id:'3',label:'01001, Київ 1, Хрещатик, 22'}]);
});
test('invalid parameters never reach carrier API',async()=>{
 const service=createDeliveryService({env:{},fetcher:()=>{throw new Error('must not call');}});
 for(const query of [{carrier:'unknown',kind:'cities'},{carrier:'meest',kind:'points'},{carrier:'meest',kind:'cities',q:['city']},{carrier:'meest',kind:'cities',q:'x'.repeat(121)},{carrier:'ukrposhta',kind:'points',type:'locker'}])await assert.rejects(()=>service.lookup(query),{status:400});
});
test('network errors and carrier failures are safe and never cached',async()=>{
 let calls=0;const service=createDeliveryService({env:{},fetcher:async()=>{calls++;throw new Error('private upstream details');}});
 for(let i=0;i<2;i++)await assert.rejects(()=>service.lookup({carrier:'meest',kind:'cities',q:'Ль'}),error=>error.status===503&&!error.message.includes('private'));
 assert.equal(calls,2);
 const rejected=createDeliveryService({env:{NOVA_POSHTA_API_KEY:'secret'},fetcher:async()=>ok({success:false,errors:['secret']})});
 await assert.rejects(()=>rejected.lookup({carrier:'nova_poshta',kind:'cities',q:'Ки'}),error=>error.status===503&&!error.message.includes('secret'));
});
test('NP searches later pages when first page contains only branches',async()=>{
 let calls=0;
 const service=createDeliveryService({env:{NOVA_POSHTA_API_KEY:'secret'},fetcher:async(url,options)=>{calls++;const page=JSON.parse(options.body).methodProperties.Page;return ok({success:true,data:page==='1'?Array.from({length:500},(_,i)=>({Ref:String(i),Description:'Відділення',CategoryOfWarehouse:'Branch'})):[{Ref:'locker',Description:'Поштомат №501',CategoryOfWarehouse:'Postomat'}]});}});
 assert.deepEqual(await service.lookup({carrier:'nova_poshta',kind:'points',cityRef:'city',type:'locker'}),[{id:'locker',label:'Поштомат №501'}]);assert.equal(calls,2);
});

test('NP uses provider totals, excludes closed points and searches cached warehouse numbers and addresses', async () => {
 let calls = 0;
 const service = createDeliveryService({env:{NOVA_POSHTA_API_KEY:' secret '},fetcher:async(url, options) => {
  calls++;
  const {apiKey, methodProperties} = JSON.parse(options.body);
  assert.equal(apiKey, 'secret');
  assert.equal(methodProperties.FindByString, '');
  assert.equal(methodProperties.Page, '1');
  const fillers = Array.from({length: 495}, (_, index) => ({Ref: `filler-${index}`, Number: index + 30, Description: 'Відділення'}));
  return ok({success:true, info:{totalCount:500}, data:[
   {Ref:'branch-1', Number:'1', Description:'Відділення №1: вул. Трудова'},
   {Ref:'branch-10', Number:'10', Description:'Відділення №10: вул. Геологів'},
   {Ref:'closed', Number:'1', Description:'Відділення №1: закрито', WarehouseStatus:'Closed'},
   {Ref:'locker', Number:'1', Description:'Поштомат №1: вул. Трудова'},
   {Ref:'branch-1', Number:'1', Description:'Відділення №1: вул. Трудова'},
   ...fillers,
  ]});
 }});
 const query = {carrier:'nova_poshta', kind:'points', cityRef:'city'};
 assert.deepEqual((await service.lookup({...query,q:'№ 1'})).map(point=>point.id), ['branch-1']);
 assert.deepEqual((await service.lookup({...query,q:'Геологів'})).map(point=>point.id), ['branch-10']);
 assert.deepEqual((await service.lookup({...query,type:'locker',q:'1'})).map(point=>point.id), ['locker']);
 assert.equal(calls, 1);
});

test('NP follows provider totals when pages are shorter than the requested limit', async () => {
 const pages = [];
 const service = createDeliveryService({
  env: {NOVA_POSHTA_API_KEY:'secret'},
  fetcher: async (_url, options) => {
   const {Page, FindByString} = JSON.parse(options.body).methodProperties;
   pages.push(Page);
   assert.equal(FindByString, '');
   const data = Page === '1'
    ? [{Ref:'branch-1', Number:'1', Description:'Відділення №1'}]
    : [{Ref:'branch-101', Number:'101', Description:'Відділення №101'},
       {Ref:'locker-202', Number:'202', Description:'Поштомат №202'}];
   return ok({success:true, info:{totalCount:'3'}, data});
  },
 });
 const query = {carrier:'nova_poshta', kind:'points', cityRef:'city'};
 const [branch, locker] = await Promise.all([
  service.lookup({...query, q:'101'}),
  service.lookup({...query, type:'locker', q:'№ 202'}),
 ]);
 assert.equal(branch[0]?.id, 'branch-101');
 assert.equal(locker[0]?.id, 'locker-202');
 assert.deepEqual(pages, ['1', '2']);
});
