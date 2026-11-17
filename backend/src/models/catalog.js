import {catalogDetails} from './catalogDetails.js';
export async function loadCatalog(pool,{includeDrafts=false}={}) {
 const result=await pool.query(
  `SELECT p.id,p.name AS title,p.sku,c.name AS category,p.price,p.old_price AS "oldPrice",p.stock,p.description,b.name AS "brandName",
  COALESCE((SELECT json_agg(json_build_object('id',v.id,'sourceProductId',v.source_product_id,'volume',v.volume_value,'unit',v.volume_unit,'price',v.price,'oldPrice',v.old_price,'stock',v.stock,'sku',v.sku,'isActive',v.is_active) ORDER BY v.volume_value NULLS LAST,v.id) FROM product_variants v WHERE v.product_id=p.id),'[]'::json) AS variants,
  (COALESCE(p.characteristics,'{}'::jsonb)-'sourceData') || jsonb_build_object('sourceData',
    (SELECT COALESCE(jsonb_object_agg(key,value),'{}'::jsonb)
     FROM jsonb_each(CASE WHEN jsonb_typeof(p.characteristics->'sourceData')='object' THEN p.characteristics->'sourceData' ELSE '{}'::jsonb END)
     WHERE key IN ('brand','category','group','subcategory','characteristics','productDescription','description','formulaFeatures','usage','recommendation','activeIngredients','inciIngredients'))
  ) AS characteristics,
  (p.is_active AND c.is_active) AS "isPublished",
  COALESCE((SELECT json_agg(image_url ORDER BY (image_url LIKE 'https://res.cloudinary.com/%') DESC,sort_order,id)
   FROM product_images WHERE product_id=p.id),'[]'::json) AS images
  FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id WHERE ${includeDrafts?'TRUE':'p.is_active AND c.is_active'} AND NOT EXISTS (SELECT 1 FROM product_merge_audit a WHERE a.source_product_id=p.id AND a.canonical_product_id<>p.id) ORDER BY p.created_at DESC,p.id`);
 return result.rows.map(row=>({...row,...catalogDetails(row),image:row.images[0]||'',price:Number(row.price),oldPrice:row.oldPrice===null?null:Number(row.oldPrice)}));
}

export async function loadCatalogCategories(pool,{includeInactive=false}={}){return (await pool.query("SELECT id,name,slug FROM categories WHERE slug NOT LIKE 'import-%' AND slug NOT LIKE 'brand-%' AND ($1::boolean OR is_active) ORDER BY name",[includeInactive])).rows;}
