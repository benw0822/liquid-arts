-- Fix RLS Policy for Invitations table
-- Issue: The previous policy likely only allowed 'anon' (public) access. 
-- When a user logs in to accept the invite, they become 'authenticated', and can no longer "Read" the invitation to verify it, causing the page to show an error.

-- Solution: Allow EVERYONE (auth and anon) to select/read invitations involved in the landing page.

DROP POLICY IF EXISTS "Public can view invitations" ON public.invitations;
DROP POLICY IF EXISTS "Everyone can read invitations" ON public.invitations;

CREATE POLICY "Everyone can read invitations"
ON public.invitations FOR SELECT
USING (true);
