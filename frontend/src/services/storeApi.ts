import type { CatalogResponse, CheckoutPayload } from '@/types/store';
import { http } from './http';
export const fetchCatalog = async () => (await http.get<CatalogResponse>('/catalog')).data;
export const fetchStoreInfo = async () => (await http.get<Pick<CatalogResponse,'info'>>('/store-info')).data;
export const checkoutOrder = async (payload: CheckoutPayload) => (await http.post<{
    orderId: string;
    status: string;
    amount: number;
    message: string;
}>('/orders', payload)).data;

export const fetchAdminCatalog = async () => (await http.get<CatalogResponse>('/admin/catalog')).data;
