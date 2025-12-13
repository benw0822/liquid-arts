-- "Safer" Approach: Use specific policy names to avoid conflicts with other buckets.
-- We do NOT touch the table structure, only add rules for the 'articles' bucket.

-- 1. Public Read Access for 'articles' bucket only
-- Check if policy exists or just use CREATE OR REPLACE logic (Postgres doesn't support CREATE OR REPLACE POLICY directly nicely, so DROP IF EXISTS is standard but with unique name)

DROP POLICY IF EXISTS "policy_articles_select" ON storage.objects;
CREATE POLICY "policy_articles_select"
ON storage.objects FOR SELECT
USING ( bucket_id = 'articles' );

-- 2. Authenticated Admin/Editor Upload (Insert)
DROP POLICY IF EXISTS "policy_articles_insert" ON storage.objects;
CREATE POLICY "policy_articles_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'articles' 
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND roles && ARRAY['admin', 'editor']::text[]
  )
);

-- 3. Authenticated Admin/Editor Update
DROP POLICY IF EXISTS "policy_articles_update" ON storage.objects;
CREATE POLICY "policy_articles_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'articles'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND roles && ARRAY['admin', 'editor']::text[]
  )
);

-- 4. Authenticated Admin/Editor Delete
DROP POLICY IF EXISTS "policy_articles_delete" ON storage.objects;
CREATE POLICY "policy_articles_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'articles'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND roles && ARRAY['admin', 'editor']::text[]
  )
);
