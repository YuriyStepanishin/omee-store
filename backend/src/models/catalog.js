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

// Paginated public listing. All filters apply in SQL before LIMIT/OFFSET.
export async function loadCatalogPage(pool,{page=1,limit=24,search='',brand='',category='',line='',sort='newest'}={}) {
 const safePage=Math.max(1,Math.min(100000,Number(page)||1));
 const safeLimit=Math.max(1,Math.min(48,Number(limit)||24));
 const q=String(search).trim().slice(0,120);
 const selectedBrand=String(brand).trim().slice(0,120);
 const selectedCategory=String(category).trim().slice(0,120);
 const selectedLine=['hair','body','other'].includes(line)?line:'';
 const order={newest:'p.created_at DESC,p.id',price_asc:'p.price ASC,p.id',price_desc:'p.price DESC,p.id',name:'p.name ASC,p.id'}[sort]||'p.created_at DESC,p.id';
 const where=`p.is_active AND c.is_active AND ${canonicalProduct}
 AND ($1::text='' OR p.name ILIKE '%'||$1||'%' OR p.sku ILIKE '%'||$1||'%' OR b.name ILIKE '%'||$1||'%')
 AND ($2::text='' OR b.name=$2)
 AND ($3::text='' OR c.name=$3 OR p.characteristics->>'group'=$3 OR p.characteristics->'sourceData'->>'category'=$3)
 AND ($4::text='' OR CASE
 WHEN lower(coalesce(p.characteristics->>'Лінійка',p.characteristics->>'audience','')) IN ('hair','body','other') THEN lower(coalesce(p.characteristics->>'Лінійка',p.characteristics->>'audience'))
 WHEN concat_ws(' ',c.name,p.characteristics->>'group',p.characteristics->'sourceData'->>'category') ~* 'волосс|шампун|кондиціонер|стайлінг|hair|scalp' THEN 'hair'
 WHEN concat_ws(' ',c.name,p.characteristics->>'group',p.characteristics->'sourceData'->>'category') ~* 'тіл|шкір|облич|рук|ніг|душ|body|skin|face|крем|лосьйон|скраб' THEN 'body'
 ELSE 'other' END=$4)`;
 const count=await pool.query(`SELECT count(*)::integer AS total FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id WHERE ${where}`,[q,selectedBrand,selectedCategory,selectedLine]);
 const total=count.rows[0].total;
 const result=await pool.query(`SELECT p.id,p.name AS title,p.sku,c.name AS category,p.price,p.old_price AS "oldPrice",p.stock,p.description,p.badges,b.name AS "brandName",
 ${variantJson()} AS variants,
 (COALESCE(p.characteristics,'{}'::jsonb)-'sourceData') || jsonb_build_object('sourceData',
 (SELECT COALESCE(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(CASE WHEN jsonb_typeof(p.characteristics->'sourceData')='object' THEN p.characteristics->'sourceData' ELSE '{}'::jsonb END)
 WHERE key IN ('brand','category','group','subcategory','characteristics','productDescription','description','formulaFeatures','usage','recommendation','activeIngredients','inciIngredients'))) AS characteristics,
 true AS "isPublished",
 COALESCE((SELECT json_agg(image_url ORDER BY (image_url LIKE 'https://res.cloudinary.com/%') DESC,sort_order,id) FROM (SELECT image_url,sort_order,id FROM product_images WHERE product_id=p.id ORDER BY (image_url LIKE 'https://res.cloudinary.com/%') DESC,sort_order,id LIMIT 1) cover),'[]'::json) AS images
 FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id
 WHERE ${where} ORDER BY ${order} LIMIT $5 OFFSET $6`,[q,selectedBrand,selectedCategory,selectedLine,safeLimit,(safePage-1)*safeLimit]);
 return {products:result.rows.map(row=>{const product={...row,...catalogDetails(row),image:row.images[0]||'',price:Number(row.price),oldPrice:row.oldPrice===null?null:Number(row.oldPrice)};return {...product,images:[product.image],characteristics:{},details:[]};}),page:safePage,limit:safeLimit,total,pages:Math.ceil(total/safeLimit)};
}

// Filter options are computed across all published canonical products, not the current page.
export async function loadCatalogFacets(pool){
 const {rows}=await pool.query(`SELECT DISTINCT c.name AS category,b.name AS brand FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id WHERE p.is_active AND c.is_active AND ${canonicalProduct}`);
 return {categories:[...new Set(rows.map(r=>r.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'uk')),brands:[...new Set(rows.map(r=>r.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'uk'))};
}
