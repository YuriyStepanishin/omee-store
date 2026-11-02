import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readEnv} from './config/env.js';
import {getPool} from './config/db.js';
import {authRoutes} from './routes/auth.js';
import {catalogRoutes} from './routes/catalog.js';
import {contentRoutes} from './routes/content.js';
import {storeRoutes} from './routes/store.js';
import {deliveryRoutes} from './routes/delivery.js';
import {adminRoutes} from './routes/admin.js';
import {articleRoutes} from './routes/articles.js';
import {errorHandler,notFound} from './middleware/errors.js';
export function createApp(config=readEnv()) {
 const app=express();app.disable('x-powered-by');app.use(helmet());
 app.use(cors({origin(origin,callback){callback(null,!origin||config.origins.includes(origin));},credentials:true}));
 app.use(express.json({limit:'128kb'}));
 app.get('/api/health',async(req,res)=>{if(config.mode==='postgres'){try{await getPool(config.databaseUrl).query('SELECT 1');}catch{return res.status(503).json({status:'unavailable',database:'unavailable'});}}res.json({status:'ok',mode:config.mode});});
 app.use('/api/auth',authRoutes(config));
 app.use('/api',adminRoutes(config));
 app.use('/api',catalogRoutes(config));
 app.use('/api',contentRoutes(config));
 app.use('/api',deliveryRoutes());
 app.use('/api',articleRoutes(config));
 app.use('/api',storeRoutes(config,resolve(dirname(fileURLToPath(import.meta.url)),'../data/orders')));
 app.use(notFound);app.use(errorHandler);return app;
}
