import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSource, importSourceCatalog } from '../src/services/sourceCatalog.js';
const card = { title: 'Shampoo', url: 'https://example.com/shampoo', brand: 'Example' };
test('imports cards with missing and foreign prices as unpublished-ready zero values', () => {
  for (const price of [undefined, null, '']) assert.equal(normalizeSource({ ...card, price }, 'a.json').price, 0);
  const foreign = normalizeSource({ ...card, price: '42.99', priceCurrency: 'USD' }, 'a.json');
  assert.equal(foreign.price, 0); assert.equal(foreign.characteristics.sourceCurrency, 'USD');
  assert.equal(foreign.characteristics.sourceData.price, '42.99');
});
test('accepts explicit UAH currency and decimal commas', () => {
  assert.equal(normalizeSource({ ...card, price: '1 234,50', priceCurrency: 'UAH' }, 'a.json').price, 1234.5);
});
test('Cotril locale aliases share a product slug and recover the published source name', () => {
  const row = normalizeSource({ ...card, title: 'Cotril', brand: 'Cotril', url: 'https://cotril.it/prodotto/mud/', sourceData: { name: 'Mud' } }, 'cotril.json');
  assert.equal(row.name, 'Mud');
  assert.deepEqual(row.sourceUrls, ['https://cotril.it/prodotto/mud/', 'https://cotril.it/en/prodotto/mud/']);
  assert.equal(row.characteristics.sourceData.title, 'Cotril');
});
test('separates pack URLs even with matching manufacturer SKU', () => {
  const a = normalizeSource({ ...card, sku: 'same' }, 'a.json');
  const b = normalizeSource({ ...card, sku: 'same', url: card.url + '-box' }, 'a.json');
  assert.notEqual(a.sku, b.sku);
});
test('preserves full title in source data, validates URLs and deduplicates images', () => {
  const row = normalizeSource({ ...card, title: 'A'.repeat(300), images: ['https://example.com/a.jpg', 'https://example.com/a.jpg', 'javascript:bad'] }, 'a.json');
  assert.equal(row.name.length, 240); assert.equal(row.characteristics.sourceData.title.length, 300);
  assert.equal(row.images.length, 1);
  assert.throws(() => normalizeSource({ ...card, url: 'http://example.com' }, 'a.json'));
});

function database({ exists = true, imagePresent = false, fail = false } = {}) {
  const calls = [];
  return { calls, async query(sql, args) {
    calls.push({ sql, args });
    if (sql.startsWith('SELECT id FROM products')) return { rows: exists ? [{ id: 'product' }] : [], rowCount: exists ? 1 : 0 };
    if (sql.startsWith('INSERT INTO categories')) return { rows: [{ id: 'category' }] };
    if (sql.startsWith('INSERT INTO products')) return { rows: [{ id: 'product' }] };
    if (sql.startsWith('SELECT image_url FROM product_images')) return { rows: imagePresent ? [{ image_url: 'https://res.cloudinary.com/store/saved.png' }] : [] };
    if (sql.startsWith('SELECT COALESCE')) return { rows: [{ last: -1 }] };
    if (sql.startsWith('SELECT image_url FROM cloudinary_imports')) return { rows: [{ image_url: 'https://res.cloudinary.com/store/saved.png' }] };
    if (fail && sql.startsWith('INSERT INTO product_images')) throw Error('Image insert failed');
    return { rows: [], rowCount: 1 };
  } };
}
const withImage = () => normalizeSource({ ...card, price: '100 грн', images: ['https://example.com/a.jpg'] }, 'a.json');
test('enrichment preserves managed product fields and reuses migrated images on rerun', async () => {
  const db = database({ imagePresent: true });
  const result = await importSourceCatalog(db, [withImage()], { apply: true });
  assert.equal(result.enriched, 1); assert.equal(result.imagesAdded, 0);
  assert.ok(!db.calls.some(c => c.sql.startsWith('INSERT INTO products')));
  const update = db.calls.find(c => c.sql.startsWith('UPDATE products'));
  assert.equal(update.sql, 'UPDATE products SET characteristics=characteristics || $2::jsonb WHERE id=$1');
  assert.equal(db.calls.at(-1).sql, 'COMMIT');
});
test('new cards are unpublished with no stock and use existing Cloudinary receipts', async () => {
  const db = database({ exists: false });
  const result = await importSourceCatalog(db, [withImage()], { apply: true });
  assert.equal(result.inserted, 1); assert.equal(result.imagesAdded, 1);
  assert.match(db.calls.find(c => c.sql.startsWith('INSERT INTO products')).sql, /0,\$6,false/);
  assert.equal(db.calls.find(c => c.sql.startsWith('INSERT INTO product_images')).args[1], 'https://res.cloudinary.com/store/saved.png');
});
test('preview and partial failures roll back the complete import', async () => {
  const db = database(); await importSourceCatalog(db, [withImage()]);
  assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
  const broken = database({ fail: true });
  await assert.rejects(importSourceCatalog(broken, [withImage()], { apply: true }));
  assert.equal(broken.calls.at(-1).sql, 'ROLLBACK');
  assert.ok(!broken.calls.some(c => c.sql === 'COMMIT'));
});
