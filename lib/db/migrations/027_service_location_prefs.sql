-- Technician daily service-location preference (registered / last_work / current)
ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_active_location geography(POINT, 4326);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_work_location geography(POINT, 4326);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_location_mode varchar(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_location_day date;
