-- Add city and slug columns to bars table
ALTER TABLE bars ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE bars ADD COLUMN IF NOT EXISTS slug text;

-- Add unique constraint to slug (handling potential existing nulls differently if needed, but for now simple unique)
-- Note: If there are existing duplicates, this might fail. But assuming slugs are new, it's fine.
ALTER TABLE bars ADD CONSTRAINT bars_slug_key UNIQUE (slug);

-- Index for faster lookup by slug
CREATE INDEX IF NOT EXISTS idx_bars_slug ON bars(slug);
