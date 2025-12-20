-- 1. Grant Select Permissions explicitly
-- (Sometimes needed if table was created without default grants)
GRANT SELECT ON public.awards TO anon, authenticated;
GRANT SELECT ON public.bar_awards TO anon, authenticated;

-- 2. Reset Public Read Policies
-- Use DROP IF EXISTS to avoid "policy already exists" errors

-- Awards Table
DROP POLICY IF EXISTS "Public awards are viewable by everyone." ON public.awards;
CREATE POLICY "Public awards are viewable by everyone." ON public.awards FOR SELECT USING (true);

-- Bar Awards Table
DROP POLICY IF EXISTS "Public bar_awards are viewable by everyone." ON public.bar_awards;
CREATE POLICY "Public bar_awards are viewable by everyone." ON public.bar_awards FOR SELECT USING (true);

-- 3. Reset Write Policies (Admin/Editor) - Optional but good practice to ensure they exist

-- Awards
DROP POLICY IF EXISTS "Admins/Editors can insert awards." ON public.awards;
CREATE POLICY "Admins/Editors can insert awards." ON public.awards FOR INSERT WITH CHECK ( 
  exists (select 1 from public.users where id = auth.uid() and (roles @> array['admin'] or roles @> array['editor']))
);

DROP POLICY IF EXISTS "Admins/Editors can update awards." ON public.awards;
CREATE POLICY "Admins/Editors can update awards." ON public.awards FOR UPDATE USING ( 
  exists (select 1 from public.users where id = auth.uid() and (roles @> array['admin'] or roles @> array['editor']))
);

DROP POLICY IF EXISTS "Admins/Editors can delete awards." ON public.awards;
CREATE POLICY "Admins/Editors can delete awards." ON public.awards FOR DELETE USING ( 
  exists (select 1 from public.users where id = auth.uid() and (roles @> array['admin'] or roles @> array['editor']))
);

-- Bar Awards
DROP POLICY IF EXISTS "Admins/Editors can insert bar_awards." ON public.bar_awards;
CREATE POLICY "Admins/Editors can insert bar_awards." ON public.bar_awards FOR INSERT WITH CHECK ( 
  exists (select 1 from public.users where id = auth.uid() and (roles @> array['admin'] or roles @> array['editor']))
);

DROP POLICY IF EXISTS "Admins/Editors can delete bar_awards." ON public.bar_awards;
CREATE POLICY "Admins/Editors can delete bar_awards." ON public.bar_awards FOR DELETE USING ( 
  exists (select 1 from public.users where id = auth.uid() and (roles @> array['admin'] or roles @> array['editor']))
);
