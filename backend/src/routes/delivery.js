import {Router} from 'express';
import {createDeliveryService} from '../services/delivery.js';
export function deliveryRoutes(service=createDeliveryService()){
 const router=Router();
 
 const respond=(res,data)=>res.set('Cache-Control','public, max-age=300, s-maxage=3600, stale-while-revalidate=86400').json(data);
 router.get('/delivery/status',(req,res)=>respond(res,service.status()));
 router.get('/delivery/:kind',async(req,res)=>{
   const data=await service.lookup({...req.query,kind:req.params.kind});
   respond(res,data);
 });
 return router;
}
