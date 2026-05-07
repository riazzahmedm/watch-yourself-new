import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, callEdgeFunction } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useLogQueue } from "@/stores/logQueue";
import { isDnaStale } from "@/hooks/useTasteDna";

export interface LogEntry {
  id:                  string;
  mediaId:             string;
  episodeId:           string | null;
  seasonNumber:        number | null;
  logType:             "movie" | "series_episode" | "series_season" | "series_full";
  watchedAt:           string;
  rating:              number | null;
  reactionStamp:       string | null;
  review:              string | null;
  moodTagId:           string | null;
  watchPlatform:       string | null;
  interestHook:        string | null;
  preWatchEmotionId:   string | null;
  preWatchAnswer:      string | null;
  postWatchEmotionId:  string | null;
  postEnergyLevel:     number | null;
  postMindLevel:       number | null;
  favoriteCastId:      string | null;
  isRewatch:           boolean;
  isPrivate:           boolean;
  createdAt:           string;
  media: {
    id:          string;
    tmdbId:      number;
    title:       string;
    posterPath:  string | null;
    releaseYear: number | null;
    mediaType:   "movie" | "series";
    tmdbRating:  number | null;
    tmdbGenres:  { id: number; name: string }[];
  };
  moodTag: { slug: string; emoji: string; label: string } | null;
}

// ---- Fetch user's log history --------------------------------

export function useLogs(limit = 50) {
  const { user } = useAuthStore();

  return useQuery({
    queryKey:  ["logs", user?.id],
    queryFn:   async () => {
      const { data, error } = await supabase
        .from("logs")
        .select(`
          id, media_id, episode_id, season_number, log_type, watched_at,
          rating, reaction_stamp, review, mood_tag_id,
          watch_platform, interest_hook,
          pre_watch_emotion_id, pre_watch_answer,
          post_watch_emotion_id, post_energy_level, post_mind_level,
          favorite_cast_id, is_rewatch, is_private, created_at,
          media:media_id (
            id, tmdb_id, title, poster_path, release_year, media_type, tmdb_rating, tmdb_genres
          ),
          mood_tag:mood_tag_id (slug, emoji, label)
        `)
        .eq("user_id", user!.id)
        .order("watched_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []).map(mapLog);
    },
    enabled:   !!user,
    staleTime: 60 * 1000,  // 1 min
  });
}

// ---- Create a log (tries online first, queues if offline) ----

export function useCreateLog() {
  const queryClient = useQueryClient();
  const { user }    = useAuthStore();
  const { enqueue } = useLogQueue();

  return useMutation({
    mutationFn: async (input: {
      mediaId:             string;
      episodeId?:          string;
      seasonNumber?:       number;
      logType:             LogEntry["logType"];
      watchedAt:           string;
      rating?:             number;
      reactionStamp?:      string;
      review?:             string;
      moodTagId?:          string;
      watchPlatform?:      string;
      interestHook?:       string;
      preWatchEmotionId?:  string;
      preWatchAnswer?:     string;
      favoriteCastId?:     string;
      isRewatch:           boolean;
      isPrivate:           boolean;
    }): Promise<string> => {
      const { data, error } = await supabase
        .from("logs")
        .insert({
          user_id:               user!.id,
          media_id:              input.mediaId,
          episode_id:            input.episodeId  ?? null,
          season_number:         input.seasonNumber ?? null,
          log_type:              input.logType,
          watched_at:            input.watchedAt,
          rating:                input.rating ?? null,
          reaction_stamp:        input.reactionStamp ?? null,
          review:                input.review ?? null,
          mood_tag_id:           input.moodTagId ?? null,
          watch_platform:        input.watchPlatform ?? null,
          interest_hook:         input.interestHook ?? null,
          pre_watch_emotion_id:  input.preWatchEmotionId ?? null,
          pre_watch_answer:      input.preWatchAnswer ?? null,
          favorite_cast_id:      input.favoriteCastId ?? null,
          is_rewatch:            input.isRewatch,
          is_private:            input.isPrivate,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },

    onError: (_err, input) => {
      // Supabase failed (offline?) → push to queue
      enqueue({
        userId:            user!.id,
        mediaId:           input.mediaId,
        episodeId:         input.episodeId,
        seasonNumber:      input.seasonNumber,
        logType:           input.logType,
        watchedAt:         input.watchedAt,
        rating:            input.rating,
        reactionStamp:     input.reactionStamp,
        review:            input.review,
        moodTagId:         input.moodTagId,
        watchPlatform:     input.watchPlatform,
        interestHook:      input.interestHook,
        preWatchEmotionId: input.preWatchEmotionId,
        preWatchAnswer:    input.preWatchAnswer,
        favoriteCastId:    input.favoriteCastId,
        isRewatch:         input.isRewatch,
        isPrivate:         input.isPrivate,
      });
    },

    onSuccess: async () => {
      // Invalidate log list so it refreshes
      queryClient.invalidateQueries({ queryKey: ["logs", user?.id] });

      // Auto-recompute Taste DNA when the user crosses the 10-log threshold
      // or when their existing DNA is stale. Fire-and-forget — profile will
      // refresh via query invalidation on its own schedule.
      try {
        const dna = queryClient.getQueryData<{ last_computed_at?: string | null } | null>(
          ["taste-dna", user?.id]
        );
        const currentLogs = queryClient.getQueryData<{ id: string }[]>(
          ["logs", user?.id]
        );
        const logCount = (currentLogs?.length ?? 0) + 1; // +1 for the log just added

        if (logCount >= 10 && isDnaStale(dna?.last_computed_at)) {
          await callEdgeFunction("generate-taste-dna", {});
          queryClient.invalidateQueries({ queryKey: ["taste-dna", user?.id] });
        }
      } catch {
        // DNA recompute is best-effort — never block the log success path
      }

      // Always regenerate timeline after a new log — fire-and-forget
      try {
        await callEdgeFunction("generate-timeline", {});
        queryClient.invalidateQueries({ queryKey: ["timeline", user?.id] });
      } catch {
        // Timeline recompute is best-effort — never block the log success path
      }
    },
  });
}

// ---- Delete a log -------------------------------------------

export function useDeleteLog() {
  const queryClient = useQueryClient();
  const { user }    = useAuthStore();

  return useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from("logs")
        .delete()
        .eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs", user?.id] });
    },
  });
}

// ---- Mapper -------------------------------------------------

function mapLog(raw: Record<string, unknown>): LogEntry {
  const media = raw.media as Record<string, unknown> | null;
  const mood  = raw.mood_tag as Record<string, unknown> | null;
  return {
    id:                 raw.id as string,
    mediaId:            raw.media_id as string,
    episodeId:          raw.episode_id as string | null,
    seasonNumber:       raw.season_number as number | null,
    logType:            raw.log_type as LogEntry["logType"],
    watchedAt:          raw.watched_at as string,
    rating:             raw.rating as number | null,
    reactionStamp:      raw.reaction_stamp as string | null,
    review:             raw.review as string | null,
    moodTagId:          raw.mood_tag_id as string | null,
    watchPlatform:      raw.watch_platform as string | null,
    interestHook:       raw.interest_hook as string | null,
    preWatchEmotionId:  raw.pre_watch_emotion_id as string | null,
    preWatchAnswer:     raw.pre_watch_answer as string | null,
    postWatchEmotionId: raw.post_watch_emotion_id as string | null,
    postEnergyLevel:    raw.post_energy_level as number | null,
    postMindLevel:      raw.post_mind_level as number | null,
    favoriteCastId:     raw.favorite_cast_id as string | null,
    isRewatch:          raw.is_rewatch as boolean,
    isPrivate:          raw.is_private as boolean,
    createdAt:          raw.created_at as string,
    media: {
      id:          media?.id as string,
      tmdbId:      media?.tmdb_id as number,
      title:       media?.title as string,
      posterPath:  media?.poster_path as string | null,
      releaseYear: media?.release_year as number | null,
      mediaType:   media?.media_type as "movie" | "series",
      tmdbRating:  media?.tmdb_rating as number | null,
      tmdbGenres:  (media?.tmdb_genres as { id: number; name: string }[]) ?? [],
    },
    moodTag: mood
      ? { slug: mood.slug as string, emoji: mood.emoji as string, label: mood.label as string }
      : null,
  };
}
