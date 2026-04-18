-- ============================================================
-- Remove static movie seeds — catalog is now fully dynamic.
--
-- Migration 20260418000006 hardcoded 10 movies as a dev scaffold.
-- The catalog-scheduler edge function (Deno.cron, weekly) now
-- handles all catalog population automatically via TMDB Discover.
-- import-catalog upserts on tmdb_id, so these rows were already
-- overwritten with dynamically-enriched data. We clean them up
-- here only to make intent explicit.
--
-- Going forward:
--   • catalog-scheduler runs every Sunday 03:00 UTC automatically
--   • On first deploy, trigger it once via HTTP to seed the DB
--   • No manual scripts, no hardcoded data
-- ============================================================

-- Remove the 10 hardcoded seed rows.
-- They will be re-imported (with full enrichment) by catalog-scheduler
-- on its first run, or they may already exist with better data.
delete from public.media
where tmdb_id in (238, 278, 680, 13, 157336, 550, 19404, 129, 27205, 11)
  and last_enriched_at is null;   -- only delete if not yet dynamically enriched
-- (If import-catalog already ran, last_enriched_at is set → rows are kept.)
