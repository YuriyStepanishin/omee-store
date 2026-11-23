import type { CatalogResponse, CheckoutPayload, Product } from '@/types/store';
import { http } from './http';
export const fetchCatalog = async () => (await http.get<CatalogResponse>('/catalog')).data;
export const fetchProduct = async (id: string) => (await http.get<Product>(`/catalog/${encodeURIComponent(id)}`)).data;
export const fetchStoreInfo = async () => (await http.get<Pick<CatalogResponse,'info'>>('/store-info')).data;
export const checkoutOrder = async (payload: CheckoutPayload) => (await http.post<{
    orderId: string;
    status: string;
    amount: number;
    message: string;
}>('/orders', payload)).data;
