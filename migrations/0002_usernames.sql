ALTER TABLE users ADD COLUMN username TEXT;

WITH normalized AS (
  SELECT
    id,
    LOWER(
      REPLACE(
        REPLACE(
          SUBSTR(email, 1, INSTR(email, '@') - 1),
          '.',
          '_'
        ),
        '+',
        '_'
      )
    ) AS base
  FROM users
),
deduped AS (
  SELECT
    normalized.id,
    normalized.base,
    COUNT(*) OVER (PARTITION BY normalized.base) AS base_count
  FROM normalized
)
UPDATE users
SET username = (
  SELECT CASE
    WHEN deduped.base_count = 1 THEN deduped.base
    ELSE deduped.base || '_' || SUBSTR(users.id, 5, 6)
  END
  FROM deduped
  WHERE deduped.id = users.id
)
WHERE username IS NULL;

UPDATE users
SET username = 'user_' || SUBSTR(id, 5, 8)
WHERE username IS NULL OR username = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
