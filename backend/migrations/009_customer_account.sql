ALTER TABLE order_items ADD COLUMN product_name varchar(240);
ALTER TABLE order_items ADD COLUMN product_sku varchar(100);
ALTER TABLE favorites ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX favorites_user_date_idx ON favorites(user_id,created_at DESC,id);
