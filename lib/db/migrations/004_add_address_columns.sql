-- Add detailed address columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS street VARCHAR(200),
  ADD COLUMN IF NOT EXISTS building_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS floor_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS apt_no VARCHAR(50);

-- Add detailed address columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS street VARCHAR(200),
  ADD COLUMN IF NOT EXISTS building_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS floor_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS apt_no VARCHAR(50);
