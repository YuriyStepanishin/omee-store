ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_city_ref uuid,
  ADD COLUMN IF NOT EXISTS delivery_point_ref uuid;
