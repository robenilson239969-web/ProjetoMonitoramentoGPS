-- Execute once in Supabase SQL Editor:
ALTER TABLE gps_data
ADD COLUMN IF NOT EXISTS vehicle_id text NOT NULL DEFAULT 'VEICULO-01';

CREATE INDEX IF NOT EXISTS idx_gps_data_vehicle_timestamp
ON gps_data (vehicle_id, timestamp);
