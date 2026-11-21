import { randomUUID } from 'node:crypto';

export const canonicalProduct = `NOT EXISTS (
  SELECT 1 FROM product_variants child WHERE child.source_product_id=p.id AND child.product_id<>p.id
) AND NOT EXISTS (
  SELECT 1 FROM product_merge_audit a WHERE a.source_product_id=p.id AND a.canonical_product_id<>p.id
)`;

export function variantJson() {
  return `COALESCE((SELECT json_agg(json_build_object(
    'id',v.id,'sourceProductId',v.source_product_id,'volume',v.volume_value,'unit',v.volume_unit,
    'price',v.price,'oldPrice',v.old_price,'stock',v.stock,'sku',v.sku,'isActive',v.is_active
  ) ORDER BY v.volume_value NULLS LAST,v.id) FROM product_variants v
    WHERE v.product_id=p.id),'[]'::json)`;
}

export function primaryVariant(variants, existing) {
  if (!variants) return null;
  const primary = existing.find(variant => variant.source_product_id === variant.product_id);
  const byId = new Map(existing.map(variant => [variant.id, variant]));
  const isInvalid = variants.some(variant => variant.id && !byId.has(variant.id));
  const primaryInput = primary ? variants.find(variant => variant.id === primary.id) : variants.find(variant => !variant.id);
  if (isInvalid || !primaryInput || existing.some(variant => !variants.some(input => input.id === variant.id))) {
    throw Object.assign(new Error('Список фасувань змінився. Оновіть товар перед збереженням.'), { status: 409 });
  }
  return primaryInput;
}

export async function saveProductVariants(client, productId, product, primary, existing) {
  const byId = new Map(existing.map(variant => [variant.id, variant]));
  for (const variant of product.variants) {
    let sourceId = variant === primary ? productId : byId.get(variant.id)?.source_product_id;
    if (!sourceId) {
      sourceId = randomUUID();
      await client.query(`INSERT INTO products
        (id,category_id,name,slug,description,price,old_price,stock,sku,is_active,brand_id)
        SELECT $2,category_id,name,$3,description,$4,$5,$6,$7,false,brand_id FROM products WHERE id=$1`,
      [productId, sourceId, `variant-${sourceId}`, variant.price, variant.oldPrice, variant.stock, variant.sku]);
    } else if (sourceId !== productId) {
      await client.query(`UPDATE products child SET name=parent.name,category_id=parent.category_id,brand_id=parent.brand_id,
        price=$3,old_price=$4,stock=$5,sku=$6 FROM products parent WHERE child.id=$2 AND parent.id=$1`,
      [productId, sourceId, variant.price, variant.oldPrice, variant.stock, variant.sku]);
    }
    await client.query(`INSERT INTO product_variants
      (product_id,source_product_id,volume_value,volume_unit,price,old_price,stock,sku,is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(source_product_id) DO UPDATE SET volume_value=EXCLUDED.volume_value,volume_unit=EXCLUDED.volume_unit,
      price=EXCLUDED.price,old_price=EXCLUDED.old_price,stock=EXCLUDED.stock,sku=EXCLUDED.sku,
      is_active=EXCLUDED.is_active,updated_at=now()`,
    [productId, sourceId, variant.volume, variant.unit, variant.price, variant.oldPrice, variant.stock, variant.sku, variant.isActive]);
  }
}
