
-- Enable Realtime for private_messages
-- Check if publication exists, if not create it (Supabase standard setup usually has 'supabase_realtime')
-- We assume 'supabase_realtime' publication exists.

alter publication supabase_realtime add table private_messages;
alter publication supabase_realtime add table hopping_comments;
