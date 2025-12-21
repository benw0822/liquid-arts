-- Create bar_news table
CREATE TABLE IF NOT EXISTS public.bar_news (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bar_id BIGINT NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    image_url TEXT,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bar_news ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Public Read
CREATE POLICY "Public can view bar news"
ON public.bar_news FOR SELECT
USING (true);

-- 2. Editor/Admin/Owner Write
-- (Simplified using existing roles via app metadata or profiles, but here we'll use a basic check or specific role logic if available. 
-- Assuming authenticated users with role 'admin'/'editor' OR owner of the bar can edit.)

CREATE POLICY "Admins, Editors, and Bar Owners can insert news"
ON public.bar_news FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (
          'admin' = ANY(roles) OR 'editor' = ANY(roles)
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.bars 
      WHERE bars.id = bar_news.bar_id 
      AND bars.owner_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins, Editors, and Bar Owners can delete news"
ON public.bar_news FOR DELETE
USING (
  auth.role() = 'authenticated' AND (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (
          'admin' = ANY(roles) OR 'editor' = ANY(roles)
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.bars 
      WHERE bars.id = bar_news.bar_id 
      AND bars.owner_user_id = auth.uid()
    )
  )
);
