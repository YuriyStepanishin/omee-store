import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogRepository } from '../src/models/catalogAdmin.js';
import { productSchema } from '../src/validators/catalog.js';

const categoryId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const firstId = '33333333-3333-4333-8333-333333333333';
const secondId = '44444444-4444-4444-8444-444444444444';
const childId = '55555555-5555-4555-8555-555555555555';
const first = { volume: 200, unit: 'g', price: 400, oldPrice: null, stock: 0, sku: 'MASK-200', isActive: true };
const second = { ...first, volume: 500, price: 850, sku: 'MASK-500' };
const data = { categoryId, name: 'Маска', slug: 'mask', ...first, isActive: false };
const { volume, unit, ...fields } = data;

function mockRepo(existing = []) {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT id,name,slug')) return { rows: [{ id: categoryId }] };
      if (sql.startsWith('SELECT characteristics')) return { rows: [{ characteristics: {} }] };
      if (sql.startsWith('SELECT id,product_id')) return { rows: existing };
      if (sql.includes('RETURNING id')) return { rows: [{ id: productId }] };
      return { rows: [] };
    },
    release() {},
  };
  return { calls, repo: catalogRepository({ async connect() { return client; } }) };
}

test('admin creates one card with two weight variants and keeps each price on its own SKU', async () => {
  const { calls, repo } = mockRepo();
  await repo.saveProduct(productSchema.parse({ ...fields, variants: [first, second] }));
  const variants = calls.filter(call => call.sql.includes('INSERT INTO product_variants'));
  assert.equal(variants.length, 2);
  assert.deepEqual(variants[0].params, [productId, productId, 200, 'g', 400, null, 0, 'MASK-200', true]);
  const sourceId = variants[1].params[1];
  assert.notEqual(sourceId, productId);
  assert.deepEqual(variants[1].params, [productId, sourceId, 500, 'g', 850, null, 0, 'MASK-500', true]);
  assert.equal(calls.at(-1).sql, 'COMMIT');
});

test('editing a variant keeps its cart identifier and rejects identifiers from other products', async () => {
  const existing = [
    { id: firstId, product_id: productId, source_product_id: productId },
    { id: secondId, product_id: productId, source_product_id: childId },
  ];
  const { calls, repo } = mockRepo(existing);
  await repo.saveProduct(productSchema.parse({
    ...fields, variants: [{ ...first, id: firstId }, { ...second, id: secondId, price: 990 }],
  }), productId);
  const variant = calls.filter(call => call.sql.includes('INSERT INTO product_variants')).at(-1);
  assert.deepEqual(variant.params.slice(0, 5), [productId, childId, 500, 'g', 990]);

  const stale = mockRepo(existing);
  await assert.rejects(stale.repo.saveProduct(productSchema.parse({
    ...fields, variants: [{ ...first, id: firstId }, { ...second, id: childId }],
  }), productId), { status: 409 });
  assert.equal(stale.calls.at(-1).sql, 'ROLLBACK');
});

test('equivalent sizes in different units are treated as duplicates', () => {
  assert.equal(productSchema.safeParse({
    ...fields, variants: [{ ...first, volume: 1000, unit: 'ml' }, { ...second, volume: 1, unit: 'l' }],
  }).success, false);
});
