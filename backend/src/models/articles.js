const summaryColumns=`id,slug,title,excerpt,category,author,to_char(published_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS date`;
export function articleRepository(pool){return {
 async list(){
  try{return (await pool.query(`SELECT ${summaryColumns} FROM public.blog_posts WHERE status='published' AND published_at<=now() ORDER BY published_at DESC,slug`)).rows;}
  catch(error){if(error.code==='42P01')return [];throw error;}
 },
 async bySlug(slug){
  const {rows}=await pool.query(`SELECT ${summaryColumns},body,seo_title AS "seoTitle",seo_description AS "seoDescription",sources,media FROM public.blog_posts WHERE slug=$1 AND status='published' AND published_at<=now()`,[slug]);
  return rows[0]||null;
 }
};}
