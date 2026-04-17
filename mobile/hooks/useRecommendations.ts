import { useQuery } from "@tanstack/react-query";
import { callEdgeFunction } from "@/lib/supabase";

export interface RecommendationItem {
  id:            string;
  tmdbId:        number;
  mediaType:     "movie" | "series";
  title:         string;
  overview:      string;
  posterUrl:     string | null;
  releaseYear:   number | null;
  genres:        { id: number; name: string }[];
  tmdbRating:    number;
  cineMoodScore: number;
  communityRating: number | null;
  runtimeMins:   number | null;
  moodScore:     number;
}

interface RecommendationsResponse {
  mood:         { slug: string; label: string; emoji: string };
  results:      RecommendationItem[];
  personalized: boolean;
  source:       string;
}

export function useRecommendations(moodSlug: string | null) {
  return useQuery({
    queryKey:  ["recommendations", moodSlug],
    queryFn:   () =>
      callEdgeFunction<RecommendationsResponse>("mood-recommendations", {
        moodSlug,
        limit: 20,
      }),
    enabled:   !!moodSlug,
    staleTime: 10 * 60 * 1000,  // 10 min — recommendations don't change fast
  });
}
