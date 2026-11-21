import {Router} from 'express';
import {getPool} from '../config/db.js';
import {requireRole} from '../middleware/auth.js';
import {articleRepository} from '../models/articles.js';
import {publishHairArticles} from '../services/publishHairArticles.js';
export function articleRoutes(config){
 const router=Router();
 
 router.use('/articles',(req,res,next)=>{
   res.set('Cache-Control','no-store');
   next();
 });

 const repo=()=>articleRepository(getPool(config.databaseUrl));
 router.get('/articles',async(req,res)=>res.json(config.mode==='postgres'?await repo().list():[]));
 router.get('/articles/:slug',async(req,res)=>{
  const {slug}=req.params;
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>180)return res.status(404).json({message:'Статтю не знайдено.'});
  const article=config.mode==='postgres'?await repo().bySlug(slug):null;
  if(!article)return res.status(404).json({message:'Статтю не знайдено.'});
  res.json(article);
 });
 router.post('/admin/articles/publish-hair-care',requireRole(config,'ADMIN'),async(req,res)=>{
  if(config.mode!=='postgres')return res.status(503).json({message:'Публікація статей потребує PostgreSQL.'});
  res.json(await publishHairArticles(getPool(config.databaseUrl)));
 });
 return router;
}
