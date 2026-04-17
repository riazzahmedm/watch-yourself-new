// ============================================================
// TMDB API client for CineMood Edge Functions
// All TMDB calls are server-side only — key never leaves backend.
// ============================================================

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

// ---------- Types --------------------------------------------

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;         // "YYYY-MM-DD"
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  original_language: string;
  status?: string;
}

export interface TmdbSeries {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  episode_run_time: number[];
  vote_average: number;
  vote_count: number;
  original_language: string;
  status?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
}

export interface TmdbEpisode {
  id: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  episode_number: number;
  season_number: number;
  runtime: number | null;
}

export interface TmdbSearchResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;          // movie
  name?: string;           // tv
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  overview: string;
}

export interface TmdbKeyword {
  id: number;
  name: string;
}

// ---------- Helpers ------------------------------------------

function getTmdbKey(): string {
  const key = Deno.env.get("TMDB_API_KEY");
  if (!key) throw new Error("Missing TMDB_API_KEY environment variable");
  return key;
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", getTmdbKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TMDB ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ---------- Public API ---------------------------------------

/** Multi-search: movies + TV shows in one call */
export async function searchMulti(query: string, page = 1): Promise<TmdbSearchResult[]> {
  const data = await tmdbFetch<{ results: TmdbSearchResult[] }>("/search/multi", {
    query,
    page: String(page),
    include_adult: "false",
  });
  // Filter out people, keep only movie + tv
  return data.results.filter((r) => r.media_type === "movie" || r.media_type === "tv");
}

/** Full movie detail (includes genres, runtime, keywords via append_to_response) */
export async function getMovieDetail(tmdbId: number): Promise<TmdbMovie & { keywords: TmdbKeyword[] }> {
  const data = await tmdbFetch<TmdbMovie & { keywords: { keywords: TmdbKeyword[] } }>(
    `/movie/${tmdbId}`,
    { append_to_response: "keywords" }
  );
  return {
    ...data,
    keywords: data.keywords?.keywords ?? [],
  };
}

/** Full series detail */
export async function getSeriesDetail(
  tmdbId: number
): Promise<TmdbSeries & { keywords: TmdbKeyword[] }> {
  const data = await tmdbFetch<TmdbSeries & { keywords: { results: TmdbKeyword[] } }>(
    `/tv/${tmdbId}`,
    { append_to_response: "keywords" }
  );
  return {
    ...data,
    keywords: data.keywords?.results ?? [],
  };
}

/** Fetch all episodes for a season */
export async function getSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number
): Promise<TmdbEpisode[]> {
  const data = await tmdbFetch<{ episodes: TmdbEpisode[] }>(
    `/tv/${tmdbId}/season/${seasonNumber}`
  );
  return data.episodes ?? [];
}

/** Discover movies by genre IDs with optional filters */
export async function discoverMovies(params: {
  with_genres?: string;         // comma-separated TMDB genre IDs
  without_genres?: string;
  "vote_average.gte"?: string;
  "runtime.lte"?: string;
  sort_by?: string;             // default: "vote_average.desc"
  page?: number;
}): Promise<TmdbMovie[]> {
  const query: Record<string, string> = {
    sort_by: params.sort_by ?? "vote_average.desc",
    "vote_count.gte": "500",       // ignore niche films with few votes
    page: String(params.page ?? 1),
    include_adult: "false",
  };
  if (params.with_genres)          query.with_genres = params.with_genres;
  if (params.without_genres)       query.without_genres = params.without_genres;
  if (params["vote_average.gte"])  query["vote_average.gte"] = params["vote_average.gte"];
  if (params["runtime.lte"])       query["runtime.lte"] = params["runtime.lte"];

  const data = await tmdbFetch<{ results: TmdbMovie[] }>("/discover/movie", query);
  return data.results;
}

// ---------- Image URL helpers --------------------------------

export function posterUrl(path: string | null, size: "w185" | "w342" | "w500" = "w342"): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function backdropUrl(path: string | null): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/w1280${path}`;
}
