import {z} from 'zod';
const slug=z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'Slug: латинські літери, цифри та дефіс.');
const image=z.string().url('Вкажіть URL зображення.').max(2000).refine(value=>{try{return new URL(value).protocol==='https:';}catch{return false;}},'Зображення повинне використовувати HTTPS.');
export const categorySchema=z.object({name:z.string().trim().min(2).max(120),slug,image:image.or(z.literal('')).default(''),isActive:z.boolean().default(true)}).strict();
const price=z.number().finite().min(0).max(9999999999.99).refine(value=>Math.abs(value*100-Math.round(value*100))<0.0001,'Ціна: максимум два знаки після коми.');
const variantFields = {
  price,
  oldPrice: price.nullable().default(null),
  stock: z.number().int().min(0).max(1000000),
  sku: z.string().trim().min(1).max(100),
};
const validOldPrice = value => value.oldPrice === null || value.oldPrice >= value.price;
const oldPriceError = { message: 'Стара ціна не може бути нижчою за поточну.', path: ['oldPrice'] };
const sizeUnits = ['ml', 'l', 'g', 'kg'];
const productAudience = z.enum(['hair', 'body', 'other']);
const variantSchema = z.object({
  id: z.string().uuid().optional(),
  volume: z.number().positive().max(1_000_000).nullable(),
  unit: z.enum(sizeUnits).nullable(),
  isActive: z.boolean().default(true),
  ...variantFields,
}).strict().refine(validOldPrice, oldPriceError).refine(
  value => (value.volume === null) === (value.unit === null),
  { message: 'Вкажіть об’єм або вагу та одиницю виміру.', path: ['volume'] }
);

export const productBadgeSchema=z.object({
  label:z.string().trim().min(1).max(28),
  background:z.string().regex(/^#[0-9a-fA-F]{6}$/,'Оберіть колір фону.'),
  color:z.string().regex(/^#[0-9a-fA-F]{6}$/,'Оберіть колір тексту.'),
}).strict();
export const productSchema = z.object({
  categoryId: z.string().uuid(),
  brandId: z.string().uuid().nullable().optional(),
  audience: productAudience.optional(),
  name: z.string().trim().min(2).max(240),
  slug,
  description: z.string().max(12000).default(''),
  ...variantFields,
  isActive: z.boolean().default(false),
  images: z.array(image).max(8).default([]),
  characteristics: z.record(z.string().max(80), z.string().max(500)).default({}),
  badges: z.array(productBadgeSchema).max(4).default([]),
  variants: z.array(variantSchema).min(1).max(40).optional(),
}).strict().refine(validOldPrice, oldPriceError).superRefine((value, ctx) => {
  if (!value.variants) return;
  if (value.isActive && !value.variants.some(variant => variant.isActive)) {
    ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Для публікації увімкніть хоча б одне фасування.' });
  }
  const ids = new Set();
  const skus = new Set();
  const sizes = new Set();
  for (const [index, variant] of value.variants.entries()) {
    const { id, sku, volume, unit } = variant;
    const baseUnit = { l: 'ml', kg: 'g' }[unit] ?? unit;
    const baseSize = volume === null ? null : Number((volume * (unit === baseUnit ? 1 : 1000)).toPrecision(12));
    const size = `${baseUnit}:${baseSize}`;
    const duplicate = (id && ids.has(id)) || skus.has(sku) || (variant.isActive && sizes.has(size));
    if (duplicate || (value.variants.length > 1 && variant.isActive && volume === null)) {
      ctx.addIssue({ code: 'custom', path: ['variants', index], message: duplicate
        ? 'Артикули й розміри доступних фасувань мають бути унікальними.'
        : 'Для кожного доступного фасування вкажіть об’єм або вагу.' });
    }
    if (id) ids.add(id);
    skus.add(sku);
    if (variant.isActive) sizes.add(size);
  }
});
export const listSchema=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(100).default(20),q:z.string().trim().max(200).default(''),category:z.string().uuid().optional(),sort:z.enum(['newest','price_asc','price_desc','name']).default('newest')});
export const adminProductListSchema = listSchema.extend({
  brand: z.string().uuid().optional(),
  status: z.enum(['published', 'unpublished']).optional(),
});
export function validate(schema,value){const result=schema.safeParse(value);if(!result.success)throw Object.assign(new Error(result.error.issues[0]?.message||'Перевірте введені дані.'),{status:400});return result.data;}
export function validateId(id){return validate(z.string().uuid(),id);}

export const audienceSchema=z.object({audience:productAudience}).strict();
