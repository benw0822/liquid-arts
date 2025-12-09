-- Allow Owners AND Admins to delete hoppings
-- Run this in Supabase SQL Editor

-- 1. Drop existing DELETE policies to clean up
drop policy if exists "Users can delete their own hoppings." on hoppings;
drop policy if exists "Admins can delete any hopping" on hoppings;
drop policy if exists "Enable delete for owners" on hoppings;

-- 2. Create Unified DELETE Policy
-- Allows delete if:
-- a) User is the owner (auth.uid() = user_id)
-- b) User is an admin ('admin' is in their roles array)

create policy "Enable delete for owners and admins"
  on hoppings for delete
  using (
    (auth.uid() = user_id) 
    OR 
    (exists (
      select 1 from users 
      where id = auth.uid() 
      and 'admin' = ANY(roles)
    ))
  );
