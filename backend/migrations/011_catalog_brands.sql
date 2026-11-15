CREATE TABLE IF NOT EXISTS brands (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name varchar(120) NOT NULL,
 slug varchar(160) NOT NULL UNIQUE,
 image text,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS brands_name_lower_unique ON brands(lower(name));
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS products_brand_id_idx ON products(brand_id);
INSERT INTO brands(id,name,slug,image,is_active)
 SELECT id,name,regexp_replace(slug,'^import-','brand-'),image,is_active
 FROM categories WHERE slug LIKE 'import-%' OR slug LIKE 'brand-%'
 ON CONFLICT DO NOTHING;
UPDATE products p SET brand_id=b.id
 FROM brands b
 WHERE p.brand_id IS NULL AND lower(b.name)=lower(COALESCE(
 NULLIF(p.characteristics->>'brand',''),
 NULLIF(p.characteristics->>'Бренд',''),
 NULLIF(p.characteristics->>'Brand',''),
 NULLIF(p.characteristics->'sourceData'->>'brand','')));
UPDATE categories c SET is_active=false
 WHERE (c.slug LIKE 'import-%' OR c.slug LIKE 'brand-%')
 AND EXISTS (SELECT 1 FROM brands b WHERE b.id=c.id)
 AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id=c.id);

