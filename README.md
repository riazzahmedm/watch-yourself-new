# Watch Yourself

A cinematic mood-based movie and series tracking app for iOS and Android. Log what you watch, discover new films matched to how you're feeling, and build a living picture of your viewing taste — your **Taste DNA**.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Screens & Modules](#screens--modules)
- [Edge Functions](#edge-functions)
- [Database Schema](#database-schema)
- [Catalog Automation](#catalog-automation)
- [Design System](#design-system)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Development Notes](#development-notes)

---

## Overview

Watch Yourself is a dark-themed mobile app where users:

1. **Discover** films and series matched to one of five moods
2. **Log** what they've watched with a rating, review, and mood tag
3. **Build** a Taste DNA profile that evolves with every log
4. **Browse** their full watch history in the Library
5. **Reflect** on their habits over time in the Timeline

Every recommendation comes from a pre-enriched local database — no live TMDB calls at runtime. Content is refreshed automatically every week via a `pg_cron` job.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo SDK 54 / React Native 0.81 |
| Routing | Expo Router v6 (file-based) |
| State | Zustand 5 + TanStack Query v5 |
| Backend | Supabase (Postgres + Auth + RLS + Edge Functions) |
| Edge Runtime | Deno (Supabase Edge Functions) |
| Catalog Source | TMDB (The Movie Database) API |
| Scheduling | pg_cron + pg_net |
| Storage | expo-secure-store (auth tokens), react-native-mmkv (local state) |
| UI | expo-linear-gradient, expo-blur, expo-image, @expo/vector-icons |
| Charts | victory-native + @shopify/react-native-skia |
| Toasts | sonner-native |
| Lists | @shopify/flash-list |
| Gestures | react-native-gesture-handler + react-native-reanimated |

---

## Project Structure

```
watch-yourself/
├── mobile/                        # Expo React Native app
│   ├── app/
│   │   ├── _layout.tsx            # Root layout — auth gate, deep links, query client
│   │   ├── index.tsx              # Entry redirect
│   │   ├── auth.tsx               # Sign in / sign up
│   │   ├── onboarding.tsx         # Genre picker (Taste DNA cold start)
│   │   ├── log-sheet.tsx          # Log modal — search → form → submit
│   │   └── (tabs)/
│   │       ├── _layout.tsx        # Tab bar with centre FAB
│   │       ├── discover.tsx       # Mood chip + film grid
│   │       ├── library.tsx        # Watch history
│   │       ├── timeline.tsx       # Viewing habits over time
│   │       ├── profile.tsx        # Taste DNA + share card
│   │       └── log.tsx            # Placeholder (redirects to discover)
│   ├── components/
│   │   ├── MediaCard.tsx          # Cinematic poster card with gradient scrim
│   │   ├── MoodChip.tsx           # Mood selector pill
│   │   └── StarRating.tsx         # Interactive 0.5–5 star rating
│   ├── constants/
│   │   ├── colors.ts              # Design token palette + gradients
│   │   └── moods.ts               # 5 mood definitions (slug, label, emoji, color)
│   ├── hooks/
│   │   ├── useLogs.ts             # Fetch / create / delete watch logs
│   │   ├── useRecommendations.ts  # Mood-based film recommendations
│   │   ├── useSearch.ts           # TMDB search with debounce + history
│   │   └── useTasteDna.ts         # Taste DNA profile fetch
│   ├── stores/
│   │   ├── auth.ts                # Zustand auth store + Supabase listener
│   │   ├── logQueue.ts            # Offline log queue (flushes on foreground)
│   │   └── onboarding.ts          # Onboarding completion flag (MMKV persisted)
│   └── lib/
│       ├── supabase.ts            # Supabase client (SecureStore-backed)
│       └── database.types.ts      # Auto-generated Supabase types
│
└── supabase/
    ├── functions/
    │   ├── _shared/               # Shared Deno modules (cors, tmdb, supabase, enrichment)
    │   ├── import-catalog/        # Seed/refresh media from TMDB
    │   ├── catalog-scheduler/     # HTTP trigger for batch catalog refresh
    │   ├── enrich-media/          # Score media with mood + watch_yourself_score
    │   ├── mood-recommendations/  # Return ranked media for a given mood
    │   ├── generate-taste-dna/    # Build Taste DNA from user's log history
    │   ├── tmdb-search/           # Proxy TMDB search (used in log sheet)
    │   ├── tmdb-detail/           # Proxy TMDB detail enrichment
    │   ├── sync-behavior-signals/ # Record implicit signals (skips, replays)
    │   └── send-push/             # Push notification sender
    └── migrations/
        ├── 20260413000001_initial_schema.sql
        ├── 20260413000002_rls_policies.sql
        ├── 20260413000003_seed_data.sql
        ├── 20260413000004_media_enrichment.sql
        ├── 20260413000005_behavior_rpc.sql
        ├── 20260418000006_seed_movies.sql
        ├── 20260418000007_remove_static_seeds.sql
        ├── 20260418000008_pg_cron_scheduler.sql
        └── 20260418000009_set_catalog_key.sql
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                     │
│                                                         │
│  Expo Router ──► Screens ──► TanStack Query hooks       │
│                                  │                      │
│                         Supabase JS client              │
│                         (SecureStore session)           │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────┐
│                     Supabase                            │
│                                                         │
│  Auth (email + JWT) ──► RLS policies ──► Postgres DB    │
│                                                         │
│  Edge Functions (Deno):                                 │
│    mood-recommendations  ◄── app reads recommendations  │
│    tmdb-search           ◄── log sheet live search      │
│    generate-taste-dna    ◄── profile build              │
│    import-catalog  ◄── weekly pg_cron automation        │
│    catalog-scheduler ◄── HTTP trigger wrapper           │
│    enrich-media    ──► scores mood_scores + WY score    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                       TMDB API                          │
│  Used only during catalog import — never at runtime     │
│  Discover API ──► import-catalog ──► media table        │
└─────────────────────────────────────────────────────────┘
```

### Key architectural decisions

- **No live TMDB at runtime** — all recommendations served from our own Postgres. TMDB is only called during weekly catalog refresh.
- **Offline-first logging** — logs that fail to sync (e.g. no network) are queued in Zustand/MMKV and flushed when the app returns to foreground.
- **Custom auth header** — `X-Admin-Key` instead of `Authorization` for edge function admin calls, because Supabase's gateway modifies the `Authorization` header before the function receives it.
- **`pg_cron` + `pg_net`** for fully automated weekly refresh — no external cron service or manual scripts needed.

---

## Screens & Modules

### Auth (`app/auth.tsx`)
Sign in and sign up with email/password. Cinematic gradient background. Routes to Onboarding (first-time) or Discover (returning user).

### Onboarding (`app/onboarding.tsx`)
15-genre mood picker. Selections are synced to Supabase as the user's initial Taste DNA signal. One-time screen; completion is persisted via `onboarding` Zustand store (MMKV-backed).

### Discover (`app/(tabs)/discover.tsx`)
Pick a mood → see 20 films scored for that mood. Calls the `mood-recommendations` edge function. Two-column poster grid with gradient scrim cards, pull-to-refresh, and skeleton loading.

**Moods:**
| Slug | Label | Feel |
|---|---|---|
| `feeling_low` | Feeling Low 😔 | Gentle, warm, quietly moving |
| `need_intensity` | Need Intensity 😤 | High energy, adrenaline |
| `comfort_watch` | Comfort Watch 😌 | Safe, familiar, easy |
| `mind_blown` | Mind Blown 🤯 | Complex, twisty, mind-bending |
| `existential` | Existential 🌌 | Deep, philosophical |

### Log Sheet (`app/log-sheet.tsx`)
Slides up as a modal from any tab via the centre FAB (+).

**Step 1 – Search:** Debounced TMDB search, recent history when idle, poster/badge/overview results.

**Step 2 – Form:** Glass media card, 0.5–5 star rating, mood chip selector, Today/Yesterday/Other date pills, review textarea (300 char limit), Rewatch and Private toggles, gradient submit CTA.

Submits to the `logs` table. Falls back to offline queue on network failure.

### Library (`app/(tabs)/library.tsx`)
Full watch history. Filter by All / Movies / Series. Each row shows poster, title, date watched, mood emoji, star rating, and rewatch badge. Long-press to delete (with toast confirmation).

### Timeline (`app/(tabs)/timeline.tsx`)
View watching habits grouped by month and year. Stats on genres, moods, and hours watched over time.

### Profile (`app/(tabs)/profile.tsx`)
Taste DNA visualisation built from the user's full log history. Shareable card via `expo-sharing` + `react-native-view-shot`.

---

## Edge Functions

All functions live under `supabase/functions/` and run on Deno.

| Function | Method | Purpose |
|---|---|---|
| `import-catalog` | POST | Import TMDB content into the media table per mood |
| `catalog-scheduler` | POST | HTTP trigger that fans out to `import-catalog` (fire-and-forget, 202 immediate) |
| `enrich-media` | POST | Score a batch of media with mood scores + `watch_yourself_score` |
| `mood-recommendations` | POST | Return top 20 media items for a given mood slug |
| `generate-taste-dna` | POST | Compute Taste DNA from a user's logs |
| `tmdb-search` | POST | Proxy TMDB search for the log sheet |
| `tmdb-detail` | POST | Proxy TMDB detail fetch for enrichment |
| `sync-behavior-signals` | POST | Record skip/replay/rewatch signals for personalisation |
| `send-push` | POST | Send push notifications |

### Shared modules (`functions/_shared/`)
- `cors.ts` — CORS headers + `jsonResponse` / `errorResponse` helpers
- `supabase.ts` — service-role Supabase client factory
- `tmdb.ts` — typed TMDB Discover + Detail API wrappers
- `enrichment.ts` — mood scoring logic + `MOOD_RULES` definitions
- `database.types.ts` — auto-generated types (kept in sync with mobile/lib/)

---

## Database Schema

Core tables in the `public` schema:

| Table | Purpose |
|---|---|
| `profiles` | User profile extending `auth.users` (denormalised counters) |
| `media` | Movies and series (enriched from TMDB) |
| `logs` | User watch logs (rating, review, mood, rewatch, private) |
| `mood_tags` | 5 mood definitions (slug, label, emoji, genre rules) |
| `taste_dna` | Computed Taste DNA snapshot per user |
| `behavior_signals` | Implicit signals (skips, replays) for personalisation |
| `catalog_import_log` | Tracks which TMDB pages have been imported per mood |
| `timeline_periods` | Pre-aggregated monthly/yearly stats per user |

Custom schema:

| Schema | Table | Purpose |
|---|---|---|
| `watch_yourself` | `app_settings` | Stores `catalog_admin_key` for pg_cron webhook auth |

RLS is enabled on all public tables. Users can only read/write their own rows. The `media` table is public-readable.

---

## Catalog Automation

The app never calls TMDB at runtime. All content lives in our `media` table, refreshed weekly.

**Flow:**

```
Every Sunday 03:00 UTC
  └── pg_cron calls watch_yourself.trigger_catalog_refresh()
        └── net.http_post → catalog-scheduler edge function
              └── for each mood (5 moods × 10 pages):
                    └── POST import-catalog { moodSlug, pages }
                          └── TMDB Discover API → upsert media
                                └── enrich-media (mood scores + WY score)
                                      └── catalog_import_log updated
```

**Page tracking:** `catalog_import_log` records which pages have already been imported per mood. Each weekly run imports the next N pages — content grows over time without re-importing.

**Admin auth:** Edge functions use a custom `X-Admin-Key` header (set via `supabase secrets set IMPORT_ADMIN_KEY=...`) rather than the `Authorization` header, which Supabase's gateway modifies before the function receives it.

---

## Design System

All tokens live in `mobile/constants/colors.ts`.

### Colours

| Token | Value | Use |
|---|---|---|
| `background` | `#080810` | All screen backgrounds |
| `surface` | `#111118` | Cards, input fields |
| `surfaceElevated` | `#1a1a28` | Modals, drawers |
| `accent` | `#7c6af5` | Primary CTA, active states |
| `accentLight` | `#a78bfa` | Highlights |
| `text` | `#f0f0f8` | Primary text |
| `textSecondary` | `#8888a8` | Labels, metadata |
| `textMuted` | `#44445a` | Placeholders, disabled |
| `glass` | `rgba(255,255,255,0.05)` | Glassmorphic surfaces |
| `glassBorder` | `rgba(255,255,255,0.10)` | Glass borders |

### Gradient presets (`Gradients`)

| Name | Use |
|---|---|
| `accent` | CTA buttons |
| `accentDeep` | FAB, primary actions |
| `hero` | Header backgrounds |
| `posterOverlay` | Gradient scrim over poster images |
| `cardOverlay` | Text legibility over cards |
| `fadeUp` | Bottom fade-to-background |

### Mood colours

Each mood slug maps to a distinct colour used in chips, badges, and score indicators:

```
feeling_low    → #6ea8fe  (blue)
need_intensity → #f87171  (red)
comfort_watch  → #86efac  (green)
mind_blown     → #c084fc  (purple)
existential    → #38bdf8  (cyan)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Expo CLI (`npm i -g expo-cli`)
- Supabase CLI (`brew install supabase/tap/supabase`)
- TMDB API key (free at [themoviedb.org](https://www.themoviedb.org/settings/api))

### 1. Clone and install

```bash
git clone <repo-url>
cd watch-yourself/mobile
npm install
```

### 2. Set up environment variables

Create `mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
IMPORT_ADMIN_KEY=<generate with: openssl rand -hex 24>
```

### 3. Set Supabase secrets

```bash
supabase secrets set TMDB_API_KEY=<your-tmdb-key>
supabase secrets set IMPORT_ADMIN_KEY=<same-value-as-env>
```

### 4. Run migrations

```bash
supabase db push
```

### 5. Seed the catalog

Trigger the first import manually (imports 5 pages × 5 moods ≈ 285 movies):

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/catalog-scheduler \
  -H "x-admin-key: <your-import-admin-key>"
```

### 6. Start the app

```bash
cd mobile
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `i` for iOS simulator / `a` for Android emulator.

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `mobile/.env` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `mobile/.env` | Supabase anon (public) key |
| `IMPORT_ADMIN_KEY` | `mobile/.env` + Supabase secrets | Shared secret for catalog import auth |
| `TMDB_API_KEY` | Supabase secrets | TMDB API v3 key |

> **Note:** `EXPO_PUBLIC_*` variables are bundled into the client app. Never put secrets there. `IMPORT_ADMIN_KEY` in `.env` is only used for local testing/curl — the real secret lives in Supabase.

---

## Development Notes

### Regenerate database types

After any schema change, regenerate types for both the mobile app and edge functions:

```bash
supabase gen types typescript --project-id <project-ref> > mobile/lib/database.types.ts
cp mobile/lib/database.types.ts supabase/functions/_shared/database.types.ts
```

> Strip the Supabase CLI version warning from the end of the file if it gets captured in the output.

### TypeScript check

```bash
cd mobile
npx tsc --noEmit
```

### Deploy edge functions

```bash
supabase functions deploy import-catalog
supabase functions deploy catalog-scheduler
supabase functions deploy mood-recommendations
# etc.
```

### Deep link scheme

The app uses `watch-yourself://` as its URL scheme. Auth callbacks are handled at `watch-yourself://auth/callback` (PKCE flow by default; implicit flow as fallback).

### Offline logging

Logs that fail to sync are stored in the `logQueue` Zustand store (MMKV-backed). The queue flushes automatically when the app returns to the foreground (`AppState` listener in `_layout.tsx`).

### New Architecture

The app runs with Expo's New Architecture enabled (`newArchEnabled: true` in `app.json`). Ensure all native modules are compatible.
