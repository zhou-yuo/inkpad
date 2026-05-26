ALTER TABLE users ADD COLUMN account TEXT;

UPDATE users
SET account = username
WHERE account IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account ON users(account);
