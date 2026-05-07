# Rich Media Logging — Design Spec
**Date:** 2026-05-06  
**Status:** Approved  
**Scope:** Media detail screen + enhanced log sheet with granular mood capture

---

## 1. Overview

This spec covers two interconnected features:

1. **Media Detail Screen** — a first-class browseable screen showing trailer, cast, synopsis, episodes, streaming availability, and genre for any movie or series.
2. **Enhanced Log Sheet** — a 4-step logging flow capturing a creative rating (reaction stamps), watch platform, interest hook, favourite cast member, pre-watch emotional state (via evocative question), and post-watch emotional state (via two fast body-check questions).

**Goal:** Capture rich, honest emotional data around every watch so the recommendation engine and Taste DNA can deliver truly personalised experiences.

---

## 2. Architecture Decision

**Option A selected: Extended Log Sheet + Standalone Media Detail Screen.**

- The media detail screen lives at `app/media/[id].tsx` — a first-class route reachable from Discover, Library, and the log sheet search results.
- The log sheet modal gains two new steps (pre/post mood check-in) but remains a self-contained modal flow.
- Both paths are independent — users can browse media details without logging, and log without visiting the detail screen.
- The "Log This" button on the detail screen pre-selects the media and skips Step 1 of the log sheet.

---

## 3. Database Schema

### 3.1 New Tables

#### `media_cast`
Stores top cast members per media item. Fetched from TMDB and cached.

```sql
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
create index idx_media_cast_media_id on public.media_cast(media_id, billing_order);
```

#### `media_videos`
Stores YouTube trailer keys per media item.

```sql
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
create index idx_media_videos_media_id on public.media_videos(media_id);
```

#### `media_watch_providers`
Stores streaming availability per media item and country.

```sql
create table public.media_watch_providers (
  id                  uuid    primary key default gen_random_uuid(),
  media_id            uuid    not null references public.media(id) on delete cascade,
  country_code        text    not null,   -- 'US', 'GB', 'IN', etc.
  provider_name       text    not null,
  provider_logo_path  text,
  provider_type       text    not null,   -- 'flatrate' | 'rent' | 'buy'
  display_priority    int     not null default 0,
  cached_at           timestamptz not null default now()
);
create index idx_watch_providers_media_country on public.media_watch_providers(media_id, country_code);
```

Cache TTL: 7 days (streaming availability changes frequently).

#### `emotions`
Seeded lookup table of ~20 granular emotional states.

```sql
create table public.emotions (
  id           uuid    primary key default gen_random_uuid(),
  slug         text    unique not null,
  label        text    not null,
  emoji        text    not null,
  valence      text    not null check (valence in ('positive', 'negative', 'neutral')),
  energy_level smallint not null check (energy_level between 1 and 5)
);
```

**Seeded emotions:**

| Slug | Label | Emoji | Valence | Energy |
|---|---|---|---|---|
| happy | Happy | 😊 | positive | 5 |
| excited | Excited | 🎉 | positive | 5 |
| inspired | Inspired | ✨ | positive | 5 |
| hopeful | Hopeful | 🌱 | positive | 4 |
| curious | Curious | 🔍 | positive | 4 |
| grateful | Grateful | 🙏 | positive | 3 |
| content | Content | 😌 | positive | 3 |
| peaceful | Peaceful | 🕊️ | positive | 2 |
| nostalgic | Nostalgic | 🌅 | neutral | 2 |
| reflective | Reflective | 💭 | neutral | 3 |
| bored | Bored | 😑 | neutral | 2 |
| restless | Restless | 🌀 | neutral | 4 |
| sad | Sad | 😢 | negative | 2 |
| melancholic | Melancholic | 🌧️ | negative | 2 |
| lonely | Lonely | 🌃 | negative | 2 |
| tired | Tired | 😴 | negative | 1 |
| drained | Drained | 🪫 | negative | 1 |
| numb | Numb | 🌫️ | negative | 1 |
| anxious | Anxious | 😰 | negative | 4 |
| stressed | Stressed | 😤 | negative | 5 |
| overwhelmed | Overwhelmed | 🌊 | negative | 5 |

#### `mood_questions`
Pool of evocative pre-watch questions. Rotated randomly at log time.

```sql
create table public.mood_questions (
  id            uuid    primary key default gen_random_uuid(),
  question_text text    not null,
  -- Each option: { label, emoji, emotion_slug }
  option_a      jsonb   not null,
  option_b      jsonb   not null,
  option_c      jsonb   not null,
  option_d      jsonb   not null,
  option_e      jsonb   not null,
  option_f      jsonb            -- optional 6th option, nullable (not all questions need 6)
);
```

**Seeded questions (minimum 5):**

*Q1:* "If your inner world were weather right now, it'd be…"
- 🌫️ Foggy → numb
- 🌧️ Drizzly → melancholic
- ☁️ Overcast → tired
- 🌬️ Breezy → content
- ⛈️ Stormy → anxious
- ☀️ Sunny → happy

*Q2:* "Right now you feel most like…"
- 🪫 A drained phone → drained
- 🐢 A slow Sunday → peaceful
- 🌪️ A spinning top → restless
- 🕯️ A quiet flame → hopeful
- 🎸 A live wire → excited
- 🌊 A crashing wave → overwhelmed

*Q3:* "The last thing that crossed your mind was…"
- 😶 Nothing, actually → numb
- 💭 A distant memory → nostalgic
- ✅ Something I need to do → anxious
- 💛 Someone I care about → grateful
- 🌌 Something bigger than me → reflective
- 😂 Something that made me laugh → happy

*Q4:* "If you were a room right now, you'd be…"
- 🪞 A dimly lit hallway → melancholic
- 🛋️ A cosy living room → content
- 🏚️ An empty house → lonely
- 🎆 A rooftop at night → inspired
- 🌀 A room with too much in it → overwhelmed
- 🌅 A sunlit window seat → peaceful

*Q5:* "Your inner volume is currently set to…"
- 🔇 Muted → numb
- 🔈 Low and distant → sad
- 🔉 Background hum → reflective
- 🔊 Normal and present → content
- 📣 Loud and buzzing → restless
- 🔔 Sharp and alert → curious

---

### 3.2 New Columns on `logs`

```sql
alter table public.logs
  add column reaction_stamp        text check (reaction_stamp in (
    'meh', 'decent', 'liked_it', 'loved_it', 'mind_shifted', 'life_film'
  )),
  add column watch_platform        text check (watch_platform in (
    'netflix', 'prime', 'disney_plus', 'apple_tv', 'hbo_max', 'hulu',
    'youtube', 'cinema', 'tv', 'other', 'unofficial'
  )),
  add column interest_hook         text check (interest_hook in (
    'cast', 'premise', 'creator', 'studio', 'franchise', 'universe', 'other'
  )),
  add column pre_watch_emotion_id  uuid references public.emotions(id),
  add column post_watch_emotion_id uuid references public.emotions(id),
  add column pre_watch_question_id uuid references public.mood_questions(id),
  add column pre_watch_answer      text,
  add column post_energy_level     smallint check (post_energy_level between 1 and 5),
  add column post_mind_level       smallint check (post_mind_level between 1 and 5),
  add column favorite_cast_id      uuid references public.media_cast(id);
```

### 3.3 Reaction Stamp → Rating Trigger

The existing `rating` column is auto-populated from `reaction_stamp` so the recommendation engine requires no changes:

```sql
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

create or replace function public.trg_stamp_to_rating_fn()
returns trigger language plpgsql as $$
begin
  if new.reaction_stamp is not null then
    new.rating := public.stamp_to_rating(new.reaction_stamp);
  end if;
  return new;
end;
$$;

create trigger trg_stamp_to_rating
  before insert or update on public.logs
  for each row execute function public.trg_stamp_to_rating_fn();
```

---

## 4. Media Detail Screen (`app/media/[id].tsx`)

### 4.1 Entry Points
- Tapping any poster card in Discover
- Tapping any row in Library
- Tapping a search result in the Log Sheet
- "Log This" button navigates here pre-selecting the media

### 4.2 Layout

**Hero zone (fixed, non-scrollable)**
- Full-bleed backdrop image with `posterOverlay` gradient scrim fading to `#080810`
- Back chevron top-left
- Title, year badge, runtime pill, media type badge — bottom-left over gradient
- Pulsing ▶ Trailer button — centered bottom of hero
  - Opens a WebView modal with YouTube embed (`https://www.youtube.com/embed/{key}?autoplay=1`)
  - Falls back to "No trailer available" state if `media_videos` is empty

**Scrollable body:**

1. **Quick stats row** — Release date · Runtime · TMDB rating · Seasons + Episodes (series only). Pill chips.

2. **Genre pills** — horizontal scroll. Coloured using mood colour tokens where genre overlaps, neutral `Colors.surface` otherwise.

3. **Synopsis** — collapsed to 3 lines, "Read more" expands inline.

4. **Cast** — `"Top Cast"` section header. Horizontal scroll of circular photo chips (60px diameter). Actor name + character name beneath each. Sourced from `media_cast` ordered by `billing_order`. Shows placeholder avatar if `profile_path` is null.

5. **Where to Watch** — `"Where to Watch"` section header. Provider logos (40px) in a horizontal row grouped by type: Streaming → Rent → Buy. Filtered to device country via `Intl.DateTimeFormat().resolvedOptions().locale` parsed to ISO country code. "Not currently streaming in your region" if empty.

6. **Episodes** (series only) — `"Episodes"` section header. Season accordion rows. Tapping a season expands to a list of episodes: still image (80×45px), episode number + title, air date, runtime, synopsis (collapsed). Sourced from `episodes` table.

7. **What interests you most?** — `"What draws you to this?"` section header. 6 chip options in a 2-column grid:
   - 🎭 The Cast · 💡 The Premise · 🎬 The Creator
   - 🏛️ The Studio · 🌌 The Franchise · ✨ Something Else
   - Tapping one pre-fills `interest_hook` in the log form. Selection persists in component state only — not saved until the log is submitted.

8. **Sticky bottom CTA**
   - Not yet logged: gradient "Log This" button
   - Already logged: reaction stamp badge + "Log Again" ghost button side-by-side

### 4.3 Data Hook: `useMediaDetail(id)`

```typescript
// Calls tmdb-detail edge function
// Returns: media row + cast + videos + watch providers + episodes (series)
// Caches with TanStack Query, staleTime: 30 min
```

---

## 5. Enhanced Log Sheet Flow

### Step 1 — Search *(unchanged)*
- Skipped entirely if arriving from the media detail "Log This" button

### Step 2 — Pre-watch Check-in
- A random question fetched from `mood_questions` (or from a local constant for offline support)
- 2×3 grid of large tappable tiles — emoji (32px) + label
- Tapping auto-advances after 300ms spring animation
- Stores: `pre_watch_question_id`, `pre_watch_answer`, resolved `pre_watch_emotion_id`
- "Skip →" link top-right dismisses this step without storing emotion data

### Step 3 — Log Form

Sections top to bottom:

**Media card** — glass surface, poster thumbnail + title + year. Tap → back to search.

**Reaction Stamp** — 3×2 grid of rounded cards. Each card:
- Unique icon + colour
- Label beneath
- Tapping: spring scale animation (1.0 → 1.08 → 1.0) + medium haptic
- Selected state: accent border glow

| Stamp | Icon | Colour |
|---|---|---|
| Meh | 😑 | `#44445a` muted grey |
| Decent | 👌 | `#6ea8fe` blue |
| Liked It | 😊 | `#86efac` green |
| Loved It | ❤️ | `#f87171` coral |
| Mind-Shifted | 🤯 | `#c084fc` purple |
| Life Film | 🎖️ | `#facc15` gold — card is 10% larger to signal prestige |

**Watch Platform** — `"Where did you watch?"` label. Horizontal scroll of platform chips with icon logos. Platforms:
`Netflix · Prime · Disney+ · Apple TV+ · HBO Max · Hulu · YouTube · Cinema · TV · Other · 👁️ Unofficial`

Unofficial chip: ghost border, no logo, subtle styling — present but not promoted.

**Interest Hook** — `"What drew you to this?"` label. 6 chips in a 2-row wrap:
`🎭 Cast · 💡 Premise · 🎬 Creator · 🏛️ Studio · 🌌 Franchise · ✨ Other`
Pre-filled if selected on the detail screen.

**Favourite Cast Member** — `"Who stood out?"` label. Horizontal scroll of the top 10 cast circular photo chips from `media_cast`. Tapping selects one (accent ring). Optional.

**Review** — textarea, 300 char limit + counter. Optional placeholder: "What stayed with you?"

**Date** — Today / Yesterday / Other pills (unchanged).

**Rewatch + Private toggles** — unchanged.

**Submit CTA** — gradient "Save Log" button.

### Step 4 — Post-watch Check-in (non-blocking bottom sheet)

Appears after the log modal closes. Slides up as a small bottom sheet. Can be swiped away.

```
"How are you feeling now?"

Energy   🪫 Drained  😔 Low  😐 Neutral  ⚡ Buzzing  🔥 Wired
Mind     💭 Empty   🌤️ Light  😐 Neutral  🤔 A bit full  🌀 Spinning
```

Two horizontal pill rows, one tap each. On both selected → "Done" button appears.

Submits to `resolve-emotion` edge function which patches the log record and returns the resolved emotion label. App shows a brief toast: "You're feeling **Inspired** ✨"

"Maybe later" dismisses without saving.

### Emotion Triangulation Matrix

| Energy | Mind | Resolved Emotion |
|---|---|---|
| Drained | Spinning | overwhelmed |
| Drained | Empty | numb |
| Drained | Light | peaceful |
| Drained | Neutral | tired |
| Drained | A bit full | drained |
| Low | Spinning | anxious |
| Low | Light | melancholic |
| Low | Neutral | sad |
| Low | Empty | lonely |
| Low | A bit full | reflective |
| Neutral | Neutral | content |
| Neutral | A bit full | reflective |
| Neutral | Light | peaceful |
| Neutral | Spinning | restless |
| Neutral | Empty | bored |
| Buzzing | Light | hopeful |
| Buzzing | A bit full | inspired |
| Buzzing | Spinning | restless |
| Buzzing | Neutral | grateful |
| Buzzing | Empty | curious |
| Wired | Spinning | anxious |
| Wired | Light | excited |
| Wired | Empty | curious |
| Wired | A bit full | inspired |
| Wired | Neutral | excited |

---

## 6. Edge Function Changes

### 6.1 `tmdb-detail` — Extended

Adds a single `append_to_response=credits,videos,watch/providers` parameter to the existing TMDB fetch. One API call, three new data sets.

**New behaviour:**
1. **Cast** — takes `cast` array, top 20 by `order`. Upserts `media_cast`. Cache TTL: 30 days.
2. **Videos** — filters `results` for `site=YouTube`, prioritises `type=Trailer` + `official=true`. Upserts `media_videos`. Cache TTL: 30 days.
3. **Watch Providers** — extracts `results[countryCode].flatrate/rent/buy`. Upserts `media_watch_providers`. Cache TTL: 7 days.

Country code passed as optional query param: `?countryCode=GB`. Defaults to `US`.

**New request body fields:**
```typescript
{ tmdbId: number, mediaType: "movie" | "series", seasonNumber?: number, countryCode?: string }
```

### 6.2 New: `resolve-emotion` edge function

**POST** `/functions/v1/resolve-emotion`

**Request:**
```typescript
{ logId: string, energyLevel: 1|2|3|4|5, mindLevel: 1|2|3|4|5 }
```

**Logic:**
1. Auth check (standard user JWT)
2. Map `energyLevel` to label: `1=Drained, 2=Low, 3=Neutral, 4=Buzzing, 5=Wired`
3. Map `mindLevel` to label: `1=Empty, 2=Light, 3=Neutral, 4=A bit full, 5=Spinning`
4. Look up emotion slug in triangulation matrix (hardcoded const)
5. Fetch `emotions` row by slug
6. Update `logs` record: `post_watch_emotion_id`, `post_energy_level`, `post_mind_level`
7. Return `{ emotion: { slug, label, emoji } }`

**Unchanged functions:** `mood-recommendations`, `generate-taste-dna`, `import-catalog`, `catalog-scheduler`, `enrich-media`

---

## 7. New Mobile Hooks

| Hook | File | Purpose |
|---|---|---|
| `useMediaDetail` | `hooks/useMediaDetail.ts` | Fetch media + cast + videos + providers via `tmdb-detail` |
| `useMoodQuestion` | `hooks/useMoodQuestion.ts` | Return a random question from local constant (offline-safe) |
| `useEmotions` | `hooks/useEmotions.ts` | Fetch `emotions` table (cached, rarely changes) |
| `useResolveEmotion` | `hooks/useResolveEmotion.ts` | Mutation calling `resolve-emotion` edge function |

---

## 8. New Migrations

| File | Purpose |
|---|---|
| `20260506000001_rich_logging_tables.sql` | `media_cast`, `media_videos`, `media_watch_providers`, `emotions`, `mood_questions` tables + RLS |
| `20260506000002_rich_logging_log_columns.sql` | New columns on `logs` + `stamp_to_rating` trigger |
| `20260506000003_seed_emotions.sql` | Seed 21 emotion rows |
| `20260506000004_seed_mood_questions.sql` | Seed 5 evocative questions |

---

## 9. What Stays Unchanged

- `rating` column on `logs` — auto-populated by trigger, backward-compatible
- `mood_tag_id` on `logs` — still used for recommendation mood tagging
- `mood-recommendations` edge function — no changes
- `generate-taste-dna` edge function — will incorporate emotion fields in a future iteration
- Discover screen, Library screen, Timeline screen, Profile screen — no changes in this spec
- Onboarding — no changes
- Auth — no changes

---

## 10. Success Criteria

- User can browse a media detail page from Discover or Library without logging
- Trailer plays in-app via YouTube WebView
- Cast, streaming providers, and episodes load from the DB (no runtime TMDB calls)
- The 4-step log flow captures pre-watch emotion, reaction stamp, platform, interest hook, cast pick, and post-watch emotion
- `rating` is auto-populated from `reaction_stamp` — recommendation engine unchanged
- Post-watch check-in is non-blocking and dismissible
- All new `logs` columns are optional — existing logs and the offline queue continue to work
