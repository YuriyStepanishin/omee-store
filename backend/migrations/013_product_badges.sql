-- Manual badges are per canonical product and never change pricing or publication.
ALTER TABLE products ADD COLUMN IF NOT EXISTS badges jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD CONSTRAINT products_badges_array_check CHECK (jsonb_typeof(badges) = 'array');
