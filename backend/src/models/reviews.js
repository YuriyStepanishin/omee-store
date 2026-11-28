import {canonicalProduct} from './productVariants.js';

const pageSize = 10;
const availableTarget = `($1::uuid IS NULL OR EXISTS (
  SELECT 1 FROM products p JOIN categories c ON c.id=p.category_id
  WHERE p.id=$1::uuid AND p.is_active AND c.is_active AND ${canonicalProduct}
))`;
const reviewFields = 'rating,comment';
const scope = productId => productId === null ? 'r.product_id IS NULL' : 'r.product_id=$1::uuid';
const summary = `json_build_object(
  'average',round(avg(r.rating),1)::float,
  'count',count(*)::int
)`;

export const productReviewSummary = `(
  SELECT ${summary} FROM reviews r WHERE r.product_id=p.id
) AS "reviewSummary"`;

function targetMissing() {
  return Object.assign(new Error('Товар не знайдено.'), {status:404});
}

export function reviewRepository(pool) {
  return {
    async list(productId, page) {
      const {rows} = await pool.query(`SELECT
        (SELECT ${summary} FROM reviews r WHERE ${scope(productId)}) AS summary,
        COALESCE((
          SELECT json_agg(item ORDER BY item."createdAt" DESC,item.id DESC)
          FROM (
            SELECT r.id,r.rating,r.comment,r.created_at AS "createdAt",
              split_part(trim(u.name),' ',1) AS author
            FROM reviews r JOIN users u ON u.id=r.user_id
            WHERE ${scope(productId)}
            ORDER BY r.created_at DESC,r.id DESC LIMIT ${pageSize} OFFSET $2
          ) item
        ),'[]'::json) AS items
        WHERE ${availableTarget}`, [productId, (page - 1) * pageSize]);
      if (!rows.length) throw targetMissing();
      const result = rows[0];
      return {...result, hasNext: page * pageSize < result.summary.count};
    },

    async mine(productId, userId) {
      const {rows} = await pool.query(`SELECT (
        SELECT row_to_json(item) FROM (
          SELECT ${reviewFields} FROM reviews r WHERE ${scope(productId)} AND r.user_id=$2
        ) item
      ) AS review WHERE ${availableTarget}`, [productId, userId]);
      if (!rows.length) throw targetMissing();
      return rows[0].review;
    },

    async save(productId, userId, {rating, comment}) {
      const conflict = productId === null
        ? '(user_id) WHERE product_id IS NULL'
        : '(user_id,product_id)';
      const {rows} = await pool.query(`INSERT INTO reviews(product_id,user_id,rating,comment)
        SELECT $1::uuid,$2::uuid,$3::smallint,$4::text WHERE ${availableTarget}
        ON CONFLICT ${conflict} DO UPDATE SET rating=EXCLUDED.rating,comment=EXCLUDED.comment
        RETURNING ${reviewFields}`, [productId, userId, rating, comment]);
      if (!rows.length) throw targetMissing();
      return rows[0];
    },
  };
}
