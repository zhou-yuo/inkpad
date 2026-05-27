ALTER TABLE notes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE notes ADD COLUMN public_title TEXT;
ALTER TABLE notes ADD COLUMN public_body TEXT;
ALTER TABLE notes ADD COLUMN published_at TEXT;

CREATE INDEX IF NOT EXISTS idx_notes_visibility_updated_at ON notes(visibility, updated_at DESC);
