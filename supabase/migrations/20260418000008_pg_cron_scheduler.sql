-- ============================================================
-- Automated catalog refresh — pg_cron scheduler
--
-- pg_cron is pre-installed on all Supabase plans.
-- pg_net (HTTP from SQL) requires Pro tier.
--
-- FREE TIER path  : cron job is registered. Trigger manually
--                   via curl to catalog-scheduler when needed.
-- PRO TIER path   : pg_net auto-calls catalog-scheduler weekly.
--
-- After applying this migration, set the admin key:
--   select watch_yourself.set_catalog_key('<IMPORT_ADMIN_KEY>');
-- ============================================================

-- ---- App settings table (service_role only via RLS) ---------

create schema if not exists watch_yourself;

create table if not exists watch_yourself.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- Only service_role can read/write (migration user = service_role)
alter table watch_yourself.app_settings enable row level security;
-- No policies → anon/authenticated cannot access; service_role bypasses RLS

-- Helper to set the catalog admin key
create or replace function watch_yourself.set_catalog_key(p_key text)
returns void
language sql security definer as $$
  insert into watch_yourself.app_settings (key, value, updated_at)
  values ('import_admin_key', p_key, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
$$;

-- Seed with placeholder (replace after migration with set_catalog_key())
insert into watch_yourself.app_settings (key, value)
values ('import_admin_key', 'REPLACE_ME')
on conflict (key) do nothing;

-- ---- HTTP trigger function (uses pg_net on Pro) --------------

create or replace function watch_yourself.trigger_catalog_refresh()
returns void
language plpgsql security definer as $$
declare
  v_key  text;
  v_url  text := 'https://fnzmnurbfewcpgbgyfnu.supabase.co/functions/v1/catalog-scheduler';
begin
  select value into v_key
  from   watch_yourself.app_settings
  where  key = 'import_admin_key';

  if v_key is null or v_key = 'REPLACE_ME' then
    raise warning '[catalog-scheduler] Admin key not set — skipping HTTP call';
    return;
  end if;

  -- pg_net: fire-and-forget HTTP POST (Pro tier)
  -- On free tier this will error; catch and log
  begin
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Admin-Key',  v_key
      ),
      body    := '{}'::jsonb
    );
    raise info '[catalog-scheduler] Weekly refresh triggered at %', now();
  exception when others then
    raise warning '[catalog-scheduler] pg_net unavailable (free tier?): %', sqlerrm;
  end;
end;
$$;

-- ---- Register the weekly cron job ---------------------------

select cron.unschedule('weekly-catalog-refresh')
where  exists (select 1 from cron.job where jobname = 'weekly-catalog-refresh');

select cron.schedule(
  'weekly-catalog-refresh',
  '0 3 * * 0',   -- Sunday 03:00 UTC
  $$ select watch_yourself.trigger_catalog_refresh(); $$
);
