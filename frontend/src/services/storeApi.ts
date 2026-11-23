import type { CatalogResponse, CheckoutPayload, Product } from '@/types/store';
import { http } from './http';
export const fetchCatalog = async () => (await http.get<CatalogResponse>('/catalog', {params:{lightweight:1}})).data;
export interface CatalogPageResponse { products: Product[]; page: number; limit: number; total: number; pages: number; }
export interface CatalogPageFilters {page:number;limit?:number;search?:string;brand?:string;category?:string;line?:string;sort?:string;}
export const fetchCatalogFacets = async () => (await http.get<{categories:string[];brands:string[]}>('/catalog-facets')).data;
export const fetchCatalogPage = async (params:CatalogPageFilters) => (await http.get<CatalogPageResponse>('/catalog-page', { params })).data;
export const fetchProduct = async (id: string) => (await http.get<Product>(`/catalog/${encodeURIComponent(id)}`)).data;
export const fetchStoreInfo = async () => (await http.get<Pick<CatalogResponse,'info'>>('/store-info')).data;
export const checkoutOrder = async (payload: CheckoutPayload) => (await http.post<{
    orderId: string;
    status: string;
    amount: number;
    message: string;
}>('/orders', payload)).data;
