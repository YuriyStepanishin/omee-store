import { createHash } from 'node:crypto';
const columns = `id,slug,title,excerpt,body,category,author,seo_title AS "seoTitle",seo_description AS "seoDescription",sources,status`;
export function adminArticles(pool) {
  return {
    async list() {
      return (
        await pool.query(
          'SELECT id,slug,title,category,status,updated_at AS "updatedAt" FROM public.blog_posts ORDER BY updated_at DESC LIMIT 500'
        )
      ).rows;
    },
    async detail(id) {
      const row = (
        await pool.query(
          `SELECT ${columns} FROM public.blog_posts WHERE id=$1`,
          [id]
        )
      ).rows[0];
      if (!row)
        throw Object.assign(new Error('Статтю не знайдено.'), { status: 404 });
      return row;
    },
    async save(data, id) {
      const hash = createHash('sha256')
        .update(data.body.trim().replace(/\r\n/g, '\n'))
        .digest('hex');
      const values = [
        data.slug,
        data.title,
        data.excerpt,
        data.body,
        data.category,
        data.author,
        data.seoTitle,
        data.seoDescription,
        JSON.stringify(data.sources),
        hash,
        data.status,
      ];
      if (id) values.push(id);
      const sql = id
        ? `UPDATE public.blog_posts SET slug=$1,title=$2,excerpt=$3,body=$4,category=$5,author=$6,seo_title=$7,seo_description=$8,sources=$9::jsonb,content_hash=$10,status=$11,published_at=CASE WHEN $11='published' THEN COALESCE(published_at,now()) ELSE published_at END,updated_at=now() WHERE id=$12 RETURNING id`
        : `INSERT INTO public.blog_posts(slug,title,excerpt,body,category,author,seo_title,seo_description,sources,content_hash,status,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,CASE WHEN $11='published' THEN now() ELSE NULL END) RETURNING id`;
      const row = (await pool.query(sql, values)).rows[0];
      if (!row)
        throw Object.assign(new Error('Статтю не знайдено.'), { status: 404 });
      return row;
    },
    async remove(id) {
      const result = await pool.query(
        'DELETE FROM public.blog_posts WHERE id=$1 RETURNING id',
        [id]
      );
      if (!result.rows.length)
        throw Object.assign(new Error('Статтю не знайдено.'), { status: 404 });
    },
  };
}
