# generate-timeline — Design Spec
Date: 2026-05-08

## Problem
The `timeline_periods` table and Timeline tab exist but the table is always empty — there is no edge function to populate it. Users see the empty state regardless of how many movies they've logged.

## Goal
Create a `generate-timeline` Supabase edge function that computes monthly and yearly watch summaries from a user's log history and writes them to `timeline_periods`. Wire it to fire automatically after each log and when the Timeline tab opens.

---

## Edge Function: `generate-timeline`

**Endpoint:** `POST /functions/v1/generate-timeline`
**Auth:** User JWT (same pattern as `generate-taste-dna`)
**Body:** `{}` — acts on the authenticated user

### Steps

1. **Fetch logs** — all rows for the user joined with `media` (`runtime_minutes`, `tmdb_genres`) and `mood_tag` (`id`, `slug`)
2. **Group into buckets** — one map keyed by `"YYYY-MM"` (months) and one by `"YYYY"` (years)
3. **Per-bucket computation:**
   - `watch_count` — number of logs in the bucket
   - `total_hours` — sum of `media.runtime_minutes` ÷ 60, rounded to nearest int (logs with null runtime contribute 0)
   - `avg_rating` — average of non-null `rating` values, rounded to 1 decimal; null if no rated logs
   - `binge_session_count` — count of logs where `binge_session = true`
   - `dominant_mood_id` — UUID of the most frequently occurring non-null `mood_tag_id`
   - `dominant_genre` — most frequently occurring genre name across all `tmdb_genres` arrays in the bucket
4. **Resolve `phase_label`** — query `phase_label_rules` once at function start. For each bucket, find the highest-priority rule where:
   - `mood_slug` matches the dominant mood's slug (or rule's `mood_slug` is null), AND
   - `genre_name` matches `dominant_genre` (or rule's `genre_name` is null)
   - Fall back to null if no rule matches
5. **Upsert** — bulk upsert all month rows (`period_type='month'`) then all year rows (`period_type='year'`) into `timeline_periods`. Conflict target: `(user_id, period_type, period_year, period_month)`. The `life_context_note` column is excluded from the upsert so user diary entries are never overwritten.
6. **Response** — `{ monthsComputed: number, yearsComputed: number }`

---

## Client-side Wiring

### Trigger 1 — after each log (`useLogs.ts`)
In `useCreateLog.onSuccess`, after the existing DNA auto-trigger:
```ts
// Fire-and-forget — never block the log success path
try {
  await callEdgeFunction("generate-timeline", {});
  queryClient.invalidateQueries({ queryKey: ["timeline", user?.id] });
} catch { /* best-effort */ }
```

### Trigger 2 — Timeline tab open (`timeline.tsx`)
Add a `isTimelineStale` helper (age > 1 hour) and a `useComputeTimeline` mutation (mirrors `useComputeTasteDna`). In a `useEffect` on mount:
```ts
useEffect(() => {
  const mostRecent = periods?.[0];
  if (isTimelineStale(mostRecent?.computed_at) && !computeTimeline.isPending) {
    computeTimeline.mutate();
  }
}, [periods]);
```
No new query needed — the existing `useQuery` in `timeline.tsx` refetches automatically on invalidation.

---

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-timeline/index.ts` | New edge function |
| `mobile/hooks/useLogs.ts` | Add timeline trigger in `useCreateLog.onSuccess` |
| `mobile/app/(tabs)/timeline.tsx` | Add stale-check `useEffect` + `useComputeTimeline` mutation |

No migration needed — `timeline_periods` table and `phase_label_rules` already exist.

---

## Error Handling
- Both client-side triggers are fire-and-forget wrapped in try/catch — a failed compute never surfaces to the user
- Edge function logs errors to Supabase function logs for observability
- If `phase_label_rules` returns no match, `phase_label` is null — the UI already handles this gracefully (the phase label section is conditionally rendered)
