ALTER TABLE orders
  ADD COLUMN payment_status text NOT NULL DEFAULT 'UNCONFIRMED'
    CHECK (payment_status IN ('UNCONFIRMED', 'PAID')),
  ADD COLUMN tracking_number varchar(40)
    CHECK (tracking_number ~ '^[A-Z0-9][A-Z0-9-]{5,39}$'),
  DROP CONSTRAINT orders_status_check,
  ADD CONSTRAINT orders_status_check
    CHECK (status IN ('NEW', 'PROCESSING', 'PAID', 'PACKED', 'SHIPPED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELED'));

UPDATE orders SET payment_status='PAID' WHERE status='PAID';
