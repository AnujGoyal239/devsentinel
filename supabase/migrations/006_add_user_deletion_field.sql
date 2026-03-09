-- Migration: Add user deletion scheduling field
-- Description: Adds deletion_scheduled_at field for 30-day deletion grace period

-- Add deletion scheduling field to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;

-- Create index for faster lookups of users scheduled for deletion
CREATE INDEX IF NOT EXISTS idx_users_deletion_scheduled ON users(deletion_scheduled_at)
WHERE deletion_scheduled_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.deletion_scheduled_at IS 'Timestamp when user account is scheduled for deletion (30 days after request)';
