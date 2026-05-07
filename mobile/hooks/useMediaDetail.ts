// ============================================================
// useMediaDetail — fetch rich media detail from tmdb-detail edge fn
// Returns media row + cast + trailer + watch providers + episodes
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ---- Types --------------------------------------------------

export interface CastMember {
  id:           string;
  name:         string;
  character:    string | null;
  profileUrl:   string | null;
  billingOrder: number;
}

export interface Trailer {
  youtubeKey: string;
  name:       string | null;
  type:       string;
}

export interface WatchProvider {
  name:     string;
  logoUrl:  string | null;
  priority: number;
}

export interface WatchProviders {
  flatrate: WatchProvider[];
  rent:     WatchProvider[];
  buy:      WatchProvider[];
}

export interface Episode {
  id:            string;
  seasonNumber:  number;
  episodeNumber: number;
  title:         string | null;
  overview:      string | null;
  airDate:       string | null;
  runtimeMins:   number | null;
  stillUrl:      string | null;
}

export interface MediaDetail {
  id:              string;
  tmdbId:          number;
  mediaType:       "movie" | "series";
  title:           string;
  overview:        string | null;
  posterUrl:       string | null;
  backdropUrl:     string | null;
  releaseYear:     number | null;
  genres:          { id: number; name: string }[];
  runtimeMinutes:  number | null;
  tmdbRating:      number | null;
  tmdbVoteCount:   number;
  language:        string | null;
  status:          string | null;
  numberOfSeasons:  number | null;
  numberOfEpisodes: number | null;
}

export interface MediaDetailResult {
  media:          MediaDetail;
  cast:           CastMember[];
  trailer:        Trailer | null;
  watchProviders: WatchProviders;
  episodes?:      Episode[];
}

// ---- Hook ---------------------------------------------------

/**
 * Fetches full media detail for the media detail screen.
 * @param mediaId  — our internal UUID (from media table)
 * @param tmdbId   — TMDB numeric ID
 * @param mediaType
 * @param countryCode — ISO 3166-1 alpha-2 (e.g. "US", "GB")
 */
export function useMediaDetail(
  mediaId:     string | null,
  tmdbId:      number | null,
  mediaType:   "movie" | "series",
  countryCode  = "US"
) {
  return useQuery<MediaDetailResult>({
    queryKey: ["media-detail", tmdbId, countryCode],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<MediaDetailResult>(
        "tmdb-detail",
        {
          body: {
            tmdbId,
            mediaType: mediaType === "series" ? "series" : "movie",
            countryCode,
          },
        }
      );
      if (error) throw error;
      return data as MediaDetailResult;
    },
    enabled:   !!tmdbId,
    staleTime: 30 * 60 * 1000, // 30 min
    gcTime:    60 * 60 * 1000, // 1 hr
  });
}

/**
 * Fetch episodes for a specific season of a series.
 */
export function useSeasonEpisodes(
  tmdbId:       number | null,
  mediaType:    "movie" | "series",
  seasonNumber: number | null,
  countryCode   = "US"
) {
  return useQuery<Episode[]>({
    queryKey: ["season-episodes", tmdbId, seasonNumber],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ episodes: Episode[] }>(
        "tmdb-detail",
        {
          body: {
            tmdbId,
            mediaType,
            seasonNumber,
            countryCode,
          },
        }
      );
      if (error) throw error;
      return (data as { episodes?: Episode[] }).episodes ?? [];
    },
    enabled:   !!tmdbId && mediaType === "series" && seasonNumber != null,
    staleTime: 24 * 60 * 60 * 1000, // 24 hr — episodes rarely change
  });
}
