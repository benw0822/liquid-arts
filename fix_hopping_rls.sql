-- FIX RLS Policies for Hoppings Table
-- Run this in Supabase SQL Editor

-- 1. Ensure RLS is enabled
alter table hoppings enable row level security;

-- 2. Drop existing policies to remove any conflicts/duplicates
drop policy if exists "Public hoppings are viewable by everyone." on hoppings;
drop policy if exists "Users can insert their own hoppings." on hoppings;
drop policy if exists "Users can update their own hoppings." on hoppings;
drop policy if exists "Users can delete their own hoppings." on hoppings;

-- 3. Re-create Policies correctly

-- Allow SELECT for public rows OR own rows
create policy "Public hoppings are viewable by everyone."
  on hoppings for select
  using ( is_public = true or auth.uid() = user_id );

-- Allow INSERT for authenticated users (Check that user_id matches auth.uid)
create policy "Users can insert their own hoppings."
  on hoppings for insert
  with check ( auth.uid() = user_id );

-- Allow UPDATE for own rows
create policy "Users can update their own hoppings."
  on hoppings for update
  using ( auth.uid() = user_id );

-- Allow DELETE for own rows
create policy "Users can delete their own hoppings."
  on hoppings for delete
  using ( auth.uid() = user_id );

-- 4. Grant necessary permissions (Safe to re-run)
grant select, insert, update, delete on hoppings to authenticated;
grant select on hoppings to anon;
