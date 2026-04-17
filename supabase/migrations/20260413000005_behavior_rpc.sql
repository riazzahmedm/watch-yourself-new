-- ============================================================
-- Watch Yourself: Behavior Aggregate RPC
-- Migration: 20260413000005_behavior_rpc.sql
-- Called by sync-behavior-signals Edge Function.
-- ============================================================

-- Returns log count + average rating per media item.
-- Only returns media that has at least one log entry.
create or replace function public.get_media_log_aggregates()
returns table (
  media_id   uuid,
  log_count  bigint,
  avg_rating numeric
) language sql stable security definer as $$
  select
    media_id,
    count(*)                                  as log_count,
    round(avg(rating)::numeric, 2)            as avg_rating
  from public.logs
  where rating is not null
  group by media_id
  order by log_count desc;
$$;

-- ============================================================
-- pg_cron: Scheduled jobs
-- Requires pg_cron extension enabled in Supabase dashboard.
-- (Database → Extensions → pg_cron → Enable)
-- ============================================================

-- Nightly at 03:00 UTC: sync behavior signals
select cron.schedule(
  'sync-behavior-signals-nightly',
  '0 3 * * *',
  $$
    select net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/sync-behavior-signals',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{"full": true}'::jsonb
    );
  $$
);

-- Weekly Sunday 02:00 UTC: re-enrich stale media rows
select cron.schedule(
  'enrich-stale-media-weekly',
  '0 2 * * 0',
  $$
    select net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/enrich-media',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{"staleOnly": true, "limit": 500}'::jsonb
    );
  $$
);

-- NOTE: After running this migration, set the required Postgres settings:
--   ALTER DATABASE postgres SET app.supabase_url  = 'https://xxx.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';
-- Or configure via Supabase dashboard → Database → Settings.
