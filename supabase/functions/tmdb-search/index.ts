// ============================================================
// Edge Function: tmdb-search
// POST /functions/v1/tmdb-search
// Body: { query: string, page?: number }
//
// Searches TMDB for movies and TV series.
// Upserts results into the media cache table.
// Returns normalised MediaItem[].
// ============================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient, getAuthUser } from "../_shared/supabase.ts";
import { searchMulti } from "../_shared/tmdb.ts";

interface MediaItem {
  id: string;           // our internal UUID (null if not yet cached)
  tmdbId: number;
  mediaType: "movie" | "series";
  title: string;
  overview: string;
  posterUrl: string | null;
  releaseYear: number | null;
  tmdbRating: number;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  // Auth check
  const user = await getAuthUser(req);
  if (!user) return errorResponse("Unauthorized", 401);

  // Parse body
  let query: string;
  let page: number;
  try {
    const body = await req.json();
    query = (body.query ?? "").trim();
    page  = Number(body.page ?? 1);
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (!query || query.length < 2) {
    return errorResponse("query must be at least 2 characters");
  }

  const supabase = getServiceClient();

  try {
    // 1. Fetch from TMDB
    const tmdbResults = await searchMulti(query, page);

    if (tmdbResults.length === 0) {
      return jsonResponse({ results: [] });
    }

    // 2. Upsert into media cache (only basic fields — detail fetch handles full data)
    const upsertPayload = tmdbResults.map((r) => ({
      tmdb_id:           r.id,
      media_type:        r.media_type === "tv" ? "series" : "movie" as "movie" | "series",
      title:             r.title ?? r.name ?? "Untitled",
      original_title:    r.title ?? r.name ?? null,
      overview:          r.overview ?? null,
      poster_path:       r.poster_path ?? null,
      release_year:      parseYear(r.release_date ?? r.first_air_date),
      tmdb_rating:       r.vote_average ?? 0,
      cached_at:         new Date().toISOString(),
    }));

    const { data: upserted, error: upsertError } = await supabase
      .from("media")
      .upsert(upsertPayload, {
        onConflict: "tmdb_id",
        ignoreDuplicates: false,
      })
      .select("id, tmdb_id");

    if (upsertError) {
      console.error("media upsert error:", upsertError);
      // Non-fatal — return TMDB results even if cache write fails
    }

    // 3. Build id map from upserted rows
    const idMap = new Map<number, string>(
      (upserted ?? []).map((row) => [row.tmdb_id, row.id])
    );

    // 4. Shape the response
    const results: MediaItem[] = tmdbResults.map((r) => ({
      id:          idMap.get(r.id) ?? "",
      tmdbId:      r.id,
      mediaType:   r.media_type === "tv" ? "series" : "movie",
      title:       r.title ?? r.name ?? "Untitled",
      overview:    r.overview ?? "",
      posterUrl:   r.poster_path
        ? `https://image.tmdb.org/t/p/w342${r.poster_path}`
        : null,
      releaseYear: parseYear(r.release_date ?? r.first_air_date),
      tmdbRating:  r.vote_average ?? 0,
    }));

    return jsonResponse({ results, page, totalResults: results.length });
  } catch (err) {
    console.error("tmdb-search error:", err);
    return errorResponse("Internal server error", 500);
  }
});

// ---- Helpers ------------------------------------------------

function parseYear(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const year = parseInt(dateStr.substring(0, 4), 10);
  return isNaN(year) ? null : year;
}
