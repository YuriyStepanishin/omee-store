import { http } from './http';
import { uploadToCloudinary } from './cloudinaryUpload';
export interface SiteInfo {
  heading: string;
  description: string;
  points: string[];
  phone: string;
  email: string;
  instagram: string;
  address: string;
  announcement: string;
}
export interface SiteMedia {
  id?: string;
  title: string;
  type: 'photo' | 'video';
  url: string;
  cover: string;
  isActive: boolean;
  sortOrder: number;
}
export interface Banner {
  id?: string;
  title: string;
  imageUrl: string;
  link: string;
  isActive: boolean;
}
export interface Promo {
  id?: string;
  code: string;
  discount: number;
  isActive: boolean;
  expiresAt: string | null;
}
export interface SiteContent {
  info: SiteInfo;
  media: SiteMedia[];
  banners: Banner[];
  promos: Promo[];
}
export const getContent = async () =>
  (await http.get<SiteContent>('/admin/content')).data;
export const saveInfo = (data: SiteInfo) =>
  http.put('/admin/content/info', data);
export const saveContent = (
  kind: 'media' | 'banners' | 'promos',
  data: SiteMedia | Banner | Promo
) => {
  const { id, ...body } = data;
  return id
    ? http.put('/admin/content/' + kind + '/' + id, body)
    : http.post('/admin/content/' + kind, body);
};
export async function uploadVideo(file: File) {
  return uploadToCloudinary(file, 'video');
}
export const setMediaPublication = (id: string, isActive: boolean) =>
  http.patch('/admin/content/media/' + id + '/publication', { isActive });
export const deleteMedia = (id: string) => http.delete('/admin/content/media/' + id);
