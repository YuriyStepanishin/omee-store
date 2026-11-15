import {Router} from 'express';
import {z} from 'zod';
import {requireRole} from '../middleware/auth.js';
import {getPool} from '../config/db.js';
import {validate,validateId} from '../validators/catalog.js';
import {accountRepository} from '../models/account.js';
import {cartRepository} from '../models/cart.js';
const cartSchema=z.object({expectedUserId:z.string().uuid(),items:z.array(z.object({productId:z.string().uuid(),qty:z.number().int().min(1).max(99)}).strict()).max(100)}).strict().refine(data=>new Set(data.items.map(item=>item.productId)).size===data.items.length,{message:'Товари в кошику не повинні повторюватися.'});
const pageSchema=z.object({page:z.coerce.number().int().min(1).max(100000).default(1)});
export function accountRoutes(config) {
  const router=Router();
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(config.mode!=='postgres')return res.status(503).json({message:'Кабінет потребує підключення до бази даних.'});next();});
  router.use(requireRole(config));
  const repo=()=>accountRepository(getPool(config.databaseUrl));
  router.get('/cart',async(req,res)=>res.json(await cartRepository(getPool(config.databaseUrl)).get(req.user.id)));
  const saveCart=merge=>async(req,res)=>{const data=validate(cartSchema,req.body);if(data.expectedUserId!==req.user.id)return res.status(409).json({message:'Акаунт змінився. Оновіть кошик.'});res.json(await cartRepository(getPool(config.databaseUrl)).save(req.user.id,data.items,merge));};
  router.put('/cart',saveCart(false));
  router.post('/cart/merge',saveCart(true));
  router.get('/orders',async(req,res)=>res.json(await repo().orders(req.user.id,validate(pageSchema,req.query).page)));
  router.get('/favorites/ids',async(req,res)=>res.json(await repo().favoriteIds(req.user.id)));
  router.get('/favorites',async(req,res)=>res.json(await repo().favorites(req.user.id,validate(pageSchema,req.query).page)));
  router.put('/favorites/:id',async(req,res)=>{await repo().addFavorite(req.user.id,validateId(req.params.id));res.status(204).end();});
  router.delete('/favorites/:id',async(req,res)=>{await repo().removeFavorite(req.user.id,validateId(req.params.id));res.status(204).end();});
  return router;
}
