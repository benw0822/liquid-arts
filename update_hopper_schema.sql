-- Add Hopper Card columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS hopper_image_url text,
ADD COLUMN IF NOT EXISTS hopper_nickname text,
ADD COLUMN IF NOT EXISTS hopper_bio text,
ADD COLUMN IF NOT EXISTS hopper_level int DEFAULT 1;

-- Create Storage Bucket for Hopper Cards
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hopper_cards', 'hopper_cards', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public Read
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'hopper_cards' );

-- Policy: User Upload (Insert)
CREATE POLICY "User Upload Own Card" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'hopper_cards' AND auth.uid() = owner );

-- Policy: User Update Own Card
CREATE POLICY "User Update Own Card" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'hopper_cards' AND auth.uid() = owner );

-- Policy: User Delete Own Card
CREATE POLICY "User Delete Own Card" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'hopper_cards' AND auth.uid() = owner );
