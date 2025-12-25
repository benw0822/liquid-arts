-- Add media_mentions column to bars table
ALTER TABLE public.bars 
ADD COLUMN IF NOT EXISTS media_mentions JSONB DEFAULT '[]'::jsonb;

-- Comment on column
COMMENT ON COLUMN public.bars.media_mentions IS 'List of external media coverage links (Title, URL, etc.)';
