-- Create talents table
create table if not exists public.talents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text not null,
  description text,
  quote text,
  image_url text,
  bar_roles jsonb default '[]'::jsonb, -- Array of { bar_id, bar_name, role }
  experiences jsonb default '[]'::jsonb, -- Array of { year, unit, title }
  awards jsonb default '[]'::jsonb, -- Array of { year, name, rank }
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.talents enable row level security;

-- Policies
-- 1. Everyone can read talents
create policy "Talents are viewable by everyone"
  on public.talents for select
  using ( true );

-- 2. Users can insert their own talent profile (Must be 'talent' or 'kol') OR Admin/Editor
create policy "Users and Admins can insert talent profile"
  on public.talents for insert
  with check (
    (
      auth.uid() = user_id
      and exists (
        select 1 from public.users
        where id = auth.uid()
        and (roles @> array['talent']::text[] or roles @> array['kol']::text[])
      )
    )
    or
    exists (
      select 1 from public.users
      where id = auth.uid()
      and (roles @> array['admin']::text[] or roles @> array['editor']::text[])
    )
  );

-- 3. Users can update their own talent profile (OR Admin/Editor)
create policy "Users and Admins can update talent profile"
  on public.talents for update
  using (
    auth.uid() = user_id
    or
    exists (
      select 1 from public.users
      where id = auth.uid()
      and (roles @> array['admin']::text[] or roles @> array['editor']::text[])
    )
  );

-- 4. Users can delete their own talent profile (OR Admin/Editor)
create policy "Users and Admins can delete talent profile"
  on public.talents for delete
  using (
    auth.uid() = user_id
    or
    exists (
      select 1 from public.users
      where id = auth.uid()
      and (roles @> array['admin']::text[] or roles @> array['editor']::text[])
    )
  );

-- Trigger for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_talents_updated
  before update on public.talents
  for each row execute procedure public.handle_updated_at();

-- Add storage bucket policy for talent images if not exists
-- Assuming 'avatars' or a new 'talent-images' bucket. 
-- For now, reusing existing logic or assuming bucket existence.
-- If we need a specific bucket 'talents', we might need to create it.
-- Let's stick to 'avatars' or general 'images' if available, otherwise defaulting to standard Supabase storage setup steps.
