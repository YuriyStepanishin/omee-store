CREATE TABLE cart_items (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 99),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,product_id)
);
