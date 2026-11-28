import type { ProductBadge, ProductVariant } from '@/types/store';
import type { ProductLine } from '@/constants/productLines';
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
  audience?: ProductLine;
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
  badges: ProductBadge[];
  variants?: Array<Omit<ProductVariant, 'id' | 'sourceProductId'> & {id?: string}>;
}
export interface AdminProduct extends ProductInput {
  id: string;
  variants?: ProductVariant[];
  categoryName: string;
  categorySlug?: string;
  brand?: string;
}
export interface ProductList {
  items: AdminProduct[];
  total: number;
  page: number;
  limit: number;
}
export type ProductPublicationStatus = 'published' | 'unpublished';
export const getCategories = async () =>
  (await http.get<Category[]>('/admin/categories')).data;
export const saveCategory = async (data: Omit<Category, 'id'>, id?: string) =>
  id ? http.put('/categories/' + id, data) : http.post('/categories', data);
export const archiveCategory = (id: string) => http.delete('/categories/' + id);
export const getProducts = async (params: {
  page: number;
  q: string;
  category?: string;
  brand?: string;
  status?: ProductPublicationStatus;
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

export const deleteProduct = (id: string) =>
  http.delete('/admin/products/' + id);

export const getBrands = async () => (await http.get<Category[]>('/admin/brands')).data;
export const saveBrand = (data: Omit<Category, 'id'>, id?: string) => id ? http.put('/admin/brands/' + id, data) : http.post('/admin/brands', data);
export const archiveBrand = (id: string) => http.delete('/admin/brands/' + id);
export const setProductPublication=(id:string,isActive:boolean)=>http.patch('/admin/products/'+id+'/publication',{isActive});
