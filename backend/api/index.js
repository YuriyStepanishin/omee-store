import { createApp } from '../src/app.js';
import { waitForResponse } from '../src/utils/httpHandler.js';

if(process.env.NODE_ENV==='development'&&typeof process.loadEnvFile==='function'){
 try{process.loadEnvFile(new URL('../.env',import.meta.url));}
 catch(error){if(error.code!=='ENOENT')throw error;}
}

let app;

export default function handler(req,res){
 app??=createApp();
 return waitForResponse(app,req,res);
}
