import {http} from './http';
import type {Product} from '@/types/store';
export interface CustomerOrder {
  id:string;status:string;total:string;createdAt:string;deliveryMethod:string;city:string;address:string;
  items:{name:string;sku:string;quantity:number;price:string}[];
}
export const fetchMyOrders=async(page:number)=>(await http.get<{items:CustomerOrder[];page:number;limit:number}>('/account/orders',{params:{page}})).data;
export const fetchFavorites=async(page:number)=>(await http.get<{items:Product[];page:number;limit:number}>('/account/favorites',{params:{page}})).data;
