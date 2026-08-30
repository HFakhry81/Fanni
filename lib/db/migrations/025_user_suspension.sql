-- Migration 025: account suspension metadata (reason, admin, timestamp)
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by_admin_id VARCHAR REFERENCES admins(id);
