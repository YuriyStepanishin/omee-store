import {getPool,closePool} from '../config/db.js';
import {configureCloudinary} from '../config/cloudinary.js';
import {transferProductImages} from '../services/transferProductImages.js';
try{
 const preview=!process.argv.includes('--apply');
 const concurrency=Number(process.argv.find(a=>a.startsWith('--concurrency='))?.slice(14)||1);
 const limit=Number(process.argv.find(a=>a.startsWith('--limit='))?.slice(8)||Infinity);
 const result=await transferProductImages(getPool(),preview?null:configureCloudinary(),{preview,concurrency,limit});
 console.log(JSON.stringify(result));
 if(preview)console.log('Це перегляд без змін. Для перенесення: npm run cloudinary:migrate -- --apply');
 if(result.failed)process.exitCode=1;
}catch(error){
 console.error('Перенесення зупинено. Уже збережені фото залишаються; команду можна повторити. Код:',error.error?.code||error.code||error.http_code||'CONFIG_ERROR');
 if(error.code==='42P01')console.error('Спочатку виконайте npm run db:migrate.');
 process.exitCode=1;
}finally{await closePool();}
