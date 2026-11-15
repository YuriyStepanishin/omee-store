'use client';
import {create} from 'zustand';
import type {SessionUser} from '@/services/auth';
import {useCartStore} from './cart';
interface AuthState {user:SessionUser|null;loaded:boolean;error:string;setSession:(user:SessionUser|null,error?:string)=>void;}
export const useAuthStore=create<AuthState>(set=>({user:null,loaded:false,error:'',setSession:(user,error='')=>{useCartStore.getState().prepareOwner(user?.id||null);set({user,loaded:true,error});}}));
