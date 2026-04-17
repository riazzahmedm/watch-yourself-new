-- ============================================================
-- Watch Yourself: Media Enrichment Layer
-- Migration: 20260413000004_media_enrichment.sql
--
-- Adds three enrichment layers to the media table:
--
--   Layer 1 — Mood Mapping
--     Which moods does this media suit? Computed from
--     TMDB genres + keywords using our rule engine.
--
--   Layer 2 — Watch Yourself Score
--     Our own quality signal blending TMDB rating, vote
--     count, and keyword relevance. Better than raw TMDB
--     rating for recommendations.
--
--   Layer 3 — User Behavior Signals
--     Aggregated from our users' logs + mood feedback.
--     The longer Watch Yourself runs, the more unique and
--     accurate this becomes.
-- ============================================================

-- ---- Enrichment columns on media ----------------------------

alter table public.media
  -- Layer 1: mood mapping
  add column if not exists mood_scores        jsonb    not null default '{}',
  -- {mood_slug: 0.0–1.0}  e.g. {"mind_blown": 0.91, "existential": 0.6}
  add column if not exists mood_tag_slugs     text[]   not null default '{}',
  -- Denorm array for fast overlap queries e.g. WHERE mood_tag_slugs && '{mind_blown}'

  -- Layer 2: Watch Yourself score
  add column if not exists watch_yourself_score     numeric(4,3) default null,
  -- Our blended quality signal (0.0–1.0). Null = not yet computed.

  -- Layer 3: user behavior signals (updated by sync-behavior-signals)
  add column if not exists total_logs_count   int      not null default 0,
  add column if not exists avg_user_rating    numeric(3,2) default null,
  add column if not exists mood_match_rates   jsonb    not null default '{}',
  -- {mood_slug: 0.0–1.0} match rate from MoodFeedback rows
  add column if not exists last_enriched_at   timestamptz default null;

comment on column public.media.mood_scores      is 'Mood relevance scores per mood slug, 0–1. Computed by enrich-media.';
comment on column public.media.mood_tag_slugs   is 'Denorm array of applicable mood slugs for fast GIN queries.';
comment on column public.media.watch_yourself_score   is 'Watch Yourself quality signal 0–1 (blends TMDB rating + vote depth + keyword richness).';
comment on column public.media.total_logs_count is 'How many times this media has been logged by Watch Yourself users.';
comment on column public.media.avg_user_rating  is 'Average rating by Watch Yourself users (different from TMDB vote_average).';
comment on column public.media.mood_match_rates is 'Per-mood match rate from MoodFeedback. Our proprietary signal.';
comment on column public.media.last_enriched_at is 'When enrich-media last ran on this row.';

-- Index for mood-based queries (the hot path for recommendations)
create index if not exists idx_media_mood_slugs
  on public.media using gin(mood_tag_slugs);

create index if not exists idx_media_watch_yourself_score
  on public.media(watch_yourself_score desc nulls last);

create index if not exists idx_media_enriched
  on public.media(last_enriched_at nulls first);

-- ---- Catalog import tracking --------------------------------
-- Tracks which TMDB Discover pages we've already imported
-- so the import-catalog function can resume / avoid duplicates.

create table public.catalog_import_log (
  id            uuid        primary key default uuid_generate_v4(),
  mood_slug     text        not null,
  tmdb_page     int         not null,
  media_count   int         not null default 0,
  imported_at   timestamptz not null default now(),
  unique (mood_slug, tmdb_page)
);

comment on table public.catalog_import_log is 'Tracks which TMDB Discover pages have been imported per mood to avoid re-fetching.';

alter table public.catalog_import_log enable row level security;

-- Only service role reads/writes this
create policy "catalog_import_log_service_only"
  on public.catalog_import_log for all
  using (false);  -- blocks all direct client access

-- ---- DB function: compute_watch_yourself_score --------------------
-- Pure SQL formula so it can be called from migrations or triggers.

create or replace function public.compute_watch_yourself_score(
  p_tmdb_rating    numeric,
  p_vote_count     int,
  p_keyword_count  int   default 0
) returns numeric language sql immutable as $$
  select round(
    (
      -- Normalised rating: TMDB is 0–10, we want 0–1
      (coalesce(p_tmdb_rating, 0) / 10.0) * 0.55

      -- Vote depth: log-scaled, caps at ~100k votes → 1.0
      + least(ln(greatest(coalesce(p_vote_count, 0), 1)) / ln(100000), 1.0) * 0.35

      -- Keyword richness: more descriptive metadata = better matching
      + least(coalesce(p_keyword_count, 0)::numeric / 20.0, 1.0) * 0.10
    )::numeric,
    3  -- 3 decimal places
  );
$$;

-- ---- DB function: update_media_behavior_signals -------------
-- Called by sync-behavior-signals Edge Function AND by a trigger.

create or replace function public.refresh_media_behavior_signals(p_media_id uuid)
returns void language plpgsql security definer as $$
declare
  v_log_count   int;
  v_avg_rating  numeric(3,2);
begin
  -- Count total logs for this media
  select
    count(*),
    round(avg(rating)::numeric, 2)
  into v_log_count, v_avg_rating
  from public.logs
  where media_id = p_media_id
    and rating is not null;

  update public.media
  set
    total_logs_count = coalesce(v_log_count, 0),
    avg_user_rating  = v_avg_rating
  where id = p_media_id;
end;
$$;

-- Trigger: update behavior signals whenever a log is inserted or deleted
create or replace function public.trg_update_media_behavior()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    perform public.refresh_media_behavior_signals(new.media_id);
  elsif TG_OP = 'DELETE' then
    perform public.refresh_media_behavior_signals(old.media_id);
  elsif TG_OP = 'UPDATE' and old.rating is distinct from new.rating then
    perform public.refresh_media_behavior_signals(new.media_id);
  end if;
  return null;
end;
$$;

create trigger trg_media_behavior_on_log
  after insert or update or delete on public.logs
  for each row execute function public.trg_update_media_behavior();

-- ---- View: enriched_media -----------------------------------
-- Convenience view joining media with mood tag labels.
-- Used by Edge Functions to get fully resolved media rows.

create or replace view public.enriched_media as
select
  m.*,
  -- Computed columns for easy consumption
  public.compute_watch_yourself_score(
    m.tmdb_rating,
    m.tmdb_vote_count,
    array_length(m.tmdb_keywords, 1)
  ) as computed_score,
  -- Human-readable mood labels array
  (
    select array_agg(mt.label order by mt.display_order)
    from public.mood_tags mt
    where mt.slug = any(m.mood_tag_slugs)
  ) as mood_labels
from public.media m;

comment on view public.enriched_media is 'media rows with computed_score and resolved mood_labels.';
