-- Allow image URLs for domain/specialization icons
ALTER TABLE service_domains
  ALTER COLUMN icon TYPE varchar(500);

ALTER TABLE service_specializations
  ADD COLUMN IF NOT EXISTS icon varchar(500);
