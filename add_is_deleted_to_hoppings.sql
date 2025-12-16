-- Add is_deleted column to hoppings table for Soft Delete
ALTER TABLE hoppings 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Update RLS policies to allow users to update their own hoppings (already exists usually, but ensuring)
-- Ensure the policy for UPDATE allows users to update 'is_deleted'
-- (Assuming standard checks exist: "Users can update their own hoppings")
