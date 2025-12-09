-- 1. Update Table Comment
COMMENT ON TABLE public.users IS 'Users with roles: admin, editor, talent, member, kol';

-- 2. Update existing roles in 'users' table
-- Migrate 'reader' -> 'member'
UPDATE public.users
SET roles = array_replace(roles, 'reader', 'member')
WHERE 'reader' = ANY(roles);

-- Migrate 'barOwner' -> 'talent'
UPDATE public.users
SET roles = array_replace(roles, 'barOwner', 'talent')
WHERE 'barOwner' = ANY(roles);

-- 3. Update the handle_new_user function to default to 'member'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, roles)
  VALUES (new.id, new.email, split_part(new.email, '@', 1), array['member']); -- Changed from 'reader' to 'member'
  RETURN new;
END;
$$;
