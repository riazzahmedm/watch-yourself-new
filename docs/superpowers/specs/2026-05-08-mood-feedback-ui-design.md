# Mood Feedback UI — Design Spec
Date: 2026-05-08

## Problem
The `mood_feedback` table and `sync-behavior-signals` engine exist but are never populated — there is no UI to collect whether a film matched the user's mood. Without feedback data the recommendation flywheel cannot tune itself.

## Goal
After a user logs a film, ask "Did [mood] match your experience?" and write a `yes / somewhat / no` response to `mood_feedback`. Wire the Discover mood context through the navigation chain so the question is pre-contextualised.

---

## Section 1: Mood Context Through Navigation

### Discover → media/[id]
`MediaCard.onPress` adds `moodSlug` to navigation params alongside the existing `id`, `tmdbId`, `mediaType`.

### media/[id] → log-sheet
`handleLog` in `[id].tsx` reads `moodSlug` from its own params and forwards it to `log-sheet` params alongside `interestHook`.

### log-sheet
- Reads `moodSlug` from params (optional — absent when coming from Library/search).
- Adds `selectedMoodSlug` state, initialised from the param.
- Step 3 gains a horizontal mood chip row (same MOODS constant used by Discover), pre-selected to `selectedMoodSlug`. User can change or deselect. Shown only when at least one chip is pre-selected or the user taps one.
- On submit: if `selectedMoodSlug` is set, look up `mood_tags` by slug to get `mood_tag_id` (same pattern as the `preEmotionId` lookup). Pass `moodTagId` to `createLog` (field already exists on `LogEntry` / `useCreateLog`).
- Store `resolvedMoodTagId` in state alongside `submittedLogId` for use by the feedback overlay.

Mood context is fully optional — absent slug means no chip row, no feedback prompt.

---

## Section 2: MoodFeedback Overlay Component

New `MoodFeedback` component inside `log-sheet.tsx`. Structurally identical to `PostCheckin`:
- Absolute positioned bottom sheet, slide-up spring animation (`Animated.spring`), handle bar.
- Title: `"Did [mood.emoji] [mood.label] match?"`
- Three full-width tappable rows: **Yes 👍**, **Somewhat 🤷**, **No 👎**
- Small **Skip** text link below the buttons.

### Trigger sequence in LogSheet
1. Log submitted → `router.back()` → 400ms → `showPostCheckin = true`
2. PostCheckin submitted or dismissed → if `resolvedMoodTagId` exists → `showMoodFeedback = true`
3. MoodFeedback tapped or skipped → insert (fire-and-forget) → dismiss

### New state in LogSheet
| State | Type | Purpose |
|---|---|---|
| `selectedMoodSlug` | `string \| null` | Mood chip selection, pre-filled from nav param |
| `resolvedMoodTagId` | `string \| null` | UUID from mood_tags looked up at submit time |
| `showMoodFeedback` | `boolean` | Controls overlay visibility |

---

## Section 3: Writing to mood_feedback

Insert directly from the Supabase client on tap — no edge function needed:

```ts
supabase.from("mood_feedback").insert({
  user_id:        user.id,
  log_id:         submittedLogId,
  media_id:       selectedMedia.id,
  mood_tag_id:    resolvedMoodTagId,
  match_response: "yes" | "somewhat" | "no",
})
// fire-and-forget — error swallowed silently
```

Overlay dismisses immediately on tap (optimistic). No query invalidation needed — `mood_feedback` is not read on the client; it feeds `sync-behavior-signals` server-side.

---

## Files Changed

| File | Change |
|---|---|
| `mobile/app/(tabs)/discover.tsx` | Pass `moodSlug` to `MediaCard.onPress` nav params |
| `mobile/components/MediaCard.tsx` | Accept + forward `moodSlug` in `onPress` params |
| `mobile/app/media/[id].tsx` | Read `moodSlug` param, forward to log-sheet |
| `mobile/app/log-sheet.tsx` | `selectedMoodSlug` state, mood chip row in Step 3, `resolvedMoodTagId` lookup, `MoodFeedback` overlay, updated submit + PostCheckin dismiss handler |

No migrations needed — `mood_feedback` table and `mood_match_enum` already exist.

---

## Error Handling
- Mood lookup failure (slug not in DB) → `resolvedMoodTagId` stays null → feedback prompt skipped silently
- `mood_feedback` insert failure → swallowed, overlay already dismissed
- User skips feedback → nothing written, no retry
