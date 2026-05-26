CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_id_name ON categories(user_id, name);
CREATE INDEX IF NOT EXISTS idx_categories_user_id_updated_at ON categories(user_id, updated_at DESC);

ALTER TABLE notes ADD COLUMN category_id TEXT;
CREATE INDEX IF NOT EXISTS idx_notes_user_id_category_id_updated_at ON notes(user_id, category_id, updated_at DESC);
