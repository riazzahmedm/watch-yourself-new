-- ============================================================
-- Switch catalog refresh from weekly to daily and add a
-- high-water-mark (HWM) so each run imports the NEXT batch
-- of TMDB pages instead of re-scanning pages 1-N every time.
--
-- HWM is stored in watch_yourself.app_settings under the key
-- 'catalog_high_water'. Two public helper functions let the
-- catalog-scheduler edge function read/write it via RPC
-- (PostgREST only exposes public schema functions).
-- ============================================================

-- ---- HWM helpers (public schema, security definer) ---------

create or replace function public.get_catalog_high_water()
returns integer
language sql
security definer
set search_path = watch_yourself, public
as $$
  select coalesce(
    (select value::integer
     from   watch_yourself.app_settings
     where  key = 'catalog_high_water'),
    0
  );
$$;

create or replace function public.set_catalog_high_water(p_page integer)
returns void
language sql
security definer
set search_path = watch_yourself, public
as $$
  insert into watch_yourself.app_settings (key, value, updated_at)
  values ('catalog_high_water', p_page::text, now())
  on conflict (key) do update
    set value      = excluded.value,
        updated_at = now();
$$;

-- Seed initial value (0 = "nothing imported yet via HWM path")
-- On conflict → leave existing value untouched so re-running the
-- migration doesn't reset a live HWM.
insert into watch_yourself.app_settings (key, value)
values ('catalog_high_water', '0')
on conflict (key) do nothing;

-- ---- Reschedule: weekly → daily ----------------------------

select cron.unschedule('weekly-catalog-refresh')
where  exists (select 1 from cron.job where jobname = 'weekly-catalog-refresh');

select cron.unschedule('daily-catalog-refresh')
where  exists (select 1 from cron.job where jobname = 'daily-catalog-refresh');

select cron.schedule(
  'daily-catalog-refresh',
  '0 3 * * *',   -- Every day at 03:00 UTC
  $$ select watch_yourself.trigger_catalog_refresh(); $$
);
