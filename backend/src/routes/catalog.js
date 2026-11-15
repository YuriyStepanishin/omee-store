import {catalogDictionaries} from '../models/catalogDictionaries.js';
import {prepareCatalog} from '../services/prepareCatalog.js';
import {Router} from 'express';
import multer from 'multer';
import {getPool} from '../config/db.js';
import {requireRole} from '../middleware/auth.js';
import {catalogRepository} from '../models/catalogAdmin.js';
import {categorySchema,productSchema,audienceSchema,listSchema,validate,validateId} from '../validators/catalog.js';
import {uploadImage,uploadVideo} from '../services/upload.js';
import {createUploadSignature,verifyUploadedAsset,verifyUploadedUrls} from '../services/cloudinaryUploads.js';
export function catalogRoutes(config){const router=Router();
 router.use(['/categories','/products','/admin/categories','/admin/brands','/admin/products','/admin/uploads','/upload'],(req,res,next)=>{if(config.mode!=='postgres')return res.status(503).json({message:'Керування каталогом потребує PostgreSQL.'});next();});

 router.use((req,res,next)=>{
   if(req.method==='GET'&&!req.path.startsWith('/admin')){
     res.set('Cache-Control','public, max-age=60, s-maxage=3600, stale-while-revalidate=604800');
   }
   next();
 });

 const repo=()=>catalogRepository(getPool(config.databaseUrl));
 let uploads=0;
 const uploadSlot=(req,res,next)=>{if(uploads>=2)return res.status(429).json({message:'Зачекайте завершення інших завантажень.'});uploads++;let released=false;const release=()=>{if(!released){released=true;uploads--;}};res.once('close',release);res.once('finish',release);next();};
 const admin=requireRole(config,'ADMIN');
 router.get('/admin/brands',admin,async(req,res)=>res.json(await catalogDictionaries(getPool(config.databaseUrl)).list('brands')));
 router.post('/admin/brands',admin,async(req,res)=>{const data=validate(categorySchema,req.body);if(data.image)await verifyUploadedUrls([data.image],'image');res.status(201).json(await catalogDictionaries(getPool(config.databaseUrl)).save('brands',data));});
 router.put('/admin/brands/:id',admin,async(req,res)=>{const data=validate(categorySchema,req.body);if(data.image)await verifyUploadedUrls([data.image],'image');res.json(await catalogDictionaries(getPool(config.databaseUrl)).save('brands',data,validateId(req.params.id)));});
 router.delete('/admin/brands/:id',admin,async(req,res)=>{await catalogDictionaries(getPool(config.databaseUrl)).archive('brands',validateId(req.params.id));res.status(204).end();});
 router.get('/categories',async(req,res)=>res.json(await repo().categories()));
 router.get('/products',async(req,res)=>res.json(await repo().products(validate(listSchema,req.query))));
 router.get('/products/:id',async(req,res)=>res.json(await repo().product(validateId(req.params.id))));
 router.get('/admin/categories',admin,async(req,res)=>res.json(await repo().categories(true)));
 router.get('/admin/products',admin,async(req,res)=>res.json(await repo().products(validate(listSchema,req.query),true)));
 router.get('/admin/products/:id',admin,async(req,res)=>res.json(await repo().product(validateId(req.params.id),true)));
 router.post('/admin/uploads/sign',admin,async(req,res)=>res.json(createUploadSignature(req.body)));
 router.post('/admin/uploads/verify',admin,async(req,res)=>res.json(await verifyUploadedAsset(req.body)));
 router.post('/categories',admin,async(req,res)=>{const data=validate(categorySchema,req.body);if(data.image)await verifyUploadedUrls([data.image],'image');res.status(201).json(await repo().saveCategory(data));});
 router.put('/categories/:id',admin,async(req,res)=>{const data=validate(categorySchema,req.body);if(data.image)await verifyUploadedUrls([data.image],'image');res.json(await repo().saveCategory(data,validateId(req.params.id)));});
 router.delete('/categories/:id',admin,async(req,res)=>{await repo().archiveCategory(validateId(req.params.id));res.status(204).end();});
 router.post('/admin/products/classify',admin,async(req,res)=>res.json(await prepareCatalog(getPool(config.databaseUrl))));
 router.post('/products',admin,async(req,res)=>{const data=validate(productSchema,req.body);await verifyUploadedUrls(data.images,'image');res.status(201).json(await repo().saveProduct(data));});
 router.put('/products/:id/line',admin,async(req,res)=>{const {audience}=validate(audienceSchema,req.body);res.json(await repo().saveAudience(validateId(req.params.id),audience));});
 router.put('/products/:id',admin,async(req,res)=>{const data=validate(productSchema,req.body);await verifyUploadedUrls(data.images,'image');res.json(await repo().saveProduct(data,validateId(req.params.id)));});
 router.delete('/admin/products/:id',admin,async(req,res)=>{await repo().deleteProduct(validateId(req.params.id));res.status(204).end();});
 router.delete('/products/:id',admin,async(req,res)=>{await repo().archiveProduct(validateId(req.params.id));res.status(204).end();});
 router.post('/upload',admin,uploadSlot,multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0,parts:1}}).single('image'),async(req,res)=>res.status(201).json(await uploadImage(req.file)));
 router.post('/upload/video',admin,uploadSlot,multer({storage:multer.memoryStorage(),limits:{fileSize:25*1024*1024,files:1,fields:0,parts:1}}).single('video'),async(req,res)=>res.status(201).json(await uploadVideo(req.file)));
 return router;
}
