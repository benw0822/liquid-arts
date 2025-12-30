-- Add username column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Add constraint for allowed characters (a-z, A-Z, 0-9, _, .) safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'username_format_check'
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT username_format_check 
        CHECK (username ~* '^[a-zA-Z0-9_\.]+$');
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN public.users.username IS 'Unique handle for the user profile URL';

-- Policy: Users can update their own username
-- (Assuming existing update policy covers "users" table row for their own ID)
