-- Add number_of_seasons and number_of_episodes to the media table.
-- These are series-only fields written by the tmdb-detail edge function
-- but were missing from the initial schema.
--
-- We also force-expire all series rows so the next tmdb-detail call
-- re-fetches from TMDB and writes the correct season/episode counts.

ALTER TABLE public.media
  ADD COLUMN IF NOT EXISTS number_of_seasons  integer,
  ADD COLUMN IF NOT EXISTS number_of_episodes integer;

-- Expire cached series rows so tmdb-detail re-fetches them and populates
-- the new columns. Setting cached_at 8 days in the past exceeds the
-- MEDIA_CACHE_TTL_DAYS = 7 threshold in the edge function.
UPDATE public.media
SET cached_at = now() - interval '8 days'
WHERE media_type = 'series';
