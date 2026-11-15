'use client';
import {useEffect} from 'react';
import {restoreSession} from '@/services/auth';
import {useAuthStore} from '@/store/auth';
import {useCartStore} from '@/store/cart';
export default function SessionBootstrap(){const setSession=useAuthStore(s=>s.setSession);useEffect(()=>{let active=true;Promise.resolve(useCartStore.persist.rehydrate()).then(()=>restoreSession()).then(user=>{if(active)setSession(user);}).catch(()=>{if(active)setSession(null,'Не вдалося перевірити сесію. Перевірте підключення до сервера.');});return ()=>{active=false;};},[setSession]);return null;}
