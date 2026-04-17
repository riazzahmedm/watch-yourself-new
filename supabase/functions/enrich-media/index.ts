// ============================================================
// Edge Function: enrich-media
// POST /functions/v1/enrich-media
// Body:
//   { mediaId: string }                  ← single item by our UUID
//   { tmdbIds: number[] }                ← batch by TMDB IDs
//   { staleOnly: true, limit?: number }  ← re-enrich stale rows
//
// Triggered by:
//   - tmdb-detail (after caching a new media item)
//   - Weekly pg_cron job to refresh stale rows
//   - Admin tooling (manual re-enrichment)
//
// What it does:
//   1. Loads the media row (already has genres + keywords from cache)
//   2. Runs enrichMedia() → mood_scores, mood_tag_slugs, cinemood_score
//   3. If MoodFeedback exists → bakes in real match rates
//   4. Writes back to media table
// ============================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { enrichMedia, computeMoodMatchRates } from "../_shared/enrichment.ts";

const DEFAULT_STALE_LIMIT  = 200;
const STALE_AFTER_DAYS     = 14;  // re-enrich rows older than this

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Service-role only
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "INVALID";
  if (!authHeader.includes(serviceKey)) {
    return errorResponse("Unauthorized", 401);
  }

  let body: {
    mediaId?: string;
    tmdbIds?: number[];
    staleOnly?: boolean;
    limit?: number;
  };

  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const supabase = getServiceClient();

  try {
    // ----------------------------------------------------------
    // 1. Resolve which media rows to enrich
    // ----------------------------------------------------------
    let rows: MediaRow[] = [];

    if (body.mediaId) {
      // Single row by our internal UUID
      const { data, error } = await supabase
        .from("media")
        .select(MEDIA_FIELDS)
        .eq("id", body.mediaId)
        .single();
      if (error || !data) return errorResponse("Media not found", 404);
      rows = [data as MediaRow];

    } else if (body.tmdbIds && body.tmdbIds.length > 0) {
      // Batch by TMDB IDs
      const { data, error } = await supabase
        .from("media")
        .select(MEDIA_FIELDS)
        .in("tmdb_id", body.tmdbIds);
      if (error) throw error;
      rows = (data ?? []) as MediaRow[];

    } else if (body.staleOnly) {
      // Re-enrich rows that haven't been enriched recently
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - STALE_AFTER_DAYS);

      const { data, error } = await supabase
        .from("media")
        .select(MEDIA_FIELDS)
        .or(`last_enriched_at.is.null,last_enriched_at.lt.${staleDate.toISOString()}`)
        .limit(body.limit ?? DEFAULT_STALE_LIMIT)
        .order("last_enriched_at", { ascending: true, nullsFirst: true });

      if (error) throw error;
      rows = (data ?? []) as MediaRow[];

    } else {
      return errorResponse("Provide mediaId, tmdbIds, or staleOnly:true");
    }

    if (rows.length === 0) {
      return jsonResponse({ enriched: 0, message: "No rows to enrich" });
    }

    // ----------------------------------------------------------
    // 2. Load MoodFeedback for these media items (batch)
    // ----------------------------------------------------------
    const mediaIds = rows.map((r) => r.id);

    const { data: feedbackRows } = await supabase
      .from("mood_feedback")
      .select(`
        media_id,
        match_response,
        mood_tags:mood_tag_id (slug)
      `)
      .in("media_id", mediaIds);

    // Group feedback by media_id
    const feedbackByMedia: Record<
      string,
      { mood_tag_slug: string; match_response: "yes" | "no" | "somewhat" }[]
    > = {};

    for (const fb of feedbackRows ?? []) {
      const mId = fb.media_id as string;
      const slug = (fb.mood_tags as { slug: string } | null)?.slug;
      if (!slug) continue;

      if (!feedbackByMedia[mId]) feedbackByMedia[mId] = [];
      feedbackByMedia[mId].push({
        mood_tag_slug:  slug,
        match_response: fb.match_response as "yes" | "no" | "somewhat",
      });
    }

    // ----------------------------------------------------------
    // 3. Enrich each row
    // ----------------------------------------------------------
    const updates: EnrichUpdate[] = [];

    for (const row of rows) {
      const result = enrichMedia({
        tmdb_genre_ids:  row.tmdb_genre_ids ?? [],
        tmdb_keywords:   row.tmdb_keywords  ?? [],
        tmdb_rating:     row.tmdb_rating,
        tmdb_vote_count: row.tmdb_vote_count ?? 0,
      });

      // Merge user feedback match rates (if any)
      const matchRates = feedbackByMedia[row.id]
        ? computeMoodMatchRates(feedbackByMedia[row.id])
        : {};

      // Blend: if we have real match rates, use them to nudge mood scores
      const finalMoodScores = blendWithMatchRates(result.mood_scores, matchRates);
      const finalSlugs = Object.entries(finalMoodScores)
        .filter(([slug, score]) => {
          const rule = MOOD_RULES_MAP[slug];
          return rule ? score >= rule.threshold : false;
        })
        .map(([slug]) => slug);

      updates.push({
        id:               row.id,
        mood_scores:      finalMoodScores,
        mood_tag_slugs:   finalSlugs,
        cinemood_score:   result.cinemood_score,
        mood_match_rates: matchRates,
        last_enriched_at: new Date().toISOString(),
      });
    }

    // ----------------------------------------------------------
    // 4. Batch upsert back to DB
    // ----------------------------------------------------------
    const BATCH_SIZE = 50;
    let totalUpdated = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("media")
        .upsert(batch, { onConflict: "id" });

      if (error) {
        console.error("enrich-media batch upsert error:", error);
      } else {
        totalUpdated += batch.length;
      }
    }

    console.log(`[enrich-media] Enriched ${totalUpdated}/${rows.length} rows`);

    return jsonResponse({
      enriched: totalUpdated,
      total:    rows.length,
    });

  } catch (err) {
    console.error("enrich-media error:", err);
    return errorResponse("Internal server error", 500);
  }
});

// ---- Helpers & Types ----------------------------------------

const MEDIA_FIELDS = `
  id, tmdb_id, tmdb_genre_ids, tmdb_keywords,
  tmdb_rating, tmdb_vote_count
`;

interface MediaRow {
  id:              string;
  tmdb_id:         number;
  tmdb_genre_ids:  number[] | null;
  tmdb_keywords:   string[] | null;
  tmdb_rating:     number | null;
  tmdb_vote_count: number | null;
}

interface EnrichUpdate {
  id:               string;
  mood_scores:      Record<string, number>;
  mood_tag_slugs:   string[];
  cinemood_score:   number;
  mood_match_rates: Record<string, number>;
  last_enriched_at: string;
}

// Pre-build a map for fast threshold lookups
import { MOOD_RULES } from "../_shared/enrichment.ts";
const MOOD_RULES_MAP = Object.fromEntries(MOOD_RULES.map((r) => [r.slug, r]));

/**
 * Blend computed mood scores with real user feedback match rates.
 * If a mood has match rate data, nudge the score:
 *   high match rate → boost score slightly
 *   low match rate  → reduce score slightly
 * This is the feedback loop that makes our DB more accurate over time.
 */
function blendWithMatchRates(
  computed: Record<string, number>,
  matchRates: Record<string, number>
): Record<string, number> {
  const blended = { ...computed };

  for (const [slug, matchRate] of Object.entries(matchRates)) {
    if (blended[slug] == null) continue;

    // matchRate 0–1 → adjustment -0.10 to +0.10
    const adjustment = (matchRate - 0.5) * 0.2;
    blended[slug] = Math.round(
      Math.min(Math.max(blended[slug] + adjustment, 0), 1) * 100
    ) / 100;
  }

  return blended;
}
