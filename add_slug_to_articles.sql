-- Add slug column to articles table
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Add comment
COMMENT ON COLUMN articles.slug IS 'Custom URL slug for the article. Must be unique.';
