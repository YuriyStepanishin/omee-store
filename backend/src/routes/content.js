import {Router} from 'express';
import {importHairMedia} from '../services/importHairMedia.js';
import {getPool} from '../config/db.js';
import {requireRole} from '../middleware/auth.js';
import {contentRepository} from '../models/content.js';
import {infoSchema,mediaSchema,bannerSchema,promoSchema,validate} from '../validators/content.js';
import {validateId} from '../validators/catalog.js';
import {verifyUploadedUrls} from '../services/cloudinaryUploads.js';
export function contentRoutes(config){
 const router=Router();
 router.use('/admin/content',requireRole(config,'ADMIN'));
 const repo=()=>contentRepository(getPool(config.databaseUrl));
 router.post('/admin/content/media/import-hair-care',async(req,res)=>{
  if(config.mode!=='postgres')return res.status(503).json({message:'Імпорт потребує PostgreSQL.'});
  res.json(await importHairMedia(getPool(config.databaseUrl)));
 });
 router.get('/admin/content',async(req,res)=>res.json(await repo().adminContent()));
 router.patch('/admin/content/media/:id/publication',async(req,res)=>{
  const isActive=req.body?.isActive;
  if(typeof isActive!=='boolean')return res.status(400).json({message:'Оберіть статус публікації.'});
  res.json(await repo().setMediaPublication(validateId(req.params.id),isActive));
 });
 router.delete('/admin/content/media/:id',async(req,res)=>{
  await repo().removeMedia(validateId(req.params.id));
  res.status(204).end();
 });
 router.put('/admin/content/info',async(req,res)=>{
  await repo().saveInfo(validate(infoSchema,req.body));res.status(204).end();
 });
 for(const [path,schema,method] of [['media',mediaSchema,'saveMedia'],['banners',bannerSchema,'saveBanner'],['promos',promoSchema,'savePromo']]){
  const save=async(req,res,id)=>{
   const data=validate(schema,req.body);
   if(path==='media'){
    await verifyUploadedUrls([data.url],data.type==='video'?'video':'image');
    await verifyUploadedUrls([data.cover],'image');
   }else if(path==='banners')await verifyUploadedUrls([data.imageUrl],'image');
   res.status(id?200:201).json(await repo()[method](data,id));
  };
  router.post('/admin/content/'+path,(req,res)=>save(req,res));
  router.put('/admin/content/'+path+'/:id',(req,res)=>save(req,res,validateId(req.params.id)));
 }
 return router;
}
