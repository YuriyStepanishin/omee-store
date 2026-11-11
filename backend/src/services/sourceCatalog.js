import { createHash } from 'node:crypto';

export function normalizeSource(row, file) {
  if (!row || typeof row.title !== 'string' || !row.title.trim()) throw Error('Missing product title');
  const url = new URL(row.url);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Invalid source URL');
  const key = createHash('sha256').update(row.url).digest('hex').slice(0, 24);
  const currency = row.priceCurrency || (/грн|UAH|₴/i.test(String(row.price)) ? 'UAH' : 'UNKNOWN');
  const raw = String(row.price ?? '').trim();
  const numeric = raw ? Number(raw.replace(/\s/g, '').replace(',', '.').replace(/грн\.?|UAH|₴/gi, '')) : null;
  const price = currency === 'UAH' && Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
  if (price >= 1e10) throw Error('Price exceeds database limit');
  const images = [...new Set((row.images || []).filter(value => {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }
    catch { return false; }
  }))];
  return {
    key, sku: 'IMPORT-' + key, name: Array.from(row.title.trim()).slice(0, 240).join(''),
    brand: row.brand || 'Import', description: row.productDescription || row.description || '', price, images,
    characteristics: { ...row.characteristics, brand: row.brand || 'Import', sourceUrl: row.url,
      sourcePrice: row.sourcePrice ?? row.price, sourceCurrency: currency, sourceFile: file, sourceData: row },
  };
}

// Preserve shop-managed fields and existing images. Source URL identifies a card;
// manufacturer SKUs can represent different pack sizes and must not be merged.
export async function importSourceCatalog(client, records, { apply = false } = {}) {
  const summary = { total: records.length, inserted: 0, enriched: 0, imagesAdded: 0, applied: apply };
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('catalog-source-import'))");
    for (const row of records) {
      const found = await client.query(
        "SELECT id FROM products WHERE sku=$1 OR characteristics->>'sourceUrl'=$2 OR characteristics->'sourceData'->>'url'=$2",
        [row.sku, row.characteristics.sourceUrl]);
      if (found.rowCount > 1) throw Error('Ambiguous existing source URL');
      let id = found.rows[0]?.id;
      if (id) {
        await client.query('UPDATE products SET characteristics=characteristics || $2::jsonb WHERE id=$1',
          [id, JSON.stringify(row.characteristics)]);
        summary.enriched++;
      } else {
        const slug = 'import-' + createHash('sha256').update(row.brand).digest('hex').slice(0, 12);
        const category = await client.query(
          'INSERT INTO categories(name,slug) VALUES($1,$2) ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id',
          [row.brand, slug]);
        const result = await client.query(
          'INSERT INTO products(category_id,name,slug,description,price,stock,sku,is_active,characteristics) VALUES($1,$2,$3,$4,$5,0,$6,false,$7) RETURNING id',
          [category.rows[0].id, row.name, 'import-' + row.key, row.description, row.price, row.sku, JSON.stringify(row.characteristics)]);
        id = result.rows[0].id; summary.inserted++;
      }
      const existing = await client.query('SELECT image_url FROM product_images WHERE product_id=$1', [id]);
      const urls = new Set(existing.rows.map(x => x.image_url));
      const order = await client.query('SELECT COALESCE(MAX(sort_order),-1) AS last FROM product_images WHERE product_id=$1', [id]);
      let last = order.rows[0].last;
      for (const source of row.images) {
        const receipt = await client.query('SELECT image_url FROM cloudinary_imports WHERE source_url=$1', [source]);
        const target = receipt.rows[0]?.image_url || source;
        if (urls.has(source) || urls.has(target)) continue;
        await client.query('INSERT INTO product_images(product_id,image_url,sort_order) VALUES($1,$2,$3)', [id, target, ++last]);
        urls.add(target); summary.imagesAdded++;
      }
    }
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    return summary;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
