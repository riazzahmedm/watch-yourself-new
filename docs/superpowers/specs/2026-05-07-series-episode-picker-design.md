# Series Episode Picker — Design Spec
**Date:** 2026-05-07  
**Status:** Approved

## Overview

When logging a series, Step 3 of the log sheet currently defaults to `series_full` with no episode selection. This spec adds an inline "What did you watch?" section that lets users log a whole series, a whole season, or a single episode — all within the existing Step 3 scroll form.

---

## UX Flow

Step 3 gains a **"What did you watch?"** section pinned at the very top, above "How was it?". It is only rendered when `media.mediaType === "series"`.

### Level 1 — Type row (always visible for series)

Horizontal pill scroll:

```
[ Whole Series ]  [ S1 ]  [ S2 ]  [ S3 ]  …
```

- Pills are generated from `numberOfSeasons` returned by `useMediaDetail`.
- **Default selection:** "Whole Series".
- Tapping `S1`, `S2`, etc. selects that season and reveals Level 2 below.
- Tapping "Whole Series" collapses Level 2 and resets episode selection.

### Level 2 — Episode list (only when a season pill is active)

Loaded lazily via `useSeasonEpisodes(tmdbId, "series", selectedSeason)`.

- First row: **"Whole Season"** option (highlighted pill or row).
- Remaining rows: one per episode — `E{n}  ·  Title  ·  Air date`.
- Tapping "Whole Season" → `logType = series_season`, no episode ID.
- Tapping an episode row → `logType = series_episode`, `episodeId = episode.id`.
- Active selection shown with accent border / background.
- Loading state: small spinner while `useSeasonEpisodes` fetches.

### Resulting log types

| User selection | `logType` | `episode_id` | `season_number` |
|---|---|---|---|
| Whole Series (default) | `series_full` | null | null |
| Whole Season (S*n* selected, no episode) | `series_season` | null | n |
| Single episode | `series_episode` | episode.id | episode.seasonNumber |

---

## State Changes (`LogSheet` root)

Two new state variables:

```ts
const [selectedSeason,    setSelectedSeason]    = useState<number | null>(null);
const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
```

`logType` is **derived** (not stored) in `handleSubmit`:

```ts
function deriveLogType(
  mediaType: "movie" | "series",
  seasonNumber: number | null,
  episodeId: string | null
): LogEntry["logType"] {
  if (mediaType === "movie")      return "movie";
  if (episodeId != null)          return "series_episode";
  if (seasonNumber != null)       return "series_season";
  return "series_full";
}
```

`handleSubmit` passes the derived values:

```ts
createLog.mutate({
  …existing fields…,
  logType:      deriveLogType(selectedMedia.mediaType, selectedSeason, selectedEpisodeId),
  episodeId:    selectedEpisodeId ?? undefined,
  seasonNumber: selectedSeason ?? undefined,
});
```

---

## Component Changes

### `Step3Props` — new props

```ts
numberOfSeasons:       number | null;   // from mediaDetail
selectedSeason:        number | null;
selectedEpisodeId:     string | null;
onSeasonChange:        (s: number | null) => void;
onEpisodeChange:       (episodeId: string | null, seasonNumber: number | null) => void;
```

`Step3LogForm` drives `useSeasonEpisodes` internally using `p.media.tmdbId` and `p.selectedSeason`. The hook is already in `useMediaDetail.ts` and requires no changes.

### New sub-component: `EpisodePicker`

Extracted into the bottom of `log-sheet.tsx` (same file, keeps the sheet self-contained):

```
EpisodePicker
  props: tmdbId, numberOfSeasons, selectedSeason, selectedEpisodeId,
         onSeasonChange, onEpisodeChange
  
  renders:
    - Season pill row (horizontal ScrollView)
    - Episode list (conditional on selectedSeason)
      - "Whole Season" row
      - Episode rows (from useSeasonEpisodes)
      - Loading skeleton (3 placeholder rows)
```

`EpisodePicker` is the only new component. No new files are created.

---

## Data Layer Changes

### Migration — `season_number` column

```sql
-- supabase/migrations/20260507000001_logs_season_number.sql
ALTER TABLE logs ADD COLUMN IF NOT EXISTS season_number integer;
```

No RLS changes. Column is nullable — existing rows unaffected.

### `useCreateLog` (useLogs.ts)

Add `seasonNumber?: number` to the input type and pass it to the Supabase insert:

```ts
season_number: input.seasonNumber ?? null,
```

### `LogEntry` interface (useLogs.ts)

Add:

```ts
seasonNumber: number | null;
```

And map it in `mapLog`:

```ts
seasonNumber: raw.season_number as number | null,
```

### `QueuedLog` (logQueue.ts)

Add:

```ts
seasonNumber?: number;
```

And pass it in `flush()`:

```ts
season_number: log.seasonNumber ?? null,
```

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/20260507000001_logs_season_number.sql` | New — adds `season_number` column |
| `mobile/hooks/useLogs.ts` | Add `seasonNumber` to `LogEntry`, `useCreateLog` input, `mapLog` |
| `mobile/stores/logQueue.ts` | Add `seasonNumber` to `QueuedLog` and `flush()` |
| `mobile/app/log-sheet.tsx` | New state, new `EpisodePicker` component, updated `Step3Props` + `handleSubmit` |

---

## Error Handling

- `useSeasonEpisodes` failure → show "Couldn't load episodes. Tap to retry." inline.
- If `numberOfSeasons` is null/0 → hide the episode picker entirely; default to `series_full`.
- Empty season (0 episodes returned) → show "No episodes available" placeholder.
