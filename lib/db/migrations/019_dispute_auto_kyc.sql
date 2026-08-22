-- Auto-dispute metadata; KYC uses existing approval_status.

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS auto_resolved boolean NOT NULL DEFAULT false;

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS resolution_source varchar(32);
