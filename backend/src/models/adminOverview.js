import { canonicalProduct } from './productVariants.js';

export const overviewSql = `
  WITH cards AS (
    SELECT p.is_active, c.is_active AS category_active, p.stock,
      EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.is_active AND v.stock>0) AS variant_in_stock
    FROM products p JOIN categories c ON c.id=p.category_id
    WHERE ${canonicalProduct}
  )
  SELECT count(*)::int AS products,
    count(*) FILTER (WHERE is_active AND category_active)::int AS published_products,
    count(*) FILTER (WHERE NOT is_active)::int AS draft_products,
    count(*) FILTER (WHERE is_active AND NOT category_active)::int AS hidden_by_category,
    count(*) FILTER (WHERE stock>0 OR variant_in_stock)::int AS in_stock,
    (SELECT count(*)::int FROM orders) AS orders,
    (SELECT count(*)::int FROM orders WHERE status='NEW') AS new_orders,
    (SELECT count(*)::int FROM users WHERE role='CUSTOMER') AS customers
  FROM cards
`;
