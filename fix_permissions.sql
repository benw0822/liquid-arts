-- Enable RLS on users table if not already enabled
alter table public.users enable row level security;

-- Policy: Admins and Editors can view ALL user profiles
drop policy if exists "Admins/Editors can view all users" on public.users;
create policy "Admins/Editors can view all users"
  on public.users for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and ('admin' = any(roles) or 'editor' = any(roles))
    )
  );

-- Policy: Users can view their own profile (Standard)
drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile"
  on public.users for select
  using ( auth.uid() = id );
