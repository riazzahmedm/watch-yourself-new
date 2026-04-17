// ============================================================
// Edge Function: sync-behavior-signals
// POST /functions/v1/sync-behavior-signals
// Body: { mediaId?: string, full?: boolean }
//
// Aggregates user behavior into the media table.
// Run on a pg_cron schedule (e.g. nightly at 3AM).
//
// Updates three behavior columns on media:
//   total_logs_count  — how many Watch Yourself users logged this
//   avg_user_rating   — average of OUR users' ratings (vs TMDB's)
//   mood_match_rates  — per-mood match rate from MoodFeedback
//
// After updating signals, triggers enrich-media to re-blend
// mood scores with the new match rates.
//
// This is the flywheel:
//   More users → more feedback → better mood_match_rates
//   → better recommendations → more users
// ============================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { computeMoodMatchRates } from "../_shared/enrichment.ts";

const BATCH_SIZE = 100;

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Service-role only
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "INVALID";
  if (!authHeader.includes(serviceKey)) {
    return errorResponse("Unauthorized", 401);
  }

  let body: { mediaId?: string; full?: boolean };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const supabase = getServiceClient();
  const startTime = Date.now();
  let totalUpdated = 0;

  try {
    if (body.mediaId) {
      // --------------------------------------------------------
      // Single media item — called after a new MoodFeedback row
      // --------------------------------------------------------
      await syncOneMedia(supabase, body.mediaId);
      totalUpdated = 1;

    } else {
      // --------------------------------------------------------
      // Full sync — all media that have at least one log
      // --------------------------------------------------------

      // Step 1: Aggregate log counts + avg ratings per media
      const { data: logAggregates, error: aggError } = await supabase
        .rpc("get_media_log_aggregates");  // defined below in migration 005

      if (aggError) throw aggError;

      // Step 2: Aggregate mood feedback match rates per media
      const { data: feedbackRows, error: fbError } = await supabase
        .from("mood_feedback")
        .select(`
          media_id,
          match_response,
          mood_tags:mood_tag_id (slug)
        `);

      if (fbError) throw fbError;

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

      // Step 3: Merge and batch-upsert
      const updates: {
        id: string;
        total_logs_count: number;
        avg_user_rating: number | null;
        mood_match_rates: Record<string, number>;
      }[] = [];

      for (const agg of (logAggregates ?? []) as LogAggregate[]) {
        const matchRates = feedbackByMedia[agg.media_id]
          ? computeMoodMatchRates(feedbackByMedia[agg.media_id])
          : {};

        updates.push({
          id:               agg.media_id,
          total_logs_count: agg.log_count,
          avg_user_rating:  agg.avg_rating,
          mood_match_rates: matchRates,
        });
      }

      // Batch upsert
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from("media")
          .upsert(batch, { onConflict: "id" });

        if (error) {
          console.error("sync-behavior-signals upsert error:", error);
        } else {
          totalUpdated += batch.length;
        }
      }

      // Step 4: Trigger enrich-media for items with new feedback
      // (so mood_scores get re-blended with updated match rates)
      const mediaIdsWithFeedback = Object.keys(feedbackByMedia);
      if (mediaIdsWithFeedback.length > 0 && body.full) {
        await triggerReEnrichment(mediaIdsWithFeedback);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[sync-behavior-signals] Updated ${totalUpdated} rows in ${elapsed}ms`);

    return jsonResponse({
      updated: totalUpdated,
      elapsed_ms: elapsed,
    });

  } catch (err) {
    console.error("sync-behavior-signals error:", err);
    return errorResponse("Internal server error", 500);
  }
});

// ---- Helpers ------------------------------------------------

async function syncOneMedia(
  supabase: ReturnType<typeof import("../_shared/supabase.ts").getServiceClient>,
  mediaId: string
) {
  // Log count + avg rating
  const { data: agg } = await supabase
    .from("logs")
    .select("rating")
    .eq("media_id", mediaId);

  const logs = agg ?? [];
  const logCount = logs.length;
  const ratedLogs = logs.filter((l) => l.rating != null);
  const avgRating = ratedLogs.length > 0
    ? Math.round(
        (ratedLogs.reduce((s, l) => s + (l.rating as number), 0) / ratedLogs.length) * 100
      ) / 100
    : null;

  // Feedback match rates
  const { data: fbRows } = await supabase
    .from("mood_feedback")
    .select("match_response, mood_tags:mood_tag_id (slug)")
    .eq("media_id", mediaId);

  const feedbackList = (fbRows ?? []).map((fb) => ({
    mood_tag_slug:  (fb.mood_tags as { slug: string } | null)?.slug ?? "",
    match_response: fb.match_response as "yes" | "no" | "somewhat",
  })).filter((f) => f.mood_tag_slug);

  const matchRates = computeMoodMatchRates(feedbackList);

  await supabase
    .from("media")
    .update({
      total_logs_count: logCount,
      avg_user_rating:  avgRating,
      mood_match_rates: matchRates,
    })
    .eq("id", mediaId);
}

async function triggerReEnrichment(mediaIds: string[]) {
  // Fire-and-forget call to enrich-media for items with updated match rates
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) return;

  // Split into batches of 50
  for (let i = 0; i < mediaIds.length; i += 50) {
    const batch = mediaIds.slice(i, i + 50);
    try {
      await fetch(`${supabaseUrl}/functions/v1/enrich-media`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ tmdbIds: batch }),
      });
    } catch (e) {
      console.warn("[sync-behavior-signals] Failed to trigger enrich-media:", e);
    }
  }
}

interface LogAggregate {
  media_id:   string;
  log_count:  number;
  avg_rating: number | null;
}
