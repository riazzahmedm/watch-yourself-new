-- ============================================================
-- Watch Yourself: Rich Logging — New Tables
-- Migration: 20260506000001_rich_logging_tables.sql
--
-- Adds:
--   media_cast            — cast members per media item
--   media_videos          — trailer YouTube keys per media item
--   media_watch_providers — streaming availability per country
--   emotions              — 21 granular emotional states (lookup)
--   mood_questions        — evocative pre-watch question pool
-- ============================================================

-- ============================================================
-- MEDIA CAST
-- ============================================================

create table public.media_cast (
  id               uuid    primary key default gen_random_uuid(),
  media_id         uuid    not null references public.media(id) on delete cascade,
  tmdb_person_id   int     not null,
  name             text    not null,
  character        text,
  profile_path     text,
  billing_order    int     not null default 0,
  department       text    not null default 'Acting',
  cached_at        timestamptz not null default now(),
  unique (media_id, tmdb_person_id)
);

comment on table public.media_cast is 'Top cast members per media item. Fetched once from TMDB and cached.';

create index idx_media_cast_media_id on public.media_cast(media_id, billing_order);

alter table public.media_cast enable row level security;

create policy "media_cast_select_all"
  on public.media_cast for select
  using (true);

create policy "media_cast_service_write"
  on public.media_cast for all
  using (false)
  with check (false);

-- ============================================================
-- MEDIA VIDEOS
-- ============================================================

create table public.media_videos (
  id               uuid    primary key default gen_random_uuid(),
  media_id         uuid    not null references public.media(id) on delete cascade,
  tmdb_video_key   text    not null,   -- YouTube video ID
  name             text,
  video_type       text    not null,   -- 'Trailer' | 'Teaser' | 'Clip'
  official         boolean not null default false,
  published_at     date,
  cached_at        timestamptz not null default now(),
  unique (media_id, tmdb_video_key)
);

comment on table public.media_videos is 'Trailer and teaser YouTube keys per media item.';

create index idx_media_videos_media_id on public.media_videos(media_id);

alter table public.media_videos enable row level security;

create policy "media_videos_select_all"
  on public.media_videos for select
  using (true);

create policy "media_videos_service_write"
  on public.media_videos for all
  using (false)
  with check (false);

-- ============================================================
-- MEDIA WATCH PROVIDERS
-- ============================================================

create table public.media_watch_providers (
  id                  uuid    primary key default gen_random_uuid(),
  media_id            uuid    not null references public.media(id) on delete cascade,
  country_code        text    not null,   -- 'US', 'GB', 'IN', etc.
  provider_name       text    not null,
  provider_logo_path  text,
  provider_type       text    not null check (provider_type in ('flatrate', 'rent', 'buy')),
  display_priority    int     not null default 0,
  cached_at           timestamptz not null default now()
);

comment on table public.media_watch_providers is 'Streaming availability per media item and country. Cache TTL 7 days.';

create index idx_watch_providers_media_country
  on public.media_watch_providers(media_id, country_code);

alter table public.media_watch_providers enable row level security;

create policy "media_watch_providers_select_all"
  on public.media_watch_providers for select
  using (true);

create policy "media_watch_providers_service_write"
  on public.media_watch_providers for all
  using (false)
  with check (false);

-- ============================================================
-- EMOTIONS  (seeded lookup — not user-created)
-- ============================================================

create table public.emotions (
  id           uuid     primary key default gen_random_uuid(),
  slug         text     unique not null,
  label        text     not null,
  emoji        text     not null,
  valence      text     not null check (valence in ('positive', 'negative', 'neutral')),
  energy_level smallint not null check (energy_level between 1 and 5),
  created_at   timestamptz not null default now()
);

comment on table public.emotions is 'Granular emotional states used for pre/post-watch mood capture.';

alter table public.emotions enable row level security;

create policy "emotions_select_all"
  on public.emotions for select
  using (true);

-- ============================================================
-- MOOD QUESTIONS  (seeded evocative pre-watch question pool)
-- ============================================================

create table public.mood_questions (
  id            uuid    primary key default gen_random_uuid(),
  question_text text    not null,
  -- Each option: { "label": "Foggy", "emoji": "🌫️", "emotion_slug": "numb" }
  option_a      jsonb   not null,
  option_b      jsonb   not null,
  option_c      jsonb   not null,
  option_d      jsonb   not null,
  option_e      jsonb   not null,
  option_f      jsonb,             -- nullable, not all questions need 6 options
  created_at    timestamptz not null default now()
);

comment on table public.mood_questions is 'Pool of evocative pre-watch questions. One shown randomly per log session.';

alter table public.mood_questions enable row level security;

create policy "mood_questions_select_all"
  on public.mood_questions for select
  using (true);
