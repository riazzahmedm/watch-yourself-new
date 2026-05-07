// ============================================================
// Edge Function: tmdb-detail
// POST /functions/v1/tmdb-detail
// Body: {
//   tmdbId: number,
//   mediaType: "movie" | "series",
//   seasonNumber?: number,   -- fetch + cache episodes for this season
//   countryCode?: string,    -- for watch providers (default "US")
// }
//
// Returns full media detail and upserts into cache.
// On first call (or after TTL expiry) also fetches and caches:
//   - Top 20 cast members  (media_cast)
//   - Trailers             (media_videos)
//   - Streaming providers  (media_watch_providers)
//   - Episodes             (episodes, if seasonNumber provided)
//
// All data served from our DB at runtime — no TMDB calls for repeat views.
// ============================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient, getAuthUser } from "../_shared/supabase.ts";
import {
  getMovieDetail,
  getSeriesDetail,
  getSeasonEpisodes,
  posterUrl,
  backdropUrl,
  profileUrl,
  providerLogoUrl,
  type TmdbCastMember,
  type TmdbVideo,
  type TmdbWatchProvider,
} from "../_shared/tmdb.ts";

// Simple alias so helper functions have a clean type
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const MEDIA_CACHE_TTL_DAYS    = 7;
const CAST_CACHE_TTL_DAYS     = 30;
const VIDEO_CACHE_TTL_DAYS    = 30;
const PROVIDER_CACHE_TTL_DAYS = 7;
const MAX_CAST                = 20;

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const user = await getAuthUser(req);
  if (!user) return errorResponse("Unauthorized", 401);

  let tmdbId: number;
  let mediaType: "movie" | "series";
  let seasonNumber: number | undefined;
  let countryCode: string;

  try {
    const body = await req.json();
    tmdbId       = Number(body.tmdbId);
    mediaType    = body.mediaType === "series" ? "series" : "movie";
    seasonNumber = body.seasonNumber != null ? Number(body.seasonNumber) : undefined;
    countryCode  = (body.countryCode as string | undefined)?.toUpperCase() ?? "US";
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (!tmdbId || isNaN(tmdbId)) return errorResponse("tmdbId is required");

  const supabase = getServiceClient();

  try {
    // ----------------------------------------------------------
    // 1. Fetch / refresh core media row
    // ----------------------------------------------------------
    const { data: cached } = await supabase
      .from("media")
      .select("*")
      .eq("tmdb_id", tmdbId)
      .single();

    const mediaExpiry = new Date();
    mediaExpiry.setDate(mediaExpiry.getDate() - MEDIA_CACHE_TTL_DAYS);
    // A series row is stale if cached_at is old OR number_of_seasons was never written
    // (tmdb-search resets cached_at without writing number_of_seasons, so we must
    //  treat a null number_of_seasons as a cache miss for series).
    const seasonCountMissing = mediaType === "series" && (cached?.number_of_seasons == null);
    const mediaFresh = cached && new Date(cached.cached_at) > mediaExpiry && !seasonCountMissing;

    let mediaRow = cached;

    if (!mediaFresh) {
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

        // Cache cast, videos, and providers from the single TMDB call
        await Promise.all([
          cacheCast(supabase, mediaRow.id, detail.cast),
          cacheVideos(supabase, mediaRow.id, detail.videos),
          cacheWatchProviders(supabase, mediaRow.id, detail.watchProviders, countryCode),
        ]);

      } else {
        const detail = await getSeriesDetail(tmdbId);
        const avgRuntime = detail.episode_run_time?.[0] ?? null;

        const payload = {
          tmdb_id:             detail.id,
          media_type:          "series" as const,
          title:               detail.name,
          original_title:      detail.original_name,
          overview:            detail.overview,
          poster_path:         detail.poster_path,
          backdrop_path:       detail.backdrop_path,
          release_year:        parseYear(detail.first_air_date),
          tmdb_genres:         detail.genres ?? [],
          tmdb_genre_ids:      (detail.genres ?? []).map((g) => g.id),
          runtime_minutes:     avgRuntime,
          tmdb_rating:         detail.vote_average,
          tmdb_vote_count:     detail.vote_count,
          original_language:   detail.original_language,
          status:              detail.status,
          tmdb_keywords:       detail.keywords.map((k) => k.name),
          number_of_seasons:   detail.number_of_seasons,
          number_of_episodes:  detail.number_of_episodes,
          cached_at:           new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("media")
          .upsert(payload, { onConflict: "tmdb_id" })
          .select("*")
          .single();

        if (error) throw error;
        mediaRow = data;

        await Promise.all([
          cacheCast(supabase, mediaRow.id, detail.cast),
          cacheVideos(supabase, mediaRow.id, detail.videos),
          cacheWatchProviders(supabase, mediaRow.id, detail.watchProviders, countryCode),
        ]);
      }
    } else {
      // Media row is fresh but cast/videos/providers might need refresh
      await Promise.all([
        refreshCastIfStale(supabase, mediaRow.id, tmdbId, mediaType, countryCode),
        refreshProvidersIfStale(supabase, mediaRow.id, tmdbId, mediaType, countryCode),
      ]);
    }

    // ----------------------------------------------------------
    // 2. Fetch cast, videos, providers from DB
    // ----------------------------------------------------------
    const [castResult, videoResult, providerResult] = await Promise.all([
      supabase
        .from("media_cast")
        .select("id, tmdb_person_id, name, character, profile_path, billing_order, department")
        .eq("media_id", mediaRow.id)
        .order("billing_order")
        .limit(MAX_CAST),

      supabase
        .from("media_videos")
        .select("id, tmdb_video_key, name, video_type, official, published_at")
        .eq("media_id", mediaRow.id)
        .order("official", { ascending: false })
        .order("published_at", { ascending: false }),

      supabase
        .from("media_watch_providers")
        .select("provider_name, provider_logo_path, provider_type, display_priority")
        .eq("media_id", mediaRow.id)
        .eq("country_code", countryCode)
        .order("display_priority"),
    ]);

    // ----------------------------------------------------------
    // 3. Fetch and cache episodes if requested
    // ----------------------------------------------------------
    let episodes: unknown[] = [];

    if (mediaType === "series" && seasonNumber != null && mediaRow) {
      const { data: cachedEps } = await supabase
        .from("episodes")
        .select("*")
        .eq("media_id", mediaRow.id)
        .eq("season_number", seasonNumber)
        .order("episode_number");

      if (cachedEps && cachedEps.length > 0) {
        episodes = cachedEps.map(formatEpisode);
      } else {
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
          .upsert(episodePayload, { onConflict: "media_id, season_number, episode_number" })
          .select("*");

        if (epError) console.error("episode upsert error:", epError);
        episodes = (inserted ?? []).map(formatEpisode);
      }
    }

    // ----------------------------------------------------------
    // 4. Shape response
    // ----------------------------------------------------------
    const cast = (castResult.data ?? []).map((c) => ({
      id:           c.id,
      name:         c.name,
      character:    c.character,
      profileUrl:   profileUrl(c.profile_path),
      billingOrder: c.billing_order,
    }));

    // Pick the best trailer: official Trailer first, then Teaser
    const trailer = pickBestTrailer(videoResult.data ?? []);

    const providers = (providerResult.data ?? []);
    const watchProviders = {
      flatrate: providers.filter((p) => p.provider_type === "flatrate").map(formatProvider),
      rent:     providers.filter((p) => p.provider_type === "rent").map(formatProvider),
      buy:      providers.filter((p) => p.provider_type === "buy").map(formatProvider),
    };

    return jsonResponse({
      media: {
        id:              mediaRow.id,
        tmdbId:          mediaRow.tmdb_id,
        mediaType:       mediaRow.media_type,
        title:           mediaRow.title,
        overview:        mediaRow.overview,
        posterUrl:       posterUrl(mediaRow.poster_path, "w500"),
        backdropUrl:     backdropUrl(mediaRow.backdrop_path),
        releaseYear:     mediaRow.release_year,
        genres:          mediaRow.tmdb_genres,
        runtimeMinutes:  mediaRow.runtime_minutes,
        tmdbRating:      mediaRow.tmdb_rating,
        tmdbVoteCount:   mediaRow.tmdb_vote_count,
        language:        mediaRow.original_language,
        status:          mediaRow.status,
        numberOfSeasons: (mediaRow as Record<string, unknown>).number_of_seasons ?? null,
        numberOfEpisodes:(mediaRow as Record<string, unknown>).number_of_episodes ?? null,
      },
      cast,
      trailer,
      watchProviders,
      episodes: episodes.length > 0 ? episodes : undefined,
    });

  } catch (err) {
    console.error("tmdb-detail error:", err);
    return errorResponse("Internal server error", 500);
  }
});

// ---- Cast caching -------------------------------------------

async function cacheCast(
  supabase: SupabaseClient,
  mediaId: string,
  cast: TmdbCastMember[]
) {
  if (!cast?.length) return;
  const payload = cast.slice(0, MAX_CAST).map((c) => ({
    media_id:        mediaId,
    tmdb_person_id:  c.id,
    name:            c.name,
    character:       c.character ?? null,
    profile_path:    c.profile_path ?? null,
    billing_order:   c.order,
    department:      c.known_for_department ?? "Acting",
    cached_at:       new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("media_cast")
    .upsert(payload, { onConflict: "media_id, tmdb_person_id" });
  if (error) console.error("cast upsert error:", error);
}

// ---- Video caching ------------------------------------------

async function cacheVideos(
  supabase: SupabaseClient,
  mediaId: string,
  videos: TmdbVideo[]
) {
  if (!videos?.length) return;
  const youtubeVideos = videos.filter((v) => v.site === "YouTube");
  if (!youtubeVideos.length) return;

  const payload = youtubeVideos.map((v) => ({
    media_id:       mediaId,
    tmdb_video_key: v.key,
    name:           v.name ?? null,
    video_type:     v.type,
    official:       v.official,
    published_at:   v.published_at ? v.published_at.substring(0, 10) : null,
    cached_at:      new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("media_videos")
    .upsert(payload, { onConflict: "media_id, tmdb_video_key" });
  if (error) console.error("video upsert error:", error);
}

// ---- Watch provider caching ---------------------------------

async function cacheWatchProviders(
  supabase: SupabaseClient,
  mediaId: string,
  watchProviders: Record<string, { flatrate?: TmdbWatchProvider[]; rent?: TmdbWatchProvider[]; buy?: TmdbWatchProvider[] }>,
  countryCode: string
) {
  const countryData = watchProviders?.[countryCode];
  if (!countryData) return;

  // Delete stale providers for this media + country first
  await supabase
    .from("media_watch_providers")
    .delete()
    .eq("media_id", mediaId)
    .eq("country_code", countryCode);

  const payload: unknown[] = [];
  for (const type of ["flatrate", "rent", "buy"] as const) {
    for (const p of countryData[type] ?? []) {
      payload.push({
        media_id:           mediaId,
        country_code:       countryCode,
        provider_name:      p.provider_name,
        provider_logo_path: p.logo_path ?? null,
        provider_type:      type,
        display_priority:   p.display_priority,
        cached_at:          new Date().toISOString(),
      });
    }
  }
  if (!payload.length) return;
  const { error } = await supabase.from("media_watch_providers").insert(payload);
  if (error) console.error("watch providers insert error:", error);
}

// ---- Stale refresh helpers ----------------------------------

async function refreshCastIfStale(
  supabase: SupabaseClient,
  mediaId: string,
  tmdbId: number,
  mediaType: "movie" | "series",
  countryCode: string
) {
  const castExpiry = new Date();
  castExpiry.setDate(castExpiry.getDate() - CAST_CACHE_TTL_DAYS);

  const { data: existing } = await supabase
    .from("media_cast")
    .select("cached_at")
    .eq("media_id", mediaId)
    .limit(1)
    .single();

  if (!existing || new Date(existing.cached_at) <= castExpiry) {
    const detail = mediaType === "movie"
      ? await getMovieDetail(tmdbId)
      : await getSeriesDetail(tmdbId);
    await cacheCast(supabase, mediaId, detail.cast);
    await cacheVideos(supabase, mediaId, detail.videos);
    await cacheWatchProviders(supabase, mediaId, detail.watchProviders, countryCode);
  }
}

async function refreshProvidersIfStale(
  supabase: SupabaseClient,
  mediaId: string,
  tmdbId: number,
  mediaType: "movie" | "series",
  countryCode: string
) {
  const providerExpiry = new Date();
  providerExpiry.setDate(providerExpiry.getDate() - PROVIDER_CACHE_TTL_DAYS);

  const { data: existing } = await supabase
    .from("media_watch_providers")
    .select("cached_at")
    .eq("media_id", mediaId)
    .eq("country_code", countryCode)
    .limit(1)
    .single();

  if (!existing || new Date(existing.cached_at) <= providerExpiry) {
    const detail = mediaType === "movie"
      ? await getMovieDetail(tmdbId)
      : await getSeriesDetail(tmdbId);
    await cacheWatchProviders(supabase, mediaId, detail.watchProviders, countryCode);
  }
}

// ---- Formatters ---------------------------------------------

function pickBestTrailer(videos: { tmdb_video_key: string; name: string | null; video_type: string; official: boolean }[]) {
  if (!videos.length) return null;
  const priority = ["Trailer", "Teaser", "Clip", "Featurette"];
  for (const type of priority) {
    const match = videos.find((v) => v.video_type === type && v.official)
      ?? videos.find((v) => v.video_type === type);
    if (match) {
      return {
        youtubeKey: match.tmdb_video_key,
        name:       match.name,
        type:       match.video_type,
      };
    }
  }
  return null;
}

function formatProvider(p: { provider_name: string; provider_logo_path: string | null; display_priority: number }) {
  return {
    name:        p.provider_name,
    logoUrl:     providerLogoUrl(p.provider_logo_path),
    priority:    p.display_priority,
  };
}

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
