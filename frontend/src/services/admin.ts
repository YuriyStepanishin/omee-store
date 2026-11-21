import { http } from './http';
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/constants/order';
export { statusLabels } from '@/constants/order';

const transitions: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['PROCESSING', 'CANCELED'],
  PROCESSING: ['PACKED', 'SHIPPED', 'READY_FOR_PICKUP', 'CANCELED'],
  PAID: ['PACKED', 'SHIPPED', 'READY_FOR_PICKUP'],
  PACKED: ['SHIPPED', 'READY_FOR_PICKUP', 'CANCELED'],
  SHIPPED: ['DELIVERED'],
  READY_FOR_PICKUP: ['DELIVERED', 'CANCELED'],
  DELIVERED: [],
  CANCELED: [],
};
export function orderTransitions(status: OrderStatus, deliveryMethod: string) {
  return transitions[status].filter(next => deliveryMethod === 'pickup' ? next !== 'SHIPPED' : next !== 'READY_FOR_PICKUP');
}

export interface Order {
  id: string;
  status: OrderStatus;
  total: string;
  deliveryMethod: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  trackingNumber: string | null;
  updatedAt: string;
  comment: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  city: string;
  address: string;
  createdAt: string;
}
export interface OrderDetail extends Order {
  items: Array<{
    productId: string;
    name: string;
    sku: string;
    price: string;
    quantity: number;
  }>;
}
export const getOrders = async (page: number, status: string) =>
  (
    await http.get<{
      items: Order[];
      total: number;
      page: number;
      limit: number;
    }>('/admin/orders', { params: { page, status: status || undefined } })
  ).data;
export const getOrder = async (id: string) =>
  (await http.get<OrderDetail>('/admin/orders/' + id)).data;
export const updateOrder = (
  id: string,
  data: {
    status: OrderStatus;
    expectedStatus: OrderStatus;
    expectedUpdatedAt: string;
    paymentStatus: PaymentStatus;
    paymentMethod?: PaymentMethod;
    trackingNumber?: string | null;
    comment: string;
    city: string;
    address: string;
  }
) => http.put('/admin/orders/' + id, data);
export interface ArticleInput {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  author: string;
  seoTitle: string;
  seoDescription: string;
  sources: Array<{ title: string; url: string; accessedAt: string }>;
  media: Array<{type:'photo'|'video';url:string;caption:string}>;
  status: 'draft' | 'published';
}
export interface AdminArticle extends ArticleInput {
  id: string;
}
export const getAdminArticles = async () =>
  (
    await http.get<
      Array<Pick<AdminArticle, 'id' | 'slug' | 'title' | 'category' | 'status'>>
    >('/admin/articles')
  ).data;
export const getAdminArticle = async (id: string) =>
  (await http.get<AdminArticle>('/admin/articles/' + id)).data;
export const saveArticle = (data: ArticleInput, id?: string) =>
  id
    ? http.put('/admin/articles/' + id, data)
    : http.post('/admin/articles', data);
export const deleteArticle = (id: string) =>
  http.delete('/admin/articles/' + id);
