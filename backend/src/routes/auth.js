import {Router} from 'express';
import {getPool} from '../config/db.js';
import {authService} from '../services/auth.js';
import {cookies,writeSession,clearSession} from '../services/tokens.js';
import {parseAuth,registerSchema,loginSchema} from '../validators/auth.js';
import {authLimiter} from '../middleware/authLimiter.js';
import {forgotSchema,resetSchema} from '../validators/auth.js';
import {passwordReset} from '../services/passwordReset.js';
import {changePasswordSchema} from '../validators/auth.js';
import {changePassword} from '../services/changePassword.js';
export function authRoutes(config){
 const router=Router();
 router.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');if(config.mode!=='postgres')return res.status(503).json({message:'Авторизація потребує підключення PostgreSQL.'});next();});
 const service=()=>authService(getPool(config.databaseUrl),config);
 const limited=authLimiter();
 router.post('/change-password',limited,async(req,res)=>{const user=await service().me(cookies(req).kss_access);const data=parseAuth(changePasswordSchema,req.body);await changePassword(getPool(config.databaseUrl),user.id,data);clearSession(res,config.production);res.json({message:'Пароль змінено. Увійдіть з новим паролем.'});});
 router.post('/forgot-password',limited,async(req,res)=>{const data=parseAuth(forgotSchema,req.body);await passwordReset(getPool(config.databaseUrl),config).request(data.email);res.json({message:'Якщо акаунт існує, лист із посиланням надіслано. Перевірте також Спам.'});});
 router.post('/reset-password',limited,async(req,res)=>{const data=parseAuth(resetSchema,req.body);await passwordReset(getPool(config.databaseUrl),config).reset(data.token,data.password);clearSession(res,config.production);res.json({message:'Пароль змінено. Увійдіть з новим паролем.'});});
 const respond=(res,result,status=200)=>{writeSession(res,result.session,config.production);return res.status(status).json({user:result.user});};
 router.post('/register',limited,async(req,res)=>respond(res,await service().register(parseAuth(registerSchema,req.body)),201));
 router.post('/login',limited,async(req,res)=>respond(res,await service().login(parseAuth(loginSchema,req.body))));
 router.post('/refresh',limited,async(req,res)=>{try{return respond(res,await service().refresh(cookies(req).kss_refresh));}catch(error){if(error.status===401)clearSession(res,config.production);throw error;}});
 router.post('/logout',async(req,res)=>{await service().logout(cookies(req).kss_refresh);clearSession(res,config.production);res.status(204).end();});
 router.get('/loyalty',async(req,res)=>{
  const user=await service().me(cookies(req).kss_access);
  const {rows}=await getPool(config.databaseUrl).query(`SELECT COALESCE(SUM(ROUND(total*0.05)),0)::integer AS points,COUNT(*)::integer AS orders FROM orders WHERE user_id=$1 AND status='DELIVERED' AND payment_status='PAID'`,[user.id]);
  res.json({points:rows[0].points,orders:rows[0].orders,ratePercent:5,redeemEnabled:false});
 });
 router.get('/me',async(req,res)=>res.json({user:await service().me(cookies(req).kss_access)}));
 return router;
}
