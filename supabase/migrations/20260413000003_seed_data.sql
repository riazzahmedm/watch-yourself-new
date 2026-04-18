-- ============================================================
-- Watch Yourself: Seed Data
-- Migration: 20260413000003_seed_data.sql
-- ============================================================
-- TMDB Genre IDs reference:
--   28  = Action        | 12  = Adventure    | 16  = Animation
--   35  = Comedy        | 80  = Crime        | 99  = Documentary
--   18  = Drama         | 10751 = Family     | 14  = Fantasy
--   36  = History       | 27  = Horror       | 10402 = Music
--   9648 = Mystery      | 10749 = Romance    | 878 = Sci-Fi
--   10770 = TV Movie    | 53  = Thriller     | 10752 = War
--   37  = Western
-- ============================================================

-- ---- MOOD TAGS -----------------------------------------------

insert into public.mood_tags (
  id, slug, label, emoji, description, display_order,
  preferred_genres, avoid_genres,
  pace_preference, preferred_tone,
  min_tmdb_rating, max_runtime_mins
) values

-- 1. Feeling Low
(
  gen_random_uuid(),
  'feeling_low',
  'Feeling Low',
  '😔',
  'Need something gentle, warm, or quietly moving',
  1,
  array[18, 10749, 16, 10751],    -- Drama, Romance, Animation, Family
  array[27, 53, 80],               -- exclude Horror, Thriller, Crime
  'medium',
  array['uplifting', 'emotional', 'heartwarming', 'gentle'],
  7.0,
  120
),

-- 2. Need Intensity
(
  gen_random_uuid(),
  'need_intensity',
  'Need Intensity',
  '😤',
  'High energy, adrenaline, edge of your seat',
  2,
  array[28, 53, 80, 12],           -- Action, Thriller, Crime, Adventure
  array[16, 10751, 10749],         -- exclude Animation, Family, Romance
  'fast',
  array['thrilling', 'intense', 'dark', 'violent'],
  6.5,
  null
),

-- 3. Comfort Watch
(
  gen_random_uuid(),
  'comfort_watch',
  'Comfort Watch',
  '😌',
  'Something safe, familiar, and easy to enjoy',
  3,
  array[35, 10749, 16, 10751, 12], -- Comedy, Romance, Animation, Family, Adventure
  array[27, 53, 9648],              -- exclude Horror, Thriller, Mystery
  'medium',
  array['lighthearted', 'fun', 'feel-good', 'cozy'],
  6.8,
  110
),

-- 4. Mind Blown
(
  gen_random_uuid(),
  'mind_blown',
  'Mind Blown',
  '🤯',
  'Complex, twisty, mind-bending stories',
  4,
  array[878, 9648, 53, 14],        -- Sci-Fi, Mystery, Thriller, Fantasy
  array[10749, 35, 10751],          -- exclude Romance, Comedy, Family
  'medium',
  array['mindbending', 'complex', 'psychological', 'cerebral'],
  7.5,
  null
),

-- 5. Existential
(
  gen_random_uuid(),
  'existential',
  'Existential',
  '🌌',
  'Deep, philosophical, makes you question everything',
  5,
  array[18, 878, 99, 14, 36],      -- Drama, Sci-Fi, Documentary, Fantasy, History
  array[28, 27, 35],                -- exclude Action, Horror, Comedy
  'slow',
  array['philosophical', 'atmospheric', 'slow-burn', 'contemplative'],
  7.5,
  null
);

-- ---- PHASE LABEL RULES ---------------------------------------
-- Used by the generate-timeline Edge Function to assign human-
-- readable labels to monthly periods.

create table public.phase_label_rules (
  id               uuid  primary key default gen_random_uuid(),
  mood_slug        text  references public.mood_tags(slug),  -- null = match any mood
  genre_name       text,                                      -- null = match any genre
  phase_label      text  not null,
  priority         int   not null default 0                   -- higher wins on conflict
);

insert into public.phase_label_rules (mood_slug, genre_name, phase_label, priority) values
  ('need_intensity',  'Action',       'Adrenaline Phase',         10),
  ('need_intensity',  'Thriller',     'Adrenaline Phase',         10),
  ('need_intensity',  'Crime',        'Crime Obsession Phase',     9),
  ('feeling_low',     'Drama',        'Reflective Phase',         10),
  ('feeling_low',     'Romance',      'Heartache Phase',           9),
  ('comfort_watch',   'Comedy',       'Cozy Season',              10),
  ('comfort_watch',   'Romance',      'Cozy Season',              10),
  ('comfort_watch',   'Animation',    'Comfort Zone Phase',        9),
  ('mind_blown',      'Science Fiction', 'Mind-Expansion Phase',  10),
  ('mind_blown',      'Mystery',      'Mystery Phase',             9),
  ('mind_blown',      'Thriller',     'Psychological Phase',       8),
  ('existential',     'Drama',        'Searching Phase',          10),
  ('existential',     'Science Fiction', 'Cosmic Phase',           9),
  ('existential',     'Documentary',  'Truth-Seeking Phase',       8),
  (null,              'Horror',       'Dark Phase',               10),
  (null,              'War',          'War & History Phase',       8),
  (null,              'Documentary',  'Learning Phase',            7),
  (null,              'Animation',    'Animated Feels Phase',      6);

comment on table public.phase_label_rules is 'Rules used to auto-generate phase labels for timeline periods.';

alter table public.phase_label_rules enable row level security;

create policy "phase_label_rules_select_all"
  on public.phase_label_rules for select
  using (true);
