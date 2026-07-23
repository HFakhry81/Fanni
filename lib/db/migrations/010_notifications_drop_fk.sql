-- Migration 010: Drop FK constraint on notifications.user_id
-- Admins live in adminsTable (not usersTable), so we need to allow their IDs here too.

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- Add a plain index to keep query perf on user_id lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
