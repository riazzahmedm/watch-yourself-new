-- ============================================================
-- Watch Yourself: Row Level Security Policies
-- Migration: 20260413000002_rls_policies.sql
-- ============================================================
-- All tables that hold user data have RLS enabled.
-- Shared/public tables (media, episodes, mood_tags) are readable
-- by all authenticated users; writes are service-role only.
-- ============================================================

-- ---- PROFILES ------------------------------------------------

alter table public.profiles enable row level security;

-- Anyone can read public profiles (for twin matching, public pages)
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

-- Users can only update their own profile
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Insert handled by trigger (handle_new_user) under service role — no direct insert needed
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---- MOOD TAGS -----------------------------------------------

alter table public.mood_tags enable row level security;

-- Public read — mood tags are reference data
create policy "mood_tags_select_all"
  on public.mood_tags for select
  using (true);

-- Only service role (Edge Functions) can mutate
-- (No public insert/update/delete policies)

-- ---- MEDIA ---------------------------------------------------

alter table public.media enable row level security;

-- Any authenticated user can read cached media
create policy "media_select_authenticated"
  on public.media for select
  to authenticated
  using (true);

-- Any authenticated user can insert new media (TMDB cache population)
-- In production: restrict to service role via Edge Function. For v1 client-side insert is acceptable.
create policy "media_insert_authenticated"
  on public.media for insert
  to authenticated
  with check (true);

-- Only service role can update (cache refresh handled by Edge Functions)
-- No public update policy needed.

-- ---- EPISODES ------------------------------------------------

alter table public.episodes enable row level security;

create policy "episodes_select_authenticated"
  on public.episodes for select
  to authenticated
  using (true);

create policy "episodes_insert_authenticated"
  on public.episodes for insert
  to authenticated
  with check (true);

-- ---- LOGS ----------------------------------------------------

alter table public.logs enable row level security;

-- Users can read their own logs.
-- Public logs (is_private = false) are readable by anyone authenticated (for public profiles).
create policy "logs_select_own"
  on public.logs for select
  to authenticated
  using (
    user_id = auth.uid()
    or is_private = false
  );

-- Users can only insert their own logs
create policy "logs_insert_own"
  on public.logs for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can only update their own logs
create policy "logs_update_own"
  on public.logs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can only delete their own logs
create policy "logs_delete_own"
  on public.logs for delete
  to authenticated
  using (user_id = auth.uid());

-- ---- MOOD FEEDBACK -------------------------------------------

alter table public.mood_feedback enable row level security;

create policy "mood_feedback_select_own"
  on public.mood_feedback for select
  to authenticated
  using (user_id = auth.uid());

create policy "mood_feedback_insert_own"
  on public.mood_feedback for insert
  to authenticated
  with check (user_id = auth.uid());

-- Feedback is immutable — no update/delete policies

-- ---- TASTE DNA -----------------------------------------------

alter table public.taste_dna enable row level security;

-- Own profile: full access
create policy "taste_dna_select_own"
  on public.taste_dna for select
  to authenticated
  using (user_id = auth.uid());

-- Public profiles' DNA is readable (for twin matching feature)
-- We expose a limited view via a database function instead of direct table access.
-- Direct read requires the row to belong to a user who has made their profile public.
-- For v1: all TasteDNA is readable (no privacy toggle on DNA yet).
create policy "taste_dna_select_public"
  on public.taste_dna for select
  to authenticated
  using (true);

create policy "taste_dna_insert_own"
  on public.taste_dna for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "taste_dna_update_own"
  on public.taste_dna for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- TIMELINE PERIODS ----------------------------------------

alter table public.timeline_periods enable row level security;

-- Users read their own timeline only
create policy "timeline_select_own"
  on public.timeline_periods for select
  to authenticated
  using (user_id = auth.uid());

create policy "timeline_insert_own"
  on public.timeline_periods for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "timeline_update_own"
  on public.timeline_periods for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "timeline_delete_own"
  on public.timeline_periods for delete
  to authenticated
  using (user_id = auth.uid());

-- ---- WATCHLIST -----------------------------------------------

alter table public.watchlist enable row level security;

create policy "watchlist_select_own"
  on public.watchlist for select
  to authenticated
  using (user_id = auth.uid());

create policy "watchlist_insert_own"
  on public.watchlist for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "watchlist_delete_own"
  on public.watchlist for delete
  to authenticated
  using (user_id = auth.uid());

-- ---- DEVICE TOKENS -------------------------------------------

alter table public.device_tokens enable row level security;

create policy "device_tokens_select_own"
  on public.device_tokens for select
  to authenticated
  using (user_id = auth.uid());

create policy "device_tokens_insert_own"
  on public.device_tokens for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "device_tokens_update_own"
  on public.device_tokens for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "device_tokens_delete_own"
  on public.device_tokens for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- HELPER FUNCTIONS (callable from the mobile client)
-- ============================================================

-- Check if a username is available (used in registration flow)
create or replace function public.is_username_available(p_username text)
returns boolean language sql stable security definer as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;

-- Get a user's log count for a specific media item (have they seen this before?)
create or replace function public.user_media_log_count(p_media_id uuid)
returns int language sql stable security definer as $$
  select count(*)::int
  from public.logs
  where user_id = auth.uid()
    and media_id = p_media_id;
$$;

-- Get watched episode IDs for a series (used by episode grid UI)
create or replace function public.watched_episode_ids(p_media_id uuid)
returns setof uuid language sql stable security definer as $$
  select distinct episode_id
  from public.logs
  where user_id = auth.uid()
    and media_id = p_media_id
    and episode_id is not null;
$$;
