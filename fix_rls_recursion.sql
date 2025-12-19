-- Fix Infinite Recursion in RLS Policy
-- The previous policy caused a loop because it queried 'users' table while checking permission for 'users' table.

-- 1. Drop the problematic recursive policy
drop policy if exists "Admins/Editors can view all users" on public.users;

-- 2. Create a secure helper function to check roles
-- SECURITY DEFINER means this function runs with the privileges of the creator (postgres/admin), 
-- bypassing RLS checks to avoid the infinite loop.
create or replace function public.check_user_role(required_role text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
begin
  return exists (
    select 1 from public.users
    where id = auth.uid()
    and required_role = any(roles)
  );
end;
$$;

-- 3. Re-create the policy using the safe function
-- Now we just call the function, which internally bypasses the RLS recursion trap.
create policy "Admins/Editors can view all users"
  on public.users for select
  using ( 
    public.check_user_role('admin') 
    or 
    public.check_user_role('editor') 
  );
