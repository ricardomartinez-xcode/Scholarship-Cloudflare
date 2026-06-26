ALTER TABLE cloudflare_auth_user ADD COLUMN auth_user_id TEXT;
ALTER TABLE cloudflare_auth_user ADD COLUMN last_login_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS cloudflare_auth_user_auth_user_id_idx
ON cloudflare_auth_user(auth_user_id)
WHERE auth_user_id IS NOT NULL;
