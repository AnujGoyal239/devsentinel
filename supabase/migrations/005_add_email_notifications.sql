-- Migration: Add email notification fields to users table
-- Description: Adds email_notifications_enabled and github_email fields for email notifications

-- Add email notification fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS github_email TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email_notifications ON users(email_notifications_enabled);

-- Add comment
COMMENT ON COLUMN users.email_notifications_enabled IS 'Whether user has opted in to receive email notifications';
COMMENT ON COLUMN users.github_email IS 'User GitHub email address for notifications';
