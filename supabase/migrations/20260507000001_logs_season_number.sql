-- Add season_number to logs for series_season log type
ALTER TABLE logs ADD COLUMN IF NOT EXISTS season_number integer;
