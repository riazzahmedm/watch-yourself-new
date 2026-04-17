// ============================================================
// Edge Function: generate-taste-dna
// POST /functions/v1/generate-taste-dna
// Body: {} (acts on the authenticated user)
//
// Computes the user's Taste DNA from their full log history.
// Also computes Movie Twin matches (top 3).
// Writes results to taste_dna table.
// ============================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient, getAuthUser } from "../_shared/supabase.ts";

// Minimum logs required to show DNA (not compute it)
const MIN_LOGS_TO_DISPLAY = 10;

// TMDB genre IDs for specific signals
const TWIST_GENRES    = [53, 9648, 878];   // Thriller, Mystery, Sci-Fi
const SHORT_RUNTIME   = 90;                // minutes
const LONG_RUNTIME    = 130;               // minutes

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const user = await getAuthUser(req);
  if (!user) return errorResponse("Unauthorized", 401);

  const supabase = getServiceClient();

  try {
    // ----------------------------------------------------------
    // 1. Fetch all logs with their media details
    // ----------------------------------------------------------
    const { data: logs, error: logsError } = await supabase
      .from("logs")
      .select(`
        id,
        log_type,
        rating,
        is_rewatch,
        binge_session,
        watched_at,
        mood_tag_id,
        media:media_id (
          tmdb_genre_ids,
          tmdb_genres,
          runtime_minutes,
          media_type
        )
      `)
      .eq("user_id", user.id)
      .order("watched_at", { ascending: false });

    if (logsError) throw logsError;
    if (!logs || logs.length === 0) {
      return jsonResponse({ message: "No logs found", dna: null });
    }

    // ----------------------------------------------------------
    // 2. Compute Genre Affinities
    // ----------------------------------------------------------
    const genreScores: Record<string, number> = {};
    const genreGenreNames: Record<string, string> = {};

    for (const log of logs) {
      const media = log.media as {
        tmdb_genre_ids: number[];
        tmdb_genres: { id: number; name: string }[];
        runtime_minutes: number | null;
        media_type: string;
      } | null;
      if (!media) continue;

      // Weight: rating matters most, rewatches signal strong affinity
      let weight = ratingWeight(log.rating);
      if (log.is_rewatch) weight *= 1.3;

      for (const gId of (media.tmdb_genre_ids ?? [])) {
        genreScores[String(gId)] = (genreScores[String(gId)] ?? 0) + weight;
      }

      // Build genre name map
      for (const g of (media.tmdb_genres as { id: number; name: string }[] ?? [])) {
        genreGenreNames[String(g.id)] = g.name;
      }
    }

    // Normalise to 0–1
    const maxScore = Math.max(...Object.values(genreScores), 0.01);
    const genreAffinities: Record<string, number> = {};
    for (const [gId, score] of Object.entries(genreScores)) {
      const normalised = score / maxScore;
      if (normalised >= 0.1) { // prune negligible entries
        genreAffinities[gId] = Math.round(normalised * 100) / 100;
      }
    }

    // Top genres for display (sorted by affinity desc)
    const topGenres = Object.entries(genreAffinities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, score]) => ({
        id: Number(id),
        name: genreGenreNames[id] ?? "Unknown",
        score,
      }));

    // ----------------------------------------------------------
    // 3. Pace Tolerance
    // ----------------------------------------------------------
    const runtimeLogs = logs.filter(
      (l) => (l.media as { runtime_minutes: number | null } | null)?.runtime_minutes
    );

    let shortCount = 0, mediumCount = 0, longCount = 0;
    for (const log of runtimeLogs) {
      const rt = (log.media as { runtime_minutes: number })?.runtime_minutes;
      if (rt < SHORT_RUNTIME)  shortCount++;
      else if (rt > LONG_RUNTIME) longCount++;
      else mediumCount++;
    }

    const total = runtimeLogs.length || 1;
    let paceTolerance: "slow" | "medium" | "fast" | "mixed" = "mixed";
    if (longCount / total > 0.6)   paceTolerance = "slow";
    else if (shortCount / total > 0.6) paceTolerance = "fast";
    else if (mediumCount / total > 0.5) paceTolerance = "medium";

    // ----------------------------------------------------------
    // 4. Twist Dependency
    // ----------------------------------------------------------
    const highRatedLogs = logs.filter((l) => (l.rating ?? 0) >= 4);
    const twistLogs = highRatedLogs.filter((l) => {
      const gIds = (l.media as { tmdb_genre_ids: number[] } | null)?.tmdb_genre_ids ?? [];
      return TWIST_GENRES.some((tg) => gIds.includes(tg));
    });
    const twistDependency = highRatedLogs.length > 0
      ? Math.round((twistLogs.length / highRatedLogs.length) * 100) / 100
      : 0;

    // ----------------------------------------------------------
    // 5. Comfort Rewatcher
    // ----------------------------------------------------------
    const rewatchCount = logs.filter((l) => l.is_rewatch).length;
    const comfortRewatcher = logs.length > 0 && rewatchCount / logs.length > 0.15;

    // ----------------------------------------------------------
    // 6. Series vs Movie preference
    // ----------------------------------------------------------
    const seriesLogs = logs.filter((l) =>
      ["series_episode", "series_season", "series_full"].includes(l.log_type)
    ).length;
    const movieLogs = logs.filter((l) => l.log_type === "movie").length;
    const seriesVsMovie = (seriesLogs + movieLogs) > 0
      ? Math.round((seriesLogs / (seriesLogs + movieLogs)) * 100) / 100
      : 0.5;

    // ----------------------------------------------------------
    // 7. Binge vs Casual
    // ----------------------------------------------------------
    // Count distinct watching days as "sessions"
    const watchDays = new Set(logs.map((l) => l.watched_at)).size;
    const bingeDays = new Set(
      logs.filter((l) => l.binge_session).map((l) => l.watched_at)
    ).size;
    const bingeVsCasual = watchDays > 0
      ? Math.round((bingeDays / watchDays) * 100) / 100
      : 0;

    // ----------------------------------------------------------
    // 8. Average rating
    // ----------------------------------------------------------
    const ratedLogs = logs.filter((l) => l.rating != null);
    const avgRating = ratedLogs.length > 0
      ? Math.round(
          (ratedLogs.reduce((sum, l) => sum + (l.rating ?? 0), 0) / ratedLogs.length) * 10
        ) / 10
      : null;

    // ----------------------------------------------------------
    // 9. Movie Twin matching
    // ----------------------------------------------------------
    const twins = await findTwins(supabase, user.id, genreAffinities, {
      paceTolerance,
      twistDependency,
      seriesVsMovie,
    });

    // ----------------------------------------------------------
    // 10. Upsert Taste DNA
    // ----------------------------------------------------------
    const dnaPayload = {
      user_id:           user.id,
      genre_affinities:  genreAffinities,
      pace_tolerance:    paceTolerance,
      twist_dependency:  twistDependency,
      comfort_rewatcher: comfortRewatcher,
      series_vs_movie:   seriesVsMovie,
      binge_vs_casual:   bingeVsCasual,
      avg_rating:        avgRating,
      total_logged:      logs.length,
      twin_cache:        twins,
      twin_cache_updated_at: new Date().toISOString(),
      last_computed_at:  new Date().toISOString(),
    };

    const { data: savedDna, error: saveError } = await supabase
      .from("taste_dna")
      .upsert(dnaPayload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (saveError) throw saveError;

    // ----------------------------------------------------------
    // 11. Response
    // ----------------------------------------------------------
    const isDisplayable = logs.length >= MIN_LOGS_TO_DISPLAY;

    return jsonResponse({
      dna: {
        genreAffinities,
        topGenres,
        paceTolerance,
        twistDependency,
        comfortRewatcher,
        seriesVsMovie,
        bingeVsCasual,
        avgRating,
        totalLogged: logs.length,
        twins,
        lastComputedAt: savedDna?.last_computed_at,
      },
      isDisplayable,
      logsUntilDisplayable: isDisplayable ? 0 : MIN_LOGS_TO_DISPLAY - logs.length,
    });

  } catch (err) {
    console.error("generate-taste-dna error:", err);
    return errorResponse("Internal server error", 500);
  }
});

// ---- Twin Matching ------------------------------------------

async function findTwins(
  supabase: ReturnType<typeof import("../_shared/supabase.ts").getServiceClient>,
  userId: string,
  myAffinities: Record<string, number>,
  mySignals: {
    paceTolerance: string;
    twistDependency: number;
    seriesVsMovie: number;
  }
) {
  // Get all other users with computed DNA and enough logs
  const { data: others } = await supabase
    .from("taste_dna")
    .select(`
      user_id,
      genre_affinities,
      pace_tolerance,
      twist_dependency,
      series_vs_movie,
      total_logged,
      profiles:user_id (username, display_name, avatar_url)
    `)
    .neq("user_id", userId)
    .gte("total_logged", 10)
    .not("last_computed_at", "is", null);

  if (!others || others.length === 0) return [];

  const myVector = buildVector(myAffinities);
  const paceNum = paceToNumber(mySignals.paceTolerance);

  const scored = others.map((other) => {
    const otherAffinities = (other.genre_affinities as Record<string, number>) ?? {};
    const otherVector = buildVector(otherAffinities);

    // Cosine similarity on genre vectors (60%)
    const genreSim = cosineSimilarity(myVector, otherVector);

    // Pace similarity (15%)
    const paceSim = 1 - Math.abs(paceNum - paceToNumber(other.pace_tolerance ?? "medium")) / 3;

    // Twist dependency similarity (15%)
    const twistSim = 1 - Math.abs(mySignals.twistDependency - (other.twist_dependency ?? 0.5));

    // Series vs movie similarity (10%)
    const seriesSim = 1 - Math.abs(mySignals.seriesVsMovie - (other.series_vs_movie ?? 0.5));

    const matchScore =
      0.60 * genreSim +
      0.15 * paceSim +
      0.15 * twistSim +
      0.10 * seriesSim;

    const profile = other.profiles as {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;

    return {
      userId:       other.user_id,
      username:     profile?.username ?? "unknown",
      displayName:  profile?.display_name,
      avatarUrl:    profile?.avatar_url,
      matchScore:   Math.round(matchScore * 100),  // 0–100%
      sharedGenres: getSharedTopGenres(myAffinities, otherAffinities, 3),
    };
  });

  // Return top 3, minimum 60% match
  return scored
    .filter((s) => s.matchScore >= 60)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);
}

// ---- Maths helpers ------------------------------------------

/** All known TMDB genre IDs — used to build consistent vectors */
const ALL_GENRE_IDS = [
  "28", "12", "16", "35", "80", "99", "18", "10751",
  "14", "36", "27", "10402", "9648", "10749", "878",
  "10770", "53", "10752", "37",
];

function buildVector(affinities: Record<string, number>): number[] {
  return ALL_GENRE_IDS.map((id) => affinities[id] ?? 0);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot    = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA   = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB   = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function paceToNumber(pace: string | null): number {
  const map: Record<string, number> = { slow: 0, medium: 1.5, fast: 3, mixed: 1.5 };
  return map[pace ?? "mixed"] ?? 1.5;
}

function ratingWeight(rating: number | null): number {
  if (rating == null) return 1.0;
  if (rating >= 4.5) return 1.5;
  if (rating >= 4.0) return 1.2;
  if (rating >= 3.0) return 1.0;
  if (rating >= 2.0) return 0.7;
  return 0.4; // 0.5–1.5 = negative signal
}

function getSharedTopGenres(
  a: Record<string, number>,
  b: Record<string, number>,
  n: number
): string[] {
  // Return the top N genre IDs that both users have affinity for
  const shared = Object.keys(a)
    .filter((id) => (a[id] ?? 0) > 0.3 && (b[id] ?? 0) > 0.3)
    .sort((x, y) => (b[y] + a[y]) - (b[x] + a[x]));
  return shared.slice(0, n);
}
