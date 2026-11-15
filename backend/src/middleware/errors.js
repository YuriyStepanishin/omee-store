import {databaseUnavailable} from '../utils/databaseErrors.js';
export function notFound(req,res){res.status(404).json({message:'Маршрут не знайдено.'});}
export function errorHandler(error,req,res,next){
 const unavailable=databaseUnavailable(error);
 if(unavailable){console.error('Upstream connection unavailable:',unavailable);error=Object.assign(new Error('Сервіс тимчасово недоступний. Спробуйте ще раз за кілька секунд.'),{status:503});}
 if(error.code==='42P01')error=Object.assign(new Error('Оновіть базу даних: npm run db:migrate.'),{status:503});
 if(error.code==='23505')error=Object.assign(new Error('Такий slug, артикул або запис уже існує.'),{status:409});
 if(error.code==='23503')error=Object.assign(new Error('Обрана категорія не існує.'),{status:400});
 if(error.code==='LIMIT_FILE_SIZE')error=Object.assign(new Error('Файл завеликий. Максимум 5 МБ для фото та 25 МБ для відео.'),{status:413});
 if(error.name==='MulterError')error=Object.assign(new Error('Завантажте одне фото у полі image.'),{status:400});
 const status=Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500;
 if(status===500) console.error('Request failed:',error.code || error.name);
 res.status(status).json({message:status===500?'Сервер не зміг обробити запит. Спробуйте пізніше.':status===413?'Запит завеликий.':status===400&&error.type==='entity.parse.failed'?'Некоректний JSON.':error.message});
}
