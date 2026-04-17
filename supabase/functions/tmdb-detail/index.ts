// ============================================================
// Edge Function: tmdb-detail
// POST /functions/v1/tmdb-detail
// Body: { tmdbId: number, mediaType: "movie" | "series", seasonNumber?: number }
//
// Returns full media detail + upserts into cache.
// If mediaType=series and seasonNumber is provided, also returns
// and caches all episodes for that season.
// ============================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient, getAuthUser } from "../_shared/supabase.ts";
import {
  getMovieDetail,
  getSeriesDetail,
  getSeasonEpisodes,
  posterUrl,
  backdropUrl,
} from "../_shared/tmdb.ts";

const CACHE_TTL_DAYS = 7;

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const user = await getAuthUser(req);
  if (!user) return errorResponse("Unauthorized", 401);

  let tmdbId: number;
  let mediaType: "movie" | "series";
  let seasonNumber: number | undefined;

  try {
    const body = await req.json();
    tmdbId      = Number(body.tmdbId);
    mediaType   = body.mediaType === "series" ? "series" : "movie";
    seasonNumber = body.seasonNumber != null ? Number(body.seasonNumber) : undefined;
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (!tmdbId || isNaN(tmdbId)) return errorResponse("tmdbId is required");

  const supabase = getServiceClient();

  try {
    // ----------------------------------------------------------
    // 1. Check cache freshness
    // ----------------------------------------------------------
    const { data: cached } = await supabase
      .from("media")
      .select("*")
      .eq("tmdb_id", tmdbId)
      .single();

    const cacheExpiry = new Date();
    cacheExpiry.setDate(cacheExpiry.getDate() - CACHE_TTL_DAYS);
    const isFresh = cached && new Date(cached.cached_at) > cacheExpiry;

    // ----------------------------------------------------------
    // 2. Fetch from TMDB if stale / missing
    // ----------------------------------------------------------
    let mediaRow = cached;

    if (!isFresh) {
      if (mediaType === "movie") {
        const detail = await getMovieDetail(tmdbId);
        const payload = {
          tmdb_id:           detail.id,
          media_type:        "movie" as const,
          title:             detail.title,
          original_title:    detail.original_title,
          overview:          detail.overview,
          poster_path:       detail.poster_path,
          backdrop_path:     detail.backdrop_path,
          release_year:      parseYear(detail.release_date),
          tmdb_genres:       detail.genres ?? [],
          tmdb_genre_ids:    (detail.genres ?? []).map((g) => g.id),
          runtime_minutes:   detail.runtime,
          tmdb_rating:       detail.vote_average,
          tmdb_vote_count:   detail.vote_count,
          original_language: detail.original_language,
          status:            detail.status,
          tmdb_keywords:     detail.keywords.map((k) => k.name),
          cached_at:         new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("media")
          .upsert(payload, { onConflict: "tmdb_id" })
          .select("*")
          .single();

        if (error) throw error;
        mediaRow = data;

      } else {
        const detail = await getSeriesDetail(tmdbId);
        const avgRuntime = detail.episode_run_time?.[0] ?? null;

        const payload = {
          tmdb_id:           detail.id,
          media_type:        "series" as const,
          title:             detail.name,
          original_title:    detail.original_name,
          overview:          detail.overview,
          poster_path:       detail.poster_path,
          backdrop_path:     detail.backdrop_path,
          release_year:      parseYear(detail.first_air_date),
          tmdb_genres:       detail.genres ?? [],
          tmdb_genre_ids:    (detail.genres ?? []).map((g) => g.id),
          runtime_minutes:   avgRuntime,
          tmdb_rating:       detail.vote_average,
          tmdb_vote_count:   detail.vote_count,
          original_language: detail.original_language,
          status:            detail.status,
          tmdb_keywords:     detail.keywords.map((k) => k.name),
          cached_at:         new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("media")
          .upsert(payload, { onConflict: "tmdb_id" })
          .select("*")
          .single();

        if (error) throw error;
        mediaRow = data;
      }
    }

    // ----------------------------------------------------------
    // 3. Fetch and cache episodes if requested
    // ----------------------------------------------------------
    let episodes: unknown[] = [];

    if (mediaType === "series" && seasonNumber != null && mediaRow) {
      // Check if season episodes are already cached
      const { data: cachedEpisodes } = await supabase
        .from("episodes")
        .select("*")
        .eq("media_id", mediaRow.id)
        .eq("season_number", seasonNumber)
        .order("episode_number");

      if (cachedEpisodes && cachedEpisodes.length > 0) {
        // Use cached episodes
        episodes = cachedEpisodes.map(formatEpisode);
      } else {
        // Fetch from TMDB and cache
        const tmdbEpisodes = await getSeasonEpisodes(tmdbId, seasonNumber);

        const episodePayload = tmdbEpisodes.map((ep) => ({
          media_id:        mediaRow!.id,
          tmdb_episode_id: ep.id,
          season_number:   ep.season_number,
          episode_number:  ep.episode_number,
          title:           ep.name,
          overview:        ep.overview,
          air_date:        ep.air_date,
          runtime_minutes: ep.runtime,
          still_path:      ep.still_path,
          cached_at:       new Date().toISOString(),
        }));

        const { data: inserted, error: epError } = await supabase
          .from("episodes")
          .upsert(episodePayload, {
            onConflict: "media_id, season_number, episode_number",
          })
          .select("*");

        if (epError) console.error("episode upsert error:", epError);
        episodes = (inserted ?? []).map(formatEpisode);
      }
    }

    // ----------------------------------------------------------
    // 4. Shape response
    // ----------------------------------------------------------
    const response = {
      media: {
        id:               mediaRow!.id,
        tmdbId:           mediaRow!.tmdb_id,
        mediaType:        mediaRow!.media_type,
        title:            mediaRow!.title,
        overview:         mediaRow!.overview,
        posterUrl:        posterUrl(mediaRow!.poster_path, "w500"),
        backdropUrl:      backdropUrl(mediaRow!.backdrop_path),
        releaseYear:      mediaRow!.release_year,
        genres:           mediaRow!.tmdb_genres,
        runtimeMinutes:   mediaRow!.runtime_minutes,
        tmdbRating:       mediaRow!.tmdb_rating,
        tmdbVoteCount:    mediaRow!.tmdb_vote_count,
        language:         mediaRow!.original_language,
        status:           mediaRow!.status,
        keywords:         mediaRow!.tmdb_keywords,
      },
      episodes: episodes.length > 0 ? episodes : undefined,
    };

    return jsonResponse(response);
  } catch (err) {
    console.error("tmdb-detail error:", err);
    return errorResponse("Internal server error", 500);
  }
});

// ---- Helpers ------------------------------------------------

function parseYear(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const year = parseInt(dateStr.substring(0, 4), 10);
  return isNaN(year) ? null : year;
}

function formatEpisode(ep: Record<string, unknown>) {
  return {
    id:            ep.id,
    seasonNumber:  ep.season_number,
    episodeNumber: ep.episode_number,
    title:         ep.title,
    overview:      ep.overview,
    airDate:       ep.air_date,
    runtimeMins:   ep.runtime_minutes,
    stillUrl:      ep.still_path
      ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
      : null,
  };
}
