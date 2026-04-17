// ============================================================
// Edge Function: mood-recommendations  (v2 — DB-first)
// POST /functions/v1/mood-recommendations
// Body: { moodSlug: string, limit?: number, excludeWatched?: boolean }
//
// ALL recommendations served from our enriched DB.
// Zero TMDB API calls at runtime.
//
// Ranking layers (applied in order):
//   1. Filter   — mood_tag_slugs match, min watch_yourself_score
//   2. Exclude  — already watched by this user
//   3. Score    — blend of watch_yourself_score + taste DNA affinity
//                 + user behavior signals (total_logs, match rates)
//   4. Diversity — avoid returning all same-genre results
//   5. Return top N
//
// Data sources used:
//   media.mood_tag_slugs      ← Layer 1: our proprietary mood tags
//   media.watch_yourself_score      ← Layer 2: our quality signal
//   media.mood_match_rates    ← Layer 3: real user feedback
//   media.avg_user_rating     ← Layer 3: our community rating
//   media.total_logs_count    ← Layer 3: popularity within Watch Yourself
//   taste_dna.genre_affinities ← Layer 3: personalisation
// ============================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient, getAuthUser } from "../_shared/supabase.ts";

const DEFAULT_LIMIT     = 20;
const CANDIDATE_POOL    = 80;   // fetch more, then score & slice
const MIN_CINEMOOD_SCORE = 0.45; // quality floor (roughly TMDB 6.5+)

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const user = await getAuthUser(req);
  if (!user) return errorResponse("Unauthorized", 401);

  let moodSlug: string;
  let limit: number;
  let excludeWatched: boolean;

  try {
    const body = await req.json();
    moodSlug       = (body.moodSlug ?? "").trim();
    limit          = Math.min(Number(body.limit ?? DEFAULT_LIMIT), 50);
    excludeWatched = body.excludeWatched !== false; // default true
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (!moodSlug) return errorResponse("moodSlug is required");

  const supabase = getServiceClient();

  try {
    // ----------------------------------------------------------
    // 1. Load mood tag (for emoji + label in response)
    // ----------------------------------------------------------
    const { data: mood, error: moodError } = await supabase
      .from("mood_tags")
      .select("slug, label, emoji")
      .eq("slug", moodSlug)
      .single();

    if (moodError || !mood) return errorResponse("Unknown mood slug", 404);

    // ----------------------------------------------------------
    // 2. Load user's Taste DNA
    // ----------------------------------------------------------
    const { data: tasteDna } = await supabase
      .from("taste_dna")
      .select("genre_affinities, total_logged, pace_tolerance, series_vs_movie")
      .eq("user_id", user.id)
      .single();

    const genreAffinities: Record<string, number> =
      (tasteDna?.total_logged ?? 0) >= 10
        ? (tasteDna?.genre_affinities as Record<string, number> ?? {})
        : {};

    const hasPersonalisation = Object.keys(genreAffinities).length > 0;

    // ----------------------------------------------------------
    // 3. Load already-watched media IDs (to exclude)
    // ----------------------------------------------------------
    let watchedMediaIds = new Set<string>();

    if (excludeWatched) {
      const { data: watchedRows } = await supabase
        .from("logs")
        .select("media_id")
        .eq("user_id", user.id);

      watchedMediaIds = new Set((watchedRows ?? []).map((r) => r.media_id as string));
    }

    // ----------------------------------------------------------
    // 4. Query our enriched media DB (NO TMDB call)
    // ----------------------------------------------------------
    const { data: candidates, error: queryError } = await supabase
      .from("media")
      .select(`
        id, tmdb_id, media_type, title, overview,
        poster_path, release_year, tmdb_genres,
        tmdb_genre_ids, runtime_minutes,
        tmdb_rating, watch_yourself_score,
        mood_scores, mood_tag_slugs, mood_match_rates,
        avg_user_rating, total_logs_count
      `)
      .contains("mood_tag_slugs", [moodSlug])       // must qualify for this mood
      .gte("watch_yourself_score", MIN_CINEMOOD_SCORE)     // quality floor
      .eq("media_type", "movie")                     // movies only for v1
      .not("watch_yourself_score", "is", null)             // must be enriched
      .order("watch_yourself_score", { ascending: false })
      .limit(CANDIDATE_POOL);

    if (queryError) throw queryError;

    if (!candidates || candidates.length === 0) {
      // Fallback: return un-enriched rows for this mood's genres
      // This only happens before import-catalog has run
      return jsonResponse({
        mood,
        results: [],
        personalized: false,
        message: "Catalog not yet populated. Run import-catalog first.",
      });
    }

    // ----------------------------------------------------------
    // 5. Filter out watched items
    // ----------------------------------------------------------
    const unseen = candidates.filter((m) => !watchedMediaIds.has(m.id as string));

    // ----------------------------------------------------------
    // 6. Score each candidate
    // ----------------------------------------------------------
    type Candidate = typeof candidates[0];

    const scored = (unseen as Candidate[]).map((m) => {
      // --- Base: our quality signal (0–1)
      const base = (m.watch_yourself_score as number) ?? 0;

      // --- Mood affinity: how well does this item score for THIS mood?
      const moodScores = m.mood_scores as Record<string, number> ?? {};
      const moodAffinity = (moodScores[moodSlug] ?? 0) * 0.25;

      // --- User feedback signal: match rate for this mood (0–1)
      const matchRates = m.mood_match_rates as Record<string, number> ?? {};
      const matchRateScore = Object.keys(matchRates).length > 0
        ? (matchRates[moodSlug] ?? 0.5) * 0.15
        : 0;

      // --- Watch Yourself community rating (if enough users have rated it)
      const communityRating = m.avg_user_rating != null && (m.total_logs_count as number) >= 5
        ? ((m.avg_user_rating as number) / 5.0) * 0.10   // normalise 0–5 scale to 0–1
        : 0;

      // --- Taste DNA personalisation (genre affinity boost)
      let affinityBoost = 0;
      if (hasPersonalisation) {
        const genreIds = m.tmdb_genre_ids as number[] ?? [];
        for (const gId of genreIds) {
          affinityBoost += (genreAffinities[String(gId)] ?? 0) * 0.20;
        }
        affinityBoost = Math.min(affinityBoost, 0.20);
      }

      const totalScore = base + moodAffinity + matchRateScore + communityRating + affinityBoost;

      return { ...m, _score: totalScore };
    });

    // Sort by score descending
    scored.sort((a, b) => b._score - a._score);

    // ----------------------------------------------------------
    // 7. Genre diversity pass
    // Prevent top N being all the same genre.
    // Pick top item, then deprioritise items sharing its primary genre.
    // ----------------------------------------------------------
    const diversified = diversify(scored, limit);

    // ----------------------------------------------------------
    // 8. Shape response
    // ----------------------------------------------------------
    const results = diversified.map((m) => ({
      id:            m.id,
      tmdbId:        m.tmdb_id,
      mediaType:     m.media_type,
      title:         m.title,
      overview:      m.overview,
      posterUrl:     m.poster_path
        ? `https://image.tmdb.org/t/p/w342${m.poster_path}`
        : null,
      releaseYear:   m.release_year,
      genres:        m.tmdb_genres,
      tmdbRating:    m.tmdb_rating,
      cineMoodScore: m.watch_yourself_score,
      communityRating: m.avg_user_rating,
      runtimeMins:   m.runtime_minutes,
      // Expose why this was recommended (transparency)
      moodScore:     (m.mood_scores as Record<string, number>)[moodSlug] ?? 0,
    }));

    return jsonResponse({
      mood,
      results,
      personalized: hasPersonalisation,
      source: "db",  // confirm: served from our DB, not TMDB
    });

  } catch (err) {
    console.error("mood-recommendations error:", err);
    return errorResponse("Internal server error", 500);
  }
});

// ---- Diversity pass ----------------------------------------

type ScoredMedia = Record<string, unknown> & { _score: number; tmdb_genre_ids: number[] };

/**
 * Greedy diversity selection.
 * Fills slots one at a time. After picking an item, items sharing
 * its first genre get a temporary score penalty for the next pick.
 * Ensures the result list isn't 20 Action films in a row.
 */
function diversify(items: ScoredMedia[], n: number): ScoredMedia[] {
  const result: ScoredMedia[] = [];
  const penalisedGenres = new Map<number, number>(); // genreId → penalty applied

  const pool = [...items]; // don't mutate original

  while (result.length < n && pool.length > 0) {
    // Apply current penalties
    const adjusted = pool.map((item) => {
      const genres = item.tmdb_genre_ids ?? [];
      const penalty = genres.reduce(
        (sum, gId) => sum + (penalisedGenres.get(gId) ?? 0),
        0
      );
      return { item, adjustedScore: item._score - penalty };
    });

    // Pick the best adjusted item
    adjusted.sort((a, b) => b.adjustedScore - a.adjustedScore);
    const picked = adjusted[0].item;
    result.push(picked);

    // Remove from pool
    pool.splice(pool.indexOf(picked), 1);

    // Penalise genres of the picked item for next round
    const pickedGenres = picked.tmdb_genre_ids ?? [];
    for (const gId of pickedGenres) {
      penalisedGenres.set(gId, (penalisedGenres.get(gId) ?? 0) + 0.08);
    }
  }

  return result;
}
