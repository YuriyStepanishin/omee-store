ALTER TABLE reviews ALTER COLUMN product_id DROP NOT NULL;

CREATE UNIQUE INDEX reviews_store_user_unique ON reviews (user_id)
  WHERE product_id IS NULL;
