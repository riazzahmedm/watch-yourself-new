// ============================================================
// Watch Yourself — Supabase Database Types
// Auto-keep in sync with migrations. Re-generate with:
//   supabase gen types typescript --local > supabase/functions/_shared/database.types.ts
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          total_logs: number;
          total_watch_hours: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          total_logs?: number;
          total_watch_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };

      mood_tags: {
        Row: {
          id: string;
          slug: string;
          label: string;
          emoji: string;
          description: string | null;
          display_order: number;
          preferred_genres: number[];
          avoid_genres: number[];
          pace_preference: "slow" | "medium" | "fast" | "mixed" | null;
          preferred_tone: string[];
          min_tmdb_rating: number;
          max_runtime_mins: number | null;
          created_at: string;
        };
        Insert: never; // seeded only
        Update: never;
      };

      media: {
        Row: {
          id: string;
          tmdb_id: number;
          media_type: "movie" | "series";
          title: string;
          original_title: string | null;
          overview: string | null;
          poster_path: string | null;
          backdrop_path: string | null;
          release_year: number | null;
          tmdb_genres: Json;            // [{id: number, name: string}]
          tmdb_genre_ids: number[];
          runtime_minutes: number | null;
          tmdb_rating: number | null;
          tmdb_vote_count: number;
          original_language: string | null;
          status: string | null;
          tmdb_keywords: string[];
          cached_at: string;
          created_at: string;
        };
        Insert: {
          tmdb_id: number;
          media_type: "movie" | "series";
          title: string;
          original_title?: string | null;
          overview?: string | null;
          poster_path?: string | null;
          backdrop_path?: string | null;
          release_year?: number | null;
          tmdb_genres?: Json;
          tmdb_genre_ids?: number[];
          runtime_minutes?: number | null;
          tmdb_rating?: number | null;
          tmdb_vote_count?: number;
          original_language?: string | null;
          status?: string | null;
          tmdb_keywords?: string[];
          cached_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["media"]["Insert"]>;
      };

      episodes: {
        Row: {
          id: string;
          media_id: string;
          tmdb_episode_id: number | null;
          season_number: number;
          episode_number: number;
          title: string | null;
          overview: string | null;
          air_date: string | null;
          runtime_minutes: number | null;
          still_path: string | null;
          cached_at: string;
        };
        Insert: {
          media_id: string;
          tmdb_episode_id?: number | null;
          season_number: number;
          episode_number: number;
          title?: string | null;
          overview?: string | null;
          air_date?: string | null;
          runtime_minutes?: number | null;
          still_path?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["episodes"]["Insert"]>;
      };

      logs: {
        Row: {
          id: string;
          user_id: string;
          media_id: string;
          episode_id: string | null;
          log_type: "movie" | "series_episode" | "series_season" | "series_full";
          watched_at: string;
          rating: number | null;
          review: string | null;
          mood_tag_id: string | null;
          is_rewatch: boolean;
          is_private: boolean;
          binge_session: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          media_id: string;
          episode_id?: string | null;
          log_type: "movie" | "series_episode" | "series_season" | "series_full";
          watched_at?: string;
          rating?: number | null;
          review?: string | null;
          mood_tag_id?: string | null;
          is_rewatch?: boolean;
          is_private?: boolean;
          binge_session?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["logs"]["Insert"]>;
      };

      mood_feedback: {
        Row: {
          id: string;
          user_id: string;
          log_id: string;
          media_id: string;
          mood_tag_id: string;
          match_response: "yes" | "no" | "somewhat";
          created_at: string;
        };
        Insert: {
          user_id: string;
          log_id: string;
          media_id: string;
          mood_tag_id: string;
          match_response: "yes" | "no" | "somewhat";
        };
        Update: never;
      };

      taste_dna: {
        Row: {
          id: string;
          user_id: string;
          genre_affinities: Json;
          pace_tolerance: "slow" | "medium" | "fast" | "mixed" | null;
          twist_dependency: number | null;
          comfort_rewatcher: boolean;
          series_vs_movie: number | null;
          binge_vs_casual: number | null;
          avg_rating: number | null;
          total_logged: number;
          twin_cache: Json;
          twin_cache_updated_at: string | null;
          last_computed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          genre_affinities?: Json;
          pace_tolerance?: "slow" | "medium" | "fast" | "mixed" | null;
          twist_dependency?: number | null;
          comfort_rewatcher?: boolean;
          series_vs_movie?: number | null;
          binge_vs_casual?: number | null;
          avg_rating?: number | null;
          total_logged?: number;
        };
        Update: Partial<Database["public"]["Tables"]["taste_dna"]["Insert"]>;
      };

      timeline_periods: {
        Row: {
          id: string;
          user_id: string;
          period_type: "month" | "year";
          period_year: number;
          period_month: number | null;
          dominant_mood_id: string | null;
          dominant_genre: string | null;
          phase_label: string | null;
          life_context_note: string | null;
          watch_count: number;
          total_hours: number;
          avg_rating: number | null;
          binge_session_count: number;
          computed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          period_type: "month" | "year";
          period_year: number;
          period_month?: number | null;
          dominant_mood_id?: string | null;
          dominant_genre?: string | null;
          phase_label?: string | null;
          life_context_note?: string | null;
          watch_count?: number;
          total_hours?: number;
          avg_rating?: number | null;
          binge_session_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["timeline_periods"]["Insert"]>;
      };

      watchlist: {
        Row: {
          id: string;
          user_id: string;
          media_id: string;
          added_at: string;
        };
        Insert: {
          user_id: string;
          media_id: string;
        };
        Update: never;
      };

      device_tokens: {
        Row: {
          id: string;
          user_id: string;
          expo_push_token: string;
          platform: "ios" | "android";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          expo_push_token: string;
          platform: "ios" | "android";
        };
        Update: Partial<Database["public"]["Tables"]["device_tokens"]["Insert"]>;
      };
    };

    Functions: {
      is_username_available: {
        Args: { p_username: string };
        Returns: boolean;
      };
      user_media_log_count: {
        Args: { p_media_id: string };
        Returns: number;
      };
      watched_episode_ids: {
        Args: { p_media_id: string };
        Returns: string[];
      };
    };
  };
};
