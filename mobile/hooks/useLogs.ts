import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useLogQueue } from "@/stores/logQueue";

export interface LogEntry {
  id:         string;
  mediaId:    string;
  episodeId:  string | null;
  logType:    "movie" | "series_episode" | "series_season" | "series_full";
  watchedAt:  string;
  rating:     number | null;
  review:     string | null;
  moodTagId:  string | null;
  isRewatch:  boolean;
  isPrivate:  boolean;
  createdAt:  string;
  media: {
    id:          string;
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
          id, media_id, episode_id, log_type, watched_at,
          rating, review, mood_tag_id, is_rewatch, is_private, created_at,
          media:media_id (
            id, title, poster_path, release_year, media_type, tmdb_rating, tmdb_genres
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
      mediaId:    string;
      episodeId?: string;
      logType:    LogEntry["logType"];
      watchedAt:  string;
      rating?:    number;
      review?:    string;
      moodTagId?: string;
      isRewatch:  boolean;
      isPrivate:  boolean;
    }) => {
      const { error } = await supabase.from("logs").insert({
        user_id:     user!.id,
        media_id:    input.mediaId,
        episode_id:  input.episodeId ?? null,
        log_type:    input.logType,
        watched_at:  input.watchedAt,
        rating:      input.rating ?? null,
        review:      input.review ?? null,
        mood_tag_id: input.moodTagId ?? null,
        is_rewatch:  input.isRewatch,
        is_private:  input.isPrivate,
      });
      if (error) throw error;
    },

    onError: (_err, input) => {
      // Supabase failed (offline?) → push to queue
      enqueue({
        userId:    user!.id,
        mediaId:   input.mediaId,
        episodeId: input.episodeId,
        logType:   input.logType,
        watchedAt: input.watchedAt,
        rating:    input.rating,
        review:    input.review,
        moodTagId: input.moodTagId,
        isRewatch: input.isRewatch,
        isPrivate: input.isPrivate,
      });
    },

    onSuccess: () => {
      // Invalidate log list so it refreshes
      queryClient.invalidateQueries({ queryKey: ["logs", user?.id] });
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
    id:        raw.id as string,
    mediaId:   raw.media_id as string,
    episodeId: raw.episode_id as string | null,
    logType:   raw.log_type as LogEntry["logType"],
    watchedAt: raw.watched_at as string,
    rating:    raw.rating as number | null,
    review:    raw.review as string | null,
    moodTagId: raw.mood_tag_id as string | null,
    isRewatch: raw.is_rewatch as boolean,
    isPrivate: raw.is_private as boolean,
    createdAt: raw.created_at as string,
    media: {
      id:          media?.id as string,
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
