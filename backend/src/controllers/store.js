import {articleRepository} from '../models/articles.js';
import {contentRepository} from '../models/content.js';
import {catalog} from '../../catalog.mjs';
import {getPool} from '../config/db.js';
import {loadCatalog,loadCatalogCategories} from '../models/catalog.js';
import {createOrder} from '../models/orders.js';
import {validateOrder} from '../validators/order.js';
import {saveDemoOrder} from '../services/fileOrderStore.js';
import {authService} from '../services/auth.js';
import {cookies} from '../services/tokens.js';
export function storeController(config,dataDir) {
 async function readCatalog(preview=false){
  const pool=getPool(config.databaseUrl);
  const started=Date.now();
  const timed=async(name,task)=>{
   const start=Date.now();
   try{return await task();}
   finally{console.info(`[catalog-perf] ${name} ${Date.now()-start}ms`);}
  };
  const [content,categories,products,blog]=await Promise.all([
   timed('content',()=>contentRepository(pool).publicContent()),
   timed('categories',()=>loadCatalogCategories(pool,{includeInactive:preview})),
   timed('products',()=>loadCatalog(pool,{includeDrafts:preview})),
   timed('blog',()=>articleRepository(pool).list()),
  ]);
  console.info(`[catalog-perf] total ${Date.now()-started}ms preview=${preview} products=${products.length}`);
  const response={...content,categories,products,blog,demo:false,...(preview?{preview:true}:{})};
  console.info(`[catalog-perf] payload ${Buffer.byteLength(JSON.stringify(response))} bytes`);
  console.info('[catalog-perf] payload-breakdown '+JSON.stringify(Object.fromEntries(['products','categories','banners','media','blog','info'].map(key=>[key,Buffer.byteLength(JSON.stringify(response[key]??null))]))));
  return response;
 }
 return {
 info:async(req,res)=>res.json({info:config.mode==='demo'?catalog.info:await contentRepository(getPool(config.databaseUrl)).publicInfo()}),
 catalog:async(req,res)=>res.json(config.mode==='demo'?{...catalog,demo:true}:await readCatalog()),
 adminCatalog:async(req,res)=>res.json(await readCatalog(true)),
 order:async(req,res)=>{
  let order;
  if(config.mode==='demo'){try{order=validateOrder(req.body);}catch(error){error.status=400;throw error;}await saveDemoOrder(order,dataDir);}
  else {const pool=getPool(config.databaseUrl);const token=cookies(req).kss_access;const user=token?await authService(pool,config).me(token):null;order=await createOrder(pool,req.body,user?.id||null);}
  res.status(201).json({orderId:order.orderId,status:order.status,amount:order.amount,message:'Замовлення збережено й очікує підтвердження. Кошти не списувалися.'});
 }
};}
