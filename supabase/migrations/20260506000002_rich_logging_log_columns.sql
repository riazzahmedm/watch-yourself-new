-- ============================================================
-- Watch Yourself: Rich Logging — Log Table Extensions
-- Migration: 20260506000002_rich_logging_log_columns.sql
--
-- Adds new columns to the logs table for:
--   reaction_stamp        — creative rating (replaces raw stars in UI)
--   watch_platform        — where did they watch
--   interest_hook         — what drew them to this
--   pre/post emotions     — mood capture
--   favorite_cast_id      — favourite performer from this watch
--
-- Also adds stamp_to_rating trigger to keep the existing
-- numeric rating column in sync (so recommendation engine
-- and Taste DNA require zero changes).
-- ============================================================

alter table public.logs
  add column if not exists reaction_stamp        text
    check (reaction_stamp in (
      'meh', 'decent', 'liked_it', 'loved_it', 'mind_shifted', 'life_film'
    )),
  add column if not exists watch_platform        text
    check (watch_platform in (
      'netflix', 'prime', 'disney_plus', 'apple_tv', 'hbo_max', 'hulu',
      'youtube', 'cinema', 'tv', 'other', 'unofficial'
    )),
  add column if not exists interest_hook         text
    check (interest_hook in (
      'cast', 'premise', 'creator', 'studio', 'franchise', 'universe', 'other'
    )),
  add column if not exists pre_watch_emotion_id  uuid
    references public.emotions(id),
  add column if not exists post_watch_emotion_id uuid
    references public.emotions(id),
  add column if not exists pre_watch_question_id uuid
    references public.mood_questions(id),
  add column if not exists pre_watch_answer      text,
  add column if not exists post_energy_level     smallint
    check (post_energy_level between 1 and 5),
  add column if not exists post_mind_level       smallint
    check (post_mind_level between 1 and 5),
  add column if not exists favorite_cast_id      uuid
    references public.media_cast(id);

comment on column public.logs.reaction_stamp        is 'Creative rating stamp. Auto-populates numeric rating via trigger.';
comment on column public.logs.watch_platform        is 'Platform where the user watched (netflix, cinema, unofficial, etc.)';
comment on column public.logs.interest_hook         is 'What drew the user to this title (cast, premise, creator, etc.)';
comment on column public.logs.pre_watch_emotion_id  is 'Emotional state before watching, captured via evocative question.';
comment on column public.logs.post_watch_emotion_id is 'Emotional state after watching, derived from energy+mind check-in.';
comment on column public.logs.pre_watch_question_id is 'Which mood_questions row was shown for pre-watch check-in.';
comment on column public.logs.pre_watch_answer      is 'The option label the user selected for the pre-watch question.';
comment on column public.logs.post_energy_level     is '1=Drained 2=Low 3=Neutral 4=Buzzing 5=Wired — post-watch body check.';
comment on column public.logs.post_mind_level       is '1=Empty 2=Light 3=Neutral 4=A bit full 5=Spinning — post-watch mind check.';
comment on column public.logs.favorite_cast_id      is 'The cast member the user picked as their favourite from this watch.';

-- ============================================================
-- FUNCTION: stamp_to_rating
-- Pure mapping from reaction stamp to numeric rating.
-- ============================================================

create or replace function public.stamp_to_rating(stamp text)
returns numeric language sql immutable as $$
  select case stamp
    when 'meh'          then 1.0
    when 'decent'       then 2.0
    when 'liked_it'     then 3.0
    when 'loved_it'     then 4.0
    when 'mind_shifted' then 4.5
    when 'life_film'    then 5.0
    else null
  end;
$$;

comment on function public.stamp_to_rating is 'Maps a reaction_stamp string to the equivalent numeric rating (0.5–5.0).';

-- ============================================================
-- TRIGGER: auto-populate rating from reaction_stamp
-- Keeps recommendation engine + Taste DNA unchanged.
-- ============================================================

create or replace function public.trg_stamp_to_rating_fn()
returns trigger language plpgsql as $$
begin
  -- Only overwrite rating if a stamp is provided
  if new.reaction_stamp is not null then
    new.rating := public.stamp_to_rating(new.reaction_stamp);
  end if;
  return new;
end;
$$;

create trigger trg_stamp_to_rating
  before insert or update on public.logs
  for each row execute function public.trg_stamp_to_rating_fn();
