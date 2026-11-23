import {articleRepository} from '../models/articles.js';
import {contentRepository} from '../models/content.js';
import {catalog} from '../../catalog.mjs';
import {getPool} from '../config/db.js';
import {loadCatalog,loadCatalogPage,loadCatalogFacets,loadCatalogCategories} from '../models/catalog.js';
import {createOrder} from '../models/orders.js';
import {validateOrder} from '../validators/order.js';
import {saveDemoOrder} from '../services/fileOrderStore.js';
import {authService} from '../services/auth.js';
import {cookies} from '../services/tokens.js';
export function storeController(config,dataDir) {
 async function readCatalog(preview=false,lightweight=false){
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
   timed('products',()=>lightweight?Promise.resolve([]):loadCatalog(pool,{includeDrafts:preview})),
   timed('blog',()=>articleRepository(pool).list()),
  ]);
  console.info(`[catalog-perf] total ${Date.now()-started}ms preview=${preview} products=${products.length}`);
  const listingProducts=preview?products:products.map(({images,characteristics,details,...product})=>({...product,images:[product.image],characteristics:{},details:[]}));
  const response={...content,categories,products:listingProducts,blog,demo:false,...(preview?{preview:true}:{})};
  console.info(`[catalog-perf] payload ${Buffer.byteLength(JSON.stringify(response))} bytes`);
  console.info('[catalog-perf] payload-breakdown '+JSON.stringify(Object.fromEntries(['products','categories','banners','media','blog','info'].map(key=>[key,Buffer.byteLength(JSON.stringify(response[key]??null))]))));
  console.info('[catalog-perf] product-fields '+JSON.stringify(Object.fromEntries(['characteristics','details','description','images','variants','groups','badges'].map(key=>[key,products.reduce((sum,p)=>sum+Buffer.byteLength(JSON.stringify(p[key]??null)),0)]))));
  return response;
 }
 return {
 info:async(req,res)=>res.json({info:config.mode==='demo'?catalog.info:await contentRepository(getPool(config.databaseUrl)).publicInfo()}),
 catalog:async(req,res)=>res.json(config.mode==='demo'?{...catalog,demo:true}:await readCatalog(false,req.query?.lightweight==='1')),
 cartProducts:async(req,res)=>{
  if(config.mode==='demo')return res.json({products:catalog.products});
  const ids=req.body?.ids;
  if(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))return res.status(400).json({message:'Некоректний список товарів.'});
  const pool=getPool(config.databaseUrl);
  const {rows}=await pool.query('SELECT DISTINCT product_id FROM product_variants WHERE source_product_id=ANY($1::uuid[])',[...new Set(ids)]);
  const products=rows.length?await loadCatalog(pool,{productIds:rows.map(row=>row.product_id)}):[];
  res.json({products});
 },
 catalogFacets:async(req,res)=>res.json(config.mode==='demo'?{categories:[...new Set(catalog.products.map(p=>p.category).filter(Boolean))],brands:[...new Set(catalog.products.map(p=>p.brand).filter(Boolean))]}:await loadCatalogFacets(getPool(config.databaseUrl))),
 catalogPage:async(req,res)=>res.json(config.mode==='demo'?(()=>{const page=Math.max(1,Number(req.query.page)||1),limit=24;const products=catalog.products.filter(p=>(!req.query.search||p.title?.toLowerCase().includes(String(req.query.search).toLowerCase()))&&(!req.query.brand||p.brand===req.query.brand)&&(!req.query.category||p.category===req.query.category)&&(!req.query.line||p.audience===req.query.line));return {products:products.slice((page-1)*limit,page*limit),page,limit,total:products.length,pages:Math.ceil(products.length/limit)};})():await loadCatalogPage(getPool(config.databaseUrl),{page:req.query.page,limit:req.query.limit,search:req.query.search,brand:req.query.brand,category:req.query.category,line:req.query.line,sort:req.query.sort})),
 adminCatalog:async(req,res)=>res.json(await readCatalog(true)),
 product:async(req,res)=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id))return res.status(400).json({message:'Некоректний ідентифікатор товару.'});
  const products=config.mode==='demo'?catalog.products.filter(p=>p.id===req.params.id):await loadCatalog(getPool(config.databaseUrl),{productId:req.params.id});
  if(!products.length)return res.status(404).json({message:'Товар не знайдено.'});
  res.json(products[0]);
 },
 order:async(req,res)=>{
  let order;
  if(config.mode==='demo'){try{order=validateOrder(req.body);}catch(error){error.status=400;throw error;}await saveDemoOrder(order,dataDir);}
  else {const pool=getPool(config.databaseUrl);const token=cookies(req).kss_access;const user=token?await authService(pool,config).me(token):null;order=await createOrder(pool,req.body,user?.id||null);}
  res.status(201).json({orderId:order.orderId,status:order.status,amount:order.amount,message:'Замовлення збережено й очікує підтвердження. Кошти не списувалися.'});
 }
};}
