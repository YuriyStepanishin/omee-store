import {canonicalProduct, variantJson} from './productVariants.js';
import {catalogDetails} from './catalogDetails.js';
export async function loadCatalog(pool,{includeDrafts=false,productId=null}={}) {
 const result=await pool.query(
  `SELECT p.id,p.name AS title,p.sku,c.name AS category,p.price,p.old_price AS "oldPrice",p.stock,p.description,p.badges,b.name AS "brandName",
  ${variantJson()} AS variants,
  (COALESCE(p.characteristics,'{}'::jsonb)-'sourceData') || jsonb_build_object('sourceData',
    (SELECT COALESCE(jsonb_object_agg(key,value),'{}'::jsonb)
     FROM jsonb_each(CASE WHEN jsonb_typeof(p.characteristics->'sourceData')='object' THEN p.characteristics->'sourceData' ELSE '{}'::jsonb END)
     WHERE key IN ('brand','category','group','subcategory','characteristics','productDescription','description','formulaFeatures','usage','recommendation','activeIngredients','inciIngredients'))
  ) AS characteristics,
  (p.is_active AND c.is_active) AS "isPublished",
  COALESCE((SELECT json_agg(image_url ORDER BY (image_url LIKE 'https://res.cloudinary.com/%') DESC,sort_order,id)
   FROM product_images WHERE product_id=p.id),'[]'::json) AS images
  FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id WHERE ${includeDrafts?'TRUE':'p.is_active AND c.is_active'} AND ${canonicalProduct} AND ($1::uuid IS NULL OR p.id=$1::uuid) ORDER BY p.created_at DESC,p.id`,[productId]);
 return result.rows.map(row=>({...row,...catalogDetails(row),image:row.images[0]||'',price:Number(row.price),oldPrice:row.oldPrice===null?null:Number(row.oldPrice)}));
}

export async function loadCatalogCategories(pool,{includeInactive=false}={}){return (await pool.query("SELECT id,name,slug FROM categories WHERE slug NOT LIKE 'import-%' AND slug NOT LIKE 'brand-%' AND ($1::boolean OR is_active) ORDER BY name",[includeInactive])).rows;}

// Public listing: page at the database, not in the browser. Detail/admin routes remain unchanged.
export async function loadCatalogPage(pool,{page=1,limit=24}={}) {
 const safePage=Math.max(1,Math.min(100000,Number(page)||1));
 const safeLimit=Math.max(1,Math.min(48,Number(limit)||24));
 const offset=(safePage-1)*safeLimit;
 const result=await pool.query(`SELECT p.id,p.name AS title,p.sku,c.name AS category,p.price,p.old_price AS "oldPrice",p.stock,p.description,p.badges,b.name AS "brandName",
 ${variantJson()} AS variants,
 (COALESCE(p.characteristics,'{}'::jsonb)-'sourceData') || jsonb_build_object('sourceData',
 (SELECT COALESCE(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(CASE WHEN jsonb_typeof(p.characteristics->'sourceData')='object' THEN p.characteristics->'sourceData' ELSE '{}'::jsonb END)
 WHERE key IN ('brand','category','group','subcategory','characteristics','productDescription','description','formulaFeatures','usage','recommendation','activeIngredients','inciIngredients'))) AS characteristics,
 (p.is_active AND c.is_active) AS "isPublished",
 COALESCE((SELECT json_agg(image_url ORDER BY (image_url LIKE 'https://res.cloudinary.com/%') DESC,sort_order,id) FROM product_images WHERE product_id=p.id LIMIT 1),'[]'::json) AS images,
 count(*) OVER()::integer AS "totalCount"
 FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id
 WHERE p.is_active AND c.is_active AND ${canonicalProduct}
 ORDER BY p.created_at DESC,p.id LIMIT $1 OFFSET $2`,[safeLimit,offset]);
 const total=result.rows[0]?.totalCount??0;
 return {products:result.rows.map(({totalCount,...row})=>{const product={...row,...catalogDetails(row),image:row.images[0]||'',price:Number(row.price),oldPrice:row.oldPrice===null?null:Number(row.oldPrice)};return {...product,images:[product.image],characteristics:{},details:[]};}),page:safePage,limit:safeLimit,total,pages:Math.ceil(total/safeLimit)};
}
