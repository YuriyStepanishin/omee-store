import type { CatalogResponse, CheckoutPayload, Product } from '@/types/store';
import { http } from './http';
export const fetchCatalog = async () => (await http.get<CatalogResponse>('/catalog')).data;
export interface CatalogPageResponse { products: Product[]; page: number; limit: number; total: number; pages: number; }
export const fetchCatalogPage = async (page = 1, limit = 24) => (await http.get<CatalogPageResponse>('/catalog-page', { params: { page, limit } })).data;
export const fetchProduct = async (id: string) => (await http.get<Product>(`/catalog/${encodeURIComponent(id)}`)).data;
export const fetchStoreInfo = async () => (await http.get<Pick<CatalogResponse,'info'>>('/store-info')).data;
export const checkoutOrder = async (payload: CheckoutPayload) => (await http.post<{
    orderId: string;
    status: string;
    amount: number;
    message: string;
}>('/orders', payload)).data;
