DROP INDEX IF EXISTS idx_notes_user_id_category_id_updated_at;
DROP INDEX IF EXISTS idx_categories_user_id_updated_at;
DROP INDEX IF EXISTS idx_categories_user_id_name;
DROP TABLE IF EXISTS categories;
ALTER TABLE notes DROP COLUMN category_id;
