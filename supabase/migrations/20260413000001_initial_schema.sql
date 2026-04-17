-- ============================================================
-- CineMood: Initial Schema
-- Migration: 20260413000001_initial_schema.sql
-- ============================================================

-- Enable required Postgres extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- for fuzzy text search on media titles

-- ============================================================
-- ENUMS
-- ============================================================

create type media_type_enum     as enum ('movie', 'series');
create type log_type_enum       as enum ('movie', 'series_episode', 'series_season', 'series_full');
create type pace_enum           as enum ('slow', 'medium', 'fast', 'mixed');
create type mood_match_enum     as enum ('yes', 'no', 'somewhat');
create type period_type_enum    as enum ('month', 'year');

-- ============================================================
-- PROFILES
-- Extends Supabase auth.users — one row per user
-- ============================================================

create table public.profiles (
  id                uuid        primary key references auth.users(id) on delete cascade,
  username          text        unique not null,
  display_name      text,
  avatar_url        text,
  bio               text,
  -- denormalised counters (updated by triggers for fast reads)
  total_logs        int         not null default 0,
  total_watch_hours int         not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'Public user profile extending auth.users';

-- ============================================================
-- MOOD TAGS  (seeded — not user-created in v1)
-- ============================================================

create table public.mood_tags (
  id                uuid        primary key default uuid_generate_v4(),
  slug              text        unique not null,        -- 'feeling_low'
  label             text        not null,               -- 'Feeling Low'
  emoji             text        not null,               -- '😔'
  description       text,                               -- one-line shown in UI
  display_order     int         not null default 0,
  -- recommendation engine config
  preferred_genres  int[]       not null default '{}',  -- TMDB genre IDs
  avoid_genres      int[]       not null default '{}',
  pace_preference   pace_enum,
  preferred_tone    text[]      not null default '{}',
  min_tmdb_rating   numeric(3,1) not null default 6.5,
  max_runtime_mins  int,                                -- null = no cap
  created_at        timestamptz not null default now()
);

comment on table public.mood_tags is 'Fixed mood options that drive the recommendation engine. Seeded, not user-created.';

-- ============================================================
-- MEDIA  (shared TMDB cache across all users)
-- ============================================================

create table public.media (
  id                uuid            primary key default uuid_generate_v4(),
  tmdb_id           int             unique not null,
  media_type        media_type_enum not null,
  title             text            not null,
  original_title    text,
  overview          text,
  poster_path       text,
  backdrop_path     text,
  release_year      int,
  tmdb_genres       jsonb           not null default '[]', -- [{id, name}]
  tmdb_genre_ids    int[]           not null default '{}', -- denorm for fast filtering
  runtime_minutes   int,
  tmdb_rating       numeric(3,1),
  tmdb_vote_count   int             not null default 0,
  original_language text,
  status            text,
  tmdb_keywords     text[]          not null default '{}',
  cached_at         timestamptz     not null default now(),
  created_at        timestamptz     not null default now()
);

comment on table public.media is 'TMDB-sourced movie and series metadata. Shared across all users.';

create index idx_media_tmdb_id       on public.media(tmdb_id);
create index idx_media_type          on public.media(media_type);
create index idx_media_genre_ids     on public.media using gin(tmdb_genre_ids);
create index idx_media_rating        on public.media(tmdb_rating desc);
create index idx_media_title_trgm    on public.media using gin(title gin_trgm_ops);

-- ============================================================
-- EPISODES  (series episodes, cached from TMDB)
-- ============================================================

create table public.episodes (
  id                uuid        primary key default uuid_generate_v4(),
  media_id          uuid        not null references public.media(id) on delete cascade,
  tmdb_episode_id   int         unique,
  season_number     int         not null,
  episode_number    int         not null,
  title             text,
  overview          text,
  air_date          date,
  runtime_minutes   int,
  still_path        text,
  cached_at         timestamptz not null default now(),
  unique (media_id, season_number, episode_number)
);

comment on table public.episodes is 'TMDB episode data. Cached per series.';

create index idx_episodes_media_id on public.episodes(media_id);
create index idx_episodes_season   on public.episodes(media_id, season_number);

-- ============================================================
-- LOGS  (core user activity)
-- ============================================================

create table public.logs (
  id                uuid            primary key default uuid_generate_v4(),
  user_id           uuid            not null references public.profiles(id) on delete cascade,
  media_id          uuid            not null references public.media(id),
  episode_id        uuid            references public.episodes(id),   -- null = full movie/season/series
  log_type          log_type_enum   not null,
  watched_at        date            not null default current_date,
  rating            numeric(2,1)    check (rating >= 0.5 and rating <= 5.0),
  review            text,
  mood_tag_id       uuid            references public.mood_tags(id),
  is_rewatch        boolean         not null default false,
  is_private        boolean         not null default false,
  binge_session     boolean         not null default false,  -- 3+ episodes within 6 hrs
  created_at        timestamptz     not null default now(),
  updated_at        timestamptz     not null default now()
);

comment on table public.logs is 'Core watch log entries. One row per movie watched or episode watched.';

create index idx_logs_user_watched       on public.logs(user_id, watched_at desc);
create index idx_logs_user_media         on public.logs(user_id, media_id);
create index idx_logs_user_mood          on public.logs(user_id, mood_tag_id);
create index idx_logs_mood_tag           on public.logs(mood_tag_id);
create index idx_logs_created_at         on public.logs(created_at desc);

-- ============================================================
-- MOOD FEEDBACK  (post-watch validation)
-- ============================================================

create table public.mood_feedback (
  id                uuid            primary key default uuid_generate_v4(),
  user_id           uuid            not null references public.profiles(id) on delete cascade,
  log_id            uuid            not null references public.logs(id) on delete cascade,
  media_id          uuid            not null references public.media(id),
  mood_tag_id       uuid            not null references public.mood_tags(id),
  match_response    mood_match_enum not null,
  created_at        timestamptz     not null default now(),
  unique (log_id)   -- one feedback per log
);

comment on table public.mood_feedback is 'Did the movie match the mood? Drives engine tuning.';

create index idx_mood_feedback_mood on public.mood_feedback(mood_tag_id, match_response);

-- ============================================================
-- TASTE DNA  (computed per user)
-- ============================================================

create table public.taste_dna (
  id                    uuid        primary key default uuid_generate_v4(),
  user_id               uuid        unique not null references public.profiles(id) on delete cascade,
  -- genre affinities: {tmdb_genre_id: 0.0–1.0}  e.g. {"28": 0.82, "18": 0.65}
  genre_affinities      jsonb       not null default '{}',
  pace_tolerance        pace_enum,
  twist_dependency      numeric(3,2) check (twist_dependency >= 0 and twist_dependency <= 1),
  comfort_rewatcher     boolean     not null default false,
  series_vs_movie       numeric(3,2) check (series_vs_movie >= 0 and series_vs_movie <= 1),
  binge_vs_casual       numeric(3,2) check (binge_vs_casual >= 0 and binge_vs_casual <= 1),
  avg_rating            numeric(2,1),
  total_logged          int         not null default 0,
  -- twin matching cache: [{user_id, username, avatar_url, match_score}]
  twin_cache            jsonb       not null default '[]',
  twin_cache_updated_at timestamptz,
  last_computed_at      timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.taste_dna is 'Computed user taste profile. Recomputed after every 5 new logs.';

-- ============================================================
-- TIMELINE PERIODS  (monthly/yearly summaries)
-- ============================================================

create table public.timeline_periods (
  id                    uuid            primary key default uuid_generate_v4(),
  user_id               uuid            not null references public.profiles(id) on delete cascade,
  period_type           period_type_enum not null,
  period_year           int             not null,
  period_month          int             check (period_month >= 1 and period_month <= 12), -- null for yearly
  dominant_mood_id      uuid            references public.mood_tags(id),
  dominant_genre        text,
  phase_label           text,            -- "Thriller phase", "Cozy season", etc.
  life_context_note     text,            -- user-written diary entry
  watch_count           int             not null default 0,
  total_hours           int             not null default 0,
  avg_rating            numeric(2,1),
  binge_session_count   int             not null default 0,
  computed_at           timestamptz     not null default now(),
  created_at            timestamptz     not null default now(),
  updated_at            timestamptz     not null default now(),
  unique (user_id, period_type, period_year, period_month)
);

comment on table public.timeline_periods is 'Pre-computed monthly/yearly summaries for the timeline screen.';

create index idx_timeline_user_period on public.timeline_periods(user_id, period_year desc, period_month desc);

-- ============================================================
-- WATCHLIST
-- ============================================================

create table public.watchlist (
  id                uuid        primary key default uuid_generate_v4(),
  user_id           uuid        not null references public.profiles(id) on delete cascade,
  media_id          uuid        not null references public.media(id),
  added_at          timestamptz not null default now(),
  unique (user_id, media_id)
);

comment on table public.watchlist is 'Movies/series the user wants to watch.';

create index idx_watchlist_user on public.watchlist(user_id, added_at desc);

-- ============================================================
-- DEVICE TOKENS  (push notifications)
-- ============================================================

create table public.device_tokens (
  id                uuid        primary key default uuid_generate_v4(),
  user_id           uuid        not null references public.profiles(id) on delete cascade,
  expo_push_token   text        not null,
  platform          text        not null check (platform in ('ios', 'android')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

comment on table public.device_tokens is 'Expo push tokens per device. Used by send-push Edge Function.';

create index idx_device_tokens_user on public.device_tokens(user_id);

-- ============================================================
-- TRIGGERS: auto-update updated_at columns
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_logs_updated_at
  before update on public.logs
  for each row execute function public.set_updated_at();

create trigger trg_taste_dna_updated_at
  before update on public.taste_dna
  for each row execute function public.set_updated_at();

create trigger trg_timeline_updated_at
  before update on public.timeline_periods
  for each row execute function public.set_updated_at();

create trigger trg_device_tokens_updated_at
  before update on public.device_tokens
  for each row execute function public.set_updated_at();

-- ============================================================
-- TRIGGERS: auto-create profile on auth.users insert
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    -- derive a username from email or provider metadata
    coalesce(
      new.raw_user_meta_data->>'preferred_username',
      new.raw_user_meta_data->>'user_name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  -- also create an empty taste_dna row
  insert into public.taste_dna (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- TRIGGERS: update profile counters on log insert/delete
-- ============================================================

create or replace function public.update_profile_log_count()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles
    set total_logs = total_logs + 1
    where id = new.user_id;
  elsif TG_OP = 'DELETE' then
    update public.profiles
    set total_logs = greatest(total_logs - 1, 0)
    where id = old.user_id;
  end if;
  return null;
end;
$$;

create trigger trg_log_count
  after insert or delete on public.logs
  for each row execute function public.update_profile_log_count();
