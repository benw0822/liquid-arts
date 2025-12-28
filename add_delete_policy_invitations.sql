-- Enable deletion for Admins/Editors
drop policy if exists "Admins/Editors can delete invitations" on public.invitations;

create policy "Admins/Editors can delete invitations"
  on public.invitations for delete
  using (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and ('admin' = any(roles) or 'editor' = any(roles))
    )
  );
