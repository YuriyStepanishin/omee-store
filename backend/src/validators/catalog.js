import {z} from 'zod';
const slug=z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'Slug: латинські літери, цифри та дефіс.');
const image=z.string().url('Вкажіть URL зображення.').max(2000).refine(value=>{try{return new URL(value).protocol==='https:';}catch{return false;}},'Зображення повинне використовувати HTTPS.');
export const categorySchema=z.object({name:z.string().trim().min(2).max(120),slug,image:image.or(z.literal('')).default(''),isActive:z.boolean().default(true)}).strict();
const price=z.number().finite().min(0).max(9999999999.99).refine(value=>Math.abs(value*100-Math.round(value*100))<0.0001,'Ціна: максимум два знаки після коми.');
export const productSchema=z.object({categoryId:z.string().uuid(),brandId:z.string().uuid().nullable().optional(),name:z.string().trim().min(2).max(240),slug,description:z.string().max(12000).default(''),price,oldPrice:price.nullable().default(null),stock:z.number().int().min(0).max(1000000),sku:z.string().trim().min(1).max(100),isActive:z.boolean().default(false),images:z.array(image).max(8).default([]),characteristics:z.record(z.string().max(80),z.string().max(500)).default({})}).strict().refine(value=>value.oldPrice===null||value.oldPrice>=value.price,{message:'Стара ціна не може бути нижчою за поточну.',path:['oldPrice']});
export const listSchema=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(100).default(20),q:z.string().trim().max(200).default(''),category:z.string().uuid().optional(),sort:z.enum(['newest','price_asc','price_desc','name']).default('newest')});
export function validate(schema,value){const result=schema.safeParse(value);if(!result.success)throw Object.assign(new Error(result.error.issues[0]?.message||'Перевірте введені дані.'),{status:400});return result.data;}
export function validateId(id){return validate(z.string().uuid(),id);}

export const audienceSchema=z.object({audience:z.enum(['women','men','kids'])}).strict();
