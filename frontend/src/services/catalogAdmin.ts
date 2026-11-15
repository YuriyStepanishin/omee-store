import { http } from './http';
import { uploadToCloudinary } from './cloudinaryUpload';
export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  isActive: boolean;
}
export interface ProductInput {
  brandId?: string | null;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  sku: string;
  isActive: boolean;
  images: string[];
  characteristics: Record<string, string>;
}
export interface AdminProduct extends ProductInput {
  id: string;
  categoryName: string;
  categorySlug?: string;
  brand?: string;
  audience?: 'women' | 'men' | 'kids';
}
export interface ProductList {
  items: AdminProduct[];
  total: number;
  page: number;
  limit: number;
}
export const getCategories = async () =>
  (await http.get<Category[]>('/admin/categories')).data;
export const saveCategory = async (data: Omit<Category, 'id'>, id?: string) =>
  id ? http.put('/categories/' + id, data) : http.post('/categories', data);
export const archiveCategory = (id: string) => http.delete('/categories/' + id);
export const getProducts = async (params: {
  page: number;
  q: string;
  category?: string;
}) =>
  (
    await http.get<ProductList>('/admin/products', {
      params: { ...params, limit: 20 },
    })
  ).data;
export const saveProduct = (data: ProductInput, id?: string) =>
  id ? http.put('/products/' + id, data) : http.post('/products', data);
export const archiveProduct = (id: string) => http.delete('/products/' + id);
export async function uploadPhoto(file: File) {
  return uploadToCloudinary(file, 'image');
}

export const saveProductLine = (
  id: string,
  audience: 'women' | 'men' | 'kids'
) => http.put('/products/' + id + '/line', { audience });

export const deleteProduct = (id: string) =>
  http.delete('/admin/products/' + id);

export const classifyCatalogProducts = async () =>
  (
    await http.post<{
      categories: { created: number; existing: number; assigned: number; unassigned: number };
      classified: number;
      review: Array<{ id: string; name: string }>;
    }>('/admin/products/classify', {}, { timeout: 60000 })
  ).data;

export const getBrands = async () => (await http.get<Category[]>('/admin/brands')).data;
export const saveBrand = (data: Omit<Category, 'id'>, id?: string) => id ? http.put('/admin/brands/' + id, data) : http.post('/admin/brands', data);
export const archiveBrand = (id: string) => http.delete('/admin/brands/' + id);