-- Run this in your Supabase SQL Editor to fix the Hop Deletion bug

-- 1. Drop the old restrictive constraint
ALTER TABLE private_messages
DROP CONSTRAINT private_messages_related_hop_id_fkey;

-- 2. Add the new constraint with CASCADE delete
ALTER TABLE private_messages
ADD CONSTRAINT private_messages_related_hop_id_fkey
FOREIGN KEY (related_hop_id)
REFERENCES hoppings(id)
ON DELETE SET NULL;
