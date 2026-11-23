import type {DeliveryCarrier,DeliveryType} from '@/constants/delivery';
export type ProductCategory = string;
export interface ProductBadge { label: string; background: string; color: string; }
export interface ProductVariant { id:string; sourceProductId:string; volume:number|null; unit:string|null; price:number; oldPrice:number|null; stock:number; sku:string; isActive:boolean; }
export interface Product {
    variants?: ProductVariant[];
    id: string;
    title: string;
    sku: string;
    category: ProductCategory;
    audience?: 'hair'|'body'|'other'|'women'|'men'|'kids';
    brand?: string;
    group?: string;
    groups?: string[];
    subcategory?: string;
    characteristics?: Record<string,string>;
    details?: Array<{label:string;text:string}>;
    price: number;
    oldPrice?: number | null;
    stock?: number;
    isNew?: boolean;
    isHit?: boolean;
    badges?: ProductBadge[];
    description: string;
    image: string;
    images?: string[];
    isPublished?: boolean;
}
export interface MediaItem {
    source?: {key?:string;provider?:string;page?:string;date?:string;author?:string;language?:string;description?:string;license?:string;licenseUrl?:string} | null;
    id: string;
    title: string;
    url: string;
    cover: string;
    type: 'video' | 'photo';
}
export interface StoryArticle {
    slug?: string;
    id: string;
    title: string;
    excerpt: string;
    date: string;
}
export interface BrandInfo {
    heading: string;
    description: string;
    points: string[];
    phone?: string;
    email?: string;
    instagram?: string;
    address?: string;
    announcement?: string;
}
export interface CatalogResponse {
    categories?: Array<{id:string;name:string;slug:string}>;
    banners?: Array<{id:string;title:string;imageUrl:string;link:string}>;
    demo?: boolean;
    preview?: boolean;
    products: Product[];
    media: MediaItem[];
    blog: StoryArticle[];
    info: BrandInfo;
}
export interface UserProfile {
    id: string;
    name: string;
    email: string;
}
export interface AuthPayload {
    name: string;
    email: string;
    password: string;
}
export interface CartItem {
    productId: string;
    qty: number;
}
export interface PaymentPayload {
    fullName: string;
    phone: string;
    email: string;
    city: string;
    address: string;
    method: 'on_confirmation';
    deliveryCarrier?: DeliveryCarrier;
    deliveryType?: DeliveryType;
}
export interface CheckoutPayload {
    items: Array<{
        productId: string;
        qty: number;
    }>;
    payment: Omit<PaymentPayload, 'deliveryCarrier' | 'deliveryType'> & {
        deliveryCarrier?: DeliveryCarrier | 'pickup';
        deliveryType?: DeliveryType | 'pickup';
    };
}
