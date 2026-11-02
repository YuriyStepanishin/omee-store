import { http } from './http';
export const statusLabels = {
  NEW: 'Нове',
  PROCESSING: 'В обробці',
  PAID: 'Оплачено',
  SHIPPED: 'Відправлено',
  DELIVERED: 'Доставлено',
  CANCELED: 'Скасовано',
} as const;
export type OrderStatus = keyof typeof statusLabels;
export const transitions: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['PROCESSING', 'CANCELED'],
  PROCESSING: ['PAID', 'SHIPPED', 'CANCELED'],
  PAID: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELED: [],
};
export interface Order {
  id: string;
  status: OrderStatus;
  total: string;
  deliveryMethod: string;
  paymentMethod: string;
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
