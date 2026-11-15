ALTER TABLE users ADD COLUMN password_changed_at timestamptz;
CREATE TABLE password_reset_tokens (
 token_hash text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 used_at timestamptz
);
CREATE INDEX password_reset_user_idx ON password_reset_tokens(user_id);
