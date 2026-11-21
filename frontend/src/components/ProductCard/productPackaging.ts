import type { Product, ProductVariant } from '@/types/store';

const labels: Record<string, string> = { ml: 'мл', l: 'л', g: 'г', kg: 'кг' };
const format = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 6 });

export function packagingLabel(variant: ProductVariant) {
  return variant.volume == null || !variant.unit
    ? 'Стандартне фасування'
    : `${format.format(variant.volume)} ${labels[variant.unit] ?? variant.unit}`;
}

export function availableVariants(product: Product) {
  return (product.variants ?? []).filter(variant => variant.isActive).sort((a, b) => {
    const scaled = (v: ProductVariant) => (v.volume ?? Infinity) * (v.unit === 'l' || v.unit === 'kg' ? 1000 : 1);
    return scaled(a) - scaled(b) || a.id.localeCompare(b.id);
  });
}

export function withPackaging(product: Product, variant?: ProductVariant): Product {
  return variant ? {
    ...product,
    price: variant.price,
    oldPrice: variant.oldPrice,
    stock: variant.stock,
    sku: variant.sku,
    isPublished: product.isPublished === true && variant.isActive,
  } : product;
}
