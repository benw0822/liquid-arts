-- Create invitations table
create table if not exists public.invitations (
  code text primary key, -- Custom or Random string
  role text not null check (role in ('owner', 'talent', 'user')),
  metadata jsonb default '{}'::jsonb, -- Stores { "bar_id": 1, "talent_name": "..." }
  is_used boolean default false,
  used_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  expires_at timestamptz
);

-- Enable RLS
alter table public.invitations enable row level security;

-- Policies (Drop first to avoid "already exists" error on re-run)
drop policy if exists "Admins/Editors can view all invitations" on public.invitations;
create policy "Admins/Editors can view all invitations"
  on public.invitations for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and ('admin' = any(roles) or 'editor' = any(roles))
    )
  );

drop policy if exists "Admins/Editors can insert invitations" on public.invitations;
create policy "Admins/Editors can insert invitations"
  on public.invitations for insert
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and ('admin' = any(roles) or 'editor' = any(roles))
    )
  );

drop policy if exists "Everyone can view invitation by code" on public.invitations;
create policy "Everyone can view invitation by code"
  on public.invitations for select
  using ( true );

-- RPC Function to Claim Invitation (Security Definer to bypass RLS/Privileges)
create or replace function public.claim_invitation(code_input text)
returns jsonb
language plpgsql
security definer
as $$
declare
  inv_record record;
  current_user_id uuid;
  user_roles text[];
  new_bar_id bigint;
  meta_name text;
begin
  -- 1. Get Current User
  current_user_id := auth.uid();
  if current_user_id is null then
    return jsonb_build_object('success', false, 'message', 'Not authenticated');
  end if;

  -- 2. Check Invitation
  select * into inv_record from public.invitations
  where code = code_input;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Invalid invitation code');
  end if;

  if inv_record.is_used then
    return jsonb_build_object('success', false, 'message', 'Invitation already used');
  end if;

  if inv_record.expires_at is not null and inv_record.expires_at < now() then
    return jsonb_build_object('success', false, 'message', 'Invitation expired');
  end if;

  -- 3. Mark as Used
  update public.invitations
  set is_used = true, used_by = current_user_id
  where code = code_input;

  -- 4. Update User Role
  select roles into user_roles from public.users where id = current_user_id;
  
  -- Append role if not exists
  if not (user_roles @> array[inv_record.role]) then
    update public.users
    set roles = array_append(roles, inv_record.role)
    where id = current_user_id;
  end if;

  -- 5. Role Specific Actions
  if inv_record.role = 'owner' then
    new_bar_id := (inv_record.metadata ->> 'bar_id')::bigint;
    if new_bar_id is not null then
      insert into public.bar_owners (bar_id, user_id)
      values (new_bar_id, current_user_id)
      on conflict (bar_id, user_id) do nothing;
    end if;

  elsif inv_record.role = 'talent' then
    -- Create Talent Profile if not exists
    meta_name := inv_record.metadata ->> 'display_name';
    if meta_name is null then
        select name into meta_name from public.users where id = current_user_id;
    end if;
    if meta_name is null then meta_name := 'New Talent'; end if;

    -- Extract other fields
    -- If passed as raw JSON in metadata, we can cast directly.
    
    insert into public.talents (
        user_id, 
        display_name, 
        description, 
        quote, 
        awards, 
        experiences
    )
    values (
        current_user_id, 
        meta_name,
        inv_record.metadata ->> 'description', -- Bio
        inv_record.metadata ->> 'quote',
        coalesce((inv_record.metadata -> 'awards'), '[]'::jsonb),
        coalesce((inv_record.metadata -> 'experiences'), '[]'::jsonb)
    )
    on conflict (user_id) do update set
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        quote = EXCLUDED.quote,
        awards = EXCLUDED.awards,
        experiences = EXCLUDED.experiences;
  end if;

  return jsonb_build_object('success', true, 'role', inv_record.role, 'bar_id', inv_record.metadata->>'bar_id');

exception when others then
  return jsonb_build_object('success', false, 'message', SQLERRM);
end;
$$;
