import { z } from 'zod';
export const orderStatuses = [
  'NEW',
  'PROCESSING',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'CANCELED',
];
export const orderTransitions = {
  NEW: ['PROCESSING', 'CANCELED'],
  PROCESSING: ['PAID', 'SHIPPED', 'CANCELED'],
  PAID: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELED: [],
};
export const orderListSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  status: z.enum(orderStatuses).optional(),
});
export const orderUpdateSchema = z
  .object({
    status: z.enum(orderStatuses),
    expectedStatus: z.enum(orderStatuses),
    comment: z.string().trim().max(2000),
    city: z.string().trim().min(1).max(120),
    address: z.string().trim().min(1).max(300),
  })
  .strict();
const source = z
  .object({
    title: z.string().trim().min(1).max(240),
    url: z
      .string()
      .url()
      .max(2000)
      .refine(v => v.startsWith('https://')),
    accessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
export const articleSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(2).max(240),
    excerpt: z.string().trim().min(2).max(2000),
    body: z.string().trim().min(2).max(20000),
    category: z.string().trim().min(1).max(120),
    author: z.string().trim().min(1).max(120),
    seoTitle: z.string().trim().min(1).max(160),
    seoDescription: z.string().trim().min(1).max(320),
    sources: z.array(source).max(10),
    status: z.enum(['draft', 'published']),
  })
  .strict();
