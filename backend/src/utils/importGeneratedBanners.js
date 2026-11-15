import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {configureCloudinary} from '../config/cloudinary.js';
import {getPool,closePool} from '../config/db.js';
import {bannerSchema,validate} from '../validators/content.js';

// Import a reviewed manifest without replacing existing banners or product data.
const manifestPath=resolve(process.argv[2]||'assets/hero-banners/2026-11-14/manifest.json');
const publish=process.argv.includes('--publish');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
if(manifest.banners.length!==10)throw Error('Expected exactly ten reviewed banners.');
const receiptPath=resolve(dirname(manifestPath),'receipts.json');
let receipts={};
try{receipts=JSON.parse(await readFile(receiptPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const cloudinary=configureCloudinary();
const pool=getPool();
try{
 const productIds=[...new Set(manifest.banners.flatMap(b=>b.productIds))];
 const {rows}=await pool.query('SELECT p.id FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=ANY($1::uuid[]) AND p.is_active AND c.is_active',[productIds]);
 if(rows.length!==productIds.length)throw Error('A source product is missing or unpublished.');
 for(const banner of manifest.banners){
  const file=resolve(dirname(manifestPath),banner.file);
  if(dirname(file)!==dirname(manifestPath)||basename(file)!==banner.file)throw Error('Invalid asset path.');
  const bytes=await readFile(file);
  if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)!==1942||![809,810].includes(bytes.readUInt32BE(20))||bytes.length>5*1024*1024)throw Error('Banner must be a 1942 × 809 PNG under 5 MB: '+banner.file);
  let hash=createHash('sha256').update(bytes).digest('hex');
  if(!receipts[banner.id]||receipts[banner.id].sha256!==hash){
   const asset=await cloudinary.uploader.upload(file,{
    folder:'omee/banners/generated-20261114',asset_folder:'omee/banners/generated-20261114',
    public_id:`hero-${banner.number}-${hash.slice(0,12)}`,resource_type:'image',overwrite:false,
    transformation:[{width:1942,height:809,crop:'fill',gravity:'center'}],
    timeout:60000,
   });
   if(asset.width!==1942||asset.height!==809||asset.secure_url?.startsWith('https://res.cloudinary.com/')!==true)throw Error('Unexpected uploaded asset.');
   if(bytes.readUInt32BE(20)!==809){
    const response=await fetch(asset.secure_url);
    if(!response.ok)throw Error('Cannot retrieve normalized banner.');
    const normalized=Buffer.from(await response.arrayBuffer());
    if(!normalized.subarray(0,8).equals(bytes.subarray(0,8))||normalized.readUInt32BE(16)!==1942||normalized.readUInt32BE(20)!==809)throw Error('Normalized banner dimensions differ.');
    await writeFile(file,normalized);
    hash=createHash('sha256').update(normalized).digest('hex');
   }
   receipts[banner.id]={imageUrl:asset.secure_url,publicId:asset.public_id,width:asset.width,height:asset.height,bytes:asset.bytes,sha256:hash};
   await writeFile(receiptPath,JSON.stringify(receipts,null,2)+'\n');
  }
  console.log(JSON.stringify({uploaded:banner.number,title:banner.title,width:receipts[banner.id].width,height:receipts[banner.id].height}));
 }
 if(publish){
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   for(const banner of manifest.banners){
    const data=validate(bannerSchema,{title:banner.title,imageUrl:receipts[banner.id].imageUrl,link:'/#catalog',isActive:true});
    const existing=await client.query('SELECT title,image_url FROM banners WHERE id=$1',[banner.id]);
    if(existing.rows.length){
     if(existing.rows[0].image_url!==data.imageUrl||existing.rows[0].title!==data.title)throw Error('Existing banner differs; refusing to replace it.');
    }else await client.query('INSERT INTO banners(id,title,image_url,link,is_active) VALUES($1,$2,$3,$4,$5)',[banner.id,data.title,data.imageUrl,data.link,data.isActive]);
   }
   const verified=await client.query('SELECT count(*)::int AS count FROM banners WHERE id=ANY($1::uuid[]) AND is_active',[manifest.banners.map(b=>b.id)]);
   if(verified.rows[0].count!==10)throw Error('Published banner count mismatch.');
   await client.query('COMMIT');
   console.log(JSON.stringify({published:10,previousBanners:'preserved'}));
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
}finally{await closePool();}
