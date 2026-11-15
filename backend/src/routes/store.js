import {Router} from 'express';
import {requireRole} from '../middleware/auth.js';
import {storeController} from '../controllers/store.js';
export function storeRoutes(config,dataDir) {
 const router=Router();
 const controller=storeController(config,dataDir);
 
 router.use((req,res,next)=>{
   if(req.method==='GET'&&!req.path.startsWith('/admin')){
     res.set('Cache-Control','public, max-age=60, s-maxage=3600, stale-while-revalidate=604800');
   }
   next();
 });
 
 router.get('/store-info',controller.info);
 router.get('/catalog',controller.catalog);
 router.get('/admin/catalog',requireRole(config,'ADMIN'),controller.adminCatalog);
 router.post('/orders',controller.order);
 return router;
}
