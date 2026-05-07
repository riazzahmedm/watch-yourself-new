// ============================================================
// Edge Function: generate-timeline
// POST /functions/v1/generate-timeline
// Body: {} (acts on the authenticated user)
//
// Computes monthly and yearly watch summaries from the user's
// full log history and upserts into timeline_periods.
//
// Called:
//   - After every log creation (fire-and-forget from client)
//   - When the Timeline tab opens and data is stale (>1h)
// ============================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient, getAuthUser } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const user = await getAuthUser(req);
  if (!user) return errorResponse("Unauthorized", 401);

  const supabase = getServiceClient();

  try {
    // ----------------------------------------------------------
    // 1. Fetch all user logs with media + mood_tag
    // ----------------------------------------------------------
    const { data: logs, error: logsError } = await supabase
      .from("logs")
      .select(`
        id,
        watched_at,
        rating,
        mood_tag_id,
        binge_session,
        media:media_id (
          runtime_minutes,
          tmdb_genres
        ),
        mood_tag:mood_tag_id (
          id,
          slug
        )
      `)
      .eq("user_id", user.id)
      .order("watched_at", { ascending: true });

    if (logsError) throw logsError;
    if (!logs || logs.length === 0) {
      return jsonResponse({ monthsComputed: 0, yearsComputed: 0 });
    }

    // ----------------------------------------------------------
    // 2. Fetch phase_label_rules once
    // ----------------------------------------------------------
    const { data: rules } = await supabase
      .from("phase_label_rules")
      .select("mood_slug, genre_name, phase_label, priority")
      .order("priority", { ascending: false });

    const phaseRules = (rules ?? []) as {
      mood_slug: string | null;
      genre_name: string | null;
      phase_label: string;
      priority: number;
    }[];

    // ----------------------------------------------------------
    // 3. Group logs into month and year buckets
    // ----------------------------------------------------------
    type BucketKey = string; // "YYYY-MM" or "YYYY"

    interface Bucket {
      year:       number;
      month:      number | null;
      logIds:     string[];
      runtimeSum: number;
      ratings:    number[];
      bingeSessions: number;
      moodCounts: Record<string, { id: string; slug: string; count: number }>;
      genreCounts: Record<string, number>;
    }

    const monthBuckets = new Map<BucketKey, Bucket>();
    const yearBuckets  = new Map<BucketKey, Bucket>();

    const makeBucket = (year: number, month: number | null): Bucket => ({
      year, month, logIds: [], runtimeSum: 0, ratings: [],
      bingeSessions: 0, moodCounts: {}, genreCounts: {},
    });

    for (const log of logs) {
      const date  = new Date(log.watched_at);
      const year  = date.getFullYear();
      const month = date.getMonth() + 1; // 1–12

      const mKey = `${year}-${String(month).padStart(2, "0")}`;
      const yKey = `${year}`;

      if (!monthBuckets.has(mKey)) monthBuckets.set(mKey, makeBucket(year, month));
      if (!yearBuckets.has(yKey))  yearBuckets.set(yKey,  makeBucket(year, null));

      for (const bucket of [monthBuckets.get(mKey)!, yearBuckets.get(yKey)!]) {
        bucket.logIds.push(log.id);

        // Runtime
        const rt = (log.media as { runtime_minutes: number | null } | null)?.runtime_minutes;
        bucket.runtimeSum += rt ?? 0;

        // Rating
        if (log.rating != null) bucket.ratings.push(log.rating as number);

        // Binge
        if (log.binge_session) bucket.bingeSessions++;

        // Mood
        const moodTag = log.mood_tag as { id: string; slug: string } | null;
        if (moodTag && log.mood_tag_id) {
          const moodId = log.mood_tag_id as string;
          if (!bucket.moodCounts[moodId]) {
            bucket.moodCounts[moodId] = { id: moodId, slug: moodTag.slug, count: 0 };
          }
          bucket.moodCounts[moodId].count++;
        }

        // Genres
        const genres = (log.media as { tmdb_genres: { id: number; name: string }[] } | null)
          ?.tmdb_genres ?? [];
        for (const g of genres) {
          bucket.genreCounts[g.name] = (bucket.genreCounts[g.name] ?? 0) + 1;
        }
      }
    }

    // ----------------------------------------------------------
    // 4. Compute stats + phase_label for each bucket
    // ----------------------------------------------------------
    interface PeriodRow {
      user_id:              string;
      period_type:          "month" | "year";
      period_year:          number;
      period_month:         number | null;
      watch_count:          number;
      total_hours:          number;
      avg_rating:           number | null;
      binge_session_count:  number;
      dominant_mood_id:     string | null;
      dominant_genre:       string | null;
      phase_label:          string | null;
      computed_at:          string;
    }

    function buildRow(bucket: Bucket, type: "month" | "year"): PeriodRow {
      const watch_count  = bucket.logIds.length;
      const total_hours  = Math.round(bucket.runtimeSum / 60);
      const avg_rating   = bucket.ratings.length > 0
        ? Math.round(bucket.ratings.reduce((s, r) => s + r, 0) / bucket.ratings.length * 10) / 10
        : null;

      // Dominant mood (most frequent)
      let dominantMoodId:   string | null = null;
      let dominantMoodSlug: string | null = null;
      let maxMoodCount = 0;
      for (const m of Object.values(bucket.moodCounts)) {
        if (m.count > maxMoodCount) { maxMoodCount = m.count; dominantMoodId = m.id; dominantMoodSlug = m.slug; }
      }

      // Dominant genre (most frequent)
      let dominantGenre: string | null = null;
      let maxGenreCount = 0;
      for (const [name, count] of Object.entries(bucket.genreCounts)) {
        if (count > maxGenreCount) { maxGenreCount = count; dominantGenre = name; }
      }

      // Phase label — highest-priority rule matching mood+genre
      let phaseLabel: string | null = null;
      for (const rule of phaseRules) {
        const moodMatch  = rule.mood_slug  == null || rule.mood_slug  === dominantMoodSlug;
        const genreMatch = rule.genre_name == null || rule.genre_name === dominantGenre;
        if (moodMatch && genreMatch) { phaseLabel = rule.phase_label; break; }
      }

      return {
        user_id:             user.id,
        period_type:         type,
        period_year:         bucket.year,
        period_month:        bucket.month,
        watch_count,
        total_hours,
        avg_rating,
        binge_session_count: bucket.bingeSessions,
        dominant_mood_id:    dominantMoodId,
        dominant_genre:      dominantGenre,
        phase_label:         phaseLabel,
        computed_at:         new Date().toISOString(),
      };
    }

    const monthRows = [...monthBuckets.values()].map((b) => buildRow(b, "month"));
    const yearRows  = [...yearBuckets.values()].map((b) => buildRow(b, "year"));

    // ----------------------------------------------------------
    // 5. Upsert — exclude life_context_note so diary is preserved
    // ----------------------------------------------------------
    if (monthRows.length > 0) {
      const { error } = await supabase
        .from("timeline_periods")
        .upsert(monthRows, {
          onConflict:        "user_id,period_type,period_year,period_month",
          ignoreDuplicates:  false,
        });
      if (error) throw error;
    }

    if (yearRows.length > 0) {
      const { error } = await supabase
        .from("timeline_periods")
        .upsert(yearRows, {
          onConflict:        "user_id,period_type,period_year,period_month",
          ignoreDuplicates:  false,
        });
      if (error) throw error;
    }

    // ----------------------------------------------------------
    // 6. Response
    // ----------------------------------------------------------
    return jsonResponse({
      monthsComputed: monthRows.length,
      yearsComputed:  yearRows.length,
    });

  } catch (err) {
    console.error("generate-timeline error:", err);
    return errorResponse("Internal server error", 500);
  }
});
