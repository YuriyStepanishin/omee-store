import { isAxiosError } from 'axios';
import { http } from './http';
export interface SessionUser {id:string;name:string;email:string;phone:string|null;role:'CUSTOMER'|'MANAGER'|'ADMIN';}
export interface Credentials {email:string;password:string;name?:string;confirmPassword?:string;}
export async function login(data:Credentials){return (await http.post<{user:SessionUser}>('/auth/login',{email:data.email,password:data.password})).data.user;}
export async function register(data:Credentials){return (await http.post<{user:SessionUser}>('/auth/register',data)).data.user;}
export async function logout(){await http.post('/auth/logout');}
let restore:Promise<SessionUser|null>|undefined;
export function restoreSession(){if(!restore)restore=(async()=>{try{return (await http.get<{user:SessionUser}>('/auth/me')).data.user;}catch(error){if(!isAxiosError(error)||error.response?.status!==401)throw error;try{return (await http.post<{user:SessionUser}>('/auth/refresh')).data.user;}catch(refreshError){if(isAxiosError(refreshError)&&refreshError.response?.status===401)return null;throw refreshError;}}})().finally(()=>{restore=undefined;});return restore;}
