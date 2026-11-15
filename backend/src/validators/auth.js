import {z} from 'zod';
const email=z.string().trim().email('Вкажіть коректний email.').max(254).transform(value=>value.toLowerCase());
const password=z.string().min(8,'Пароль має містити щонайменше 8 символів.').refine(value=>Buffer.byteLength(value,'utf8')<=72,'Пароль завеликий. Максимум 72 байти.');
export const registerSchema=z.object({name:z.string().trim().min(2,'Вкажіть ім’я.').max(120),email,password,confirmPassword:z.string(),phone:z.string().trim().max(25).optional()}).strict().refine(data=>data.password===data.confirmPassword,{message:'Паролі не збігаються.',path:['confirmPassword']});
export const changePasswordSchema=z.object({currentPassword:z.string().min(1).refine(value=>Buffer.byteLength(value,'utf8')<=72),password,confirmPassword:z.string()}).strict().refine(data=>data.password===data.confirmPassword,{message:'Паролі не збігаються.',path:['confirmPassword']});
export const loginSchema=z.object({email,password:z.string().min(1).refine(value=>Buffer.byteLength(value,'utf8')<=72)}).strict();
export const forgotSchema=z.object({email}).strict();
export const resetSchema=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password}).strict();
export function parseAuth(schema,body){const result=schema.safeParse(body);if(!result.success)throw Object.assign(new Error(result.error.issues[0]?.message||'Перевірте введені дані.'),{status:400});return result.data;}
