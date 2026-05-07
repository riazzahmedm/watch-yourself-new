export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      catalog_import_log: {
        Row: {
          id: string
          imported_at: string
          media_count: number
          mood_slug: string
          tmdb_page: number
        }
        Insert: {
          id?: string
          imported_at?: string
          media_count?: number
          mood_slug: string
          tmdb_page: number
        }
        Update: {
          id?: string
          imported_at?: string
          media_count?: number
          mood_slug?: string
          tmdb_page?: number
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emotions: {
        Row: {
          created_at: string
          emoji: string
          energy_level: number
          id: string
          label: string
          slug: string
          valence: string
        }
        Insert: {
          created_at?: string
          emoji: string
          energy_level: number
          id?: string
          label: string
          slug: string
          valence: string
        }
        Update: {
          created_at?: string
          emoji?: string
          energy_level?: number
          id?: string
          label?: string
          slug?: string
          valence?: string
        }
        Relationships: []
      }
      episodes: {
        Row: {
          air_date: string | null
          cached_at: string
          episode_number: number
          id: string
          media_id: string
          overview: string | null
          runtime_minutes: number | null
          season_number: number
          still_path: string | null
          title: string | null
          tmdb_episode_id: number | null
        }
        Insert: {
          air_date?: string | null
          cached_at?: string
          episode_number: number
          id?: string
          media_id: string
          overview?: string | null
          runtime_minutes?: number | null
          season_number: number
          still_path?: string | null
          title?: string | null
          tmdb_episode_id?: number | null
        }
        Update: {
          air_date?: string | null
          cached_at?: string
          episode_number?: number
          id?: string
          media_id?: string
          overview?: string | null
          runtime_minutes?: number | null
          season_number?: number
          still_path?: string | null
          title?: string | null
          tmdb_episode_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "enriched_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          binge_session: boolean
          created_at: string
          episode_id: string | null
          favorite_cast_id: string | null
          id: string
          interest_hook: string | null
          is_private: boolean
          is_rewatch: boolean
          log_type: Database["public"]["Enums"]["log_type_enum"]
          media_id: string
          mood_tag_id: string | null
          post_energy_level: number | null
          post_mind_level: number | null
          post_watch_emotion_id: string | null
          pre_watch_answer: string | null
          pre_watch_emotion_id: string | null
          pre_watch_question_id: string | null
          rating: number | null
          reaction_stamp: string | null
          review: string | null
          updated_at: string
          user_id: string
          watch_platform: string | null
          watched_at: string
        }
        Insert: {
          binge_session?: boolean
          created_at?: string
          episode_id?: string | null
          favorite_cast_id?: string | null
          id?: string
          interest_hook?: string | null
          is_private?: boolean
          is_rewatch?: boolean
          log_type: Database["public"]["Enums"]["log_type_enum"]
          media_id: string
          mood_tag_id?: string | null
          post_energy_level?: number | null
          post_mind_level?: number | null
          post_watch_emotion_id?: string | null
          pre_watch_answer?: string | null
          pre_watch_emotion_id?: string | null
          pre_watch_question_id?: string | null
          rating?: number | null
          reaction_stamp?: string | null
          review?: string | null
          updated_at?: string
          user_id: string
          watch_platform?: string | null
          watched_at?: string
        }
        Update: {
          binge_session?: boolean
          created_at?: string
          episode_id?: string | null
          favorite_cast_id?: string | null
          id?: string
          interest_hook?: string | null
          is_private?: boolean
          is_rewatch?: boolean
          log_type?: Database["public"]["Enums"]["log_type_enum"]
          media_id?: string
          mood_tag_id?: string | null
          post_energy_level?: number | null
          post_mind_level?: number | null
          post_watch_emotion_id?: string | null
          pre_watch_answer?: string | null
          pre_watch_emotion_id?: string | null
          pre_watch_question_id?: string | null
          rating?: number | null
          reaction_stamp?: string | null
          review?: string | null
          updated_at?: string
          user_id?: string
          watch_platform?: string | null
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_favorite_cast_id_fkey"
            columns: ["favorite_cast_id"]
            isOneToOne: false
            referencedRelation: "media_cast"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "enriched_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_mood_tag_id_fkey"
            columns: ["mood_tag_id"]
            isOneToOne: false
            referencedRelation: "mood_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_post_watch_emotion_id_fkey"
            columns: ["post_watch_emotion_id"]
            isOneToOne: false
            referencedRelation: "emotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_pre_watch_emotion_id_fkey"
            columns: ["pre_watch_emotion_id"]
            isOneToOne: false
            referencedRelation: "emotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_pre_watch_question_id_fkey"
            columns: ["pre_watch_question_id"]
            isOneToOne: false
            referencedRelation: "mood_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          avg_user_rating: number | null
          backdrop_path: string | null
          cached_at: string
          created_at: string
          id: string
          last_enriched_at: string | null
          media_type: Database["public"]["Enums"]["media_type_enum"]
          mood_match_rates: Json
          mood_scores: Json
          mood_tag_slugs: string[]
          original_language: string | null
          original_title: string | null
          overview: string | null
          poster_path: string | null
          release_year: number | null
          runtime_minutes: number | null
          status: string | null
          title: string
          tmdb_genre_ids: number[]
          tmdb_genres: Json
          tmdb_id: number
          tmdb_keywords: string[]
          tmdb_rating: number | null
          tmdb_vote_count: number
          total_logs_count: number
          watch_yourself_score: number | null
        }
        Insert: {
          avg_user_rating?: number | null
          backdrop_path?: string | null
          cached_at?: string
          created_at?: string
          id?: string
          last_enriched_at?: string | null
          media_type: Database["public"]["Enums"]["media_type_enum"]
          mood_match_rates?: Json
          mood_scores?: Json
          mood_tag_slugs?: string[]
          original_language?: string | null
          original_title?: string | null
          overview?: string | null
          poster_path?: string | null
          release_year?: number | null
          runtime_minutes?: number | null
          status?: string | null
          title: string
          tmdb_genre_ids?: number[]
          tmdb_genres?: Json
          tmdb_id: number
          tmdb_keywords?: string[]
          tmdb_rating?: number | null
          tmdb_vote_count?: number
          total_logs_count?: number
          watch_yourself_score?: number | null
        }
        Update: {
          avg_user_rating?: number | null
          backdrop_path?: string | null
          cached_at?: string
          created_at?: string
          id?: string
          last_enriched_at?: string | null
          media_type?: Database["public"]["Enums"]["media_type_enum"]
          mood_match_rates?: Json
          mood_scores?: Json
          mood_tag_slugs?: string[]
          original_language?: string | null
          original_title?: string | null
          overview?: string | null
          poster_path?: string | null
          release_year?: number | null
          runtime_minutes?: number | null
          status?: string | null
          title?: string
          tmdb_genre_ids?: number[]
          tmdb_genres?: Json
          tmdb_id?: number
          tmdb_keywords?: string[]
          tmdb_rating?: number | null
          tmdb_vote_count?: number
          total_logs_count?: number
          watch_yourself_score?: number | null
        }
        Relationships: []
      }
      media_cast: {
        Row: {
          billing_order: number
          cached_at: string
          character: string | null
          department: string
          id: string
          media_id: string
          name: string
          profile_path: string | null
          tmdb_person_id: number
        }
        Insert: {
          billing_order?: number
          cached_at?: string
          character?: string | null
          department?: string
          id?: string
          media_id: string
          name: string
          profile_path?: string | null
          tmdb_person_id: number
        }
        Update: {
          billing_order?: number
          cached_at?: string
          character?: string | null
          department?: string
          id?: string
          media_id?: string
          name?: string
          profile_path?: string | null
          tmdb_person_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_cast_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "enriched_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_cast_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      media_videos: {
        Row: {
          cached_at: string
          id: string
          media_id: string
          name: string | null
          official: boolean
          published_at: string | null
          tmdb_video_key: string
          video_type: string
        }
        Insert: {
          cached_at?: string
          id?: string
          media_id: string
          name?: string | null
          official?: boolean
          published_at?: string | null
          tmdb_video_key: string
          video_type: string
        }
        Update: {
          cached_at?: string
          id?: string
          media_id?: string
          name?: string | null
          official?: boolean
          published_at?: string | null
          tmdb_video_key?: string
          video_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_videos_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "enriched_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_videos_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      media_watch_providers: {
        Row: {
          cached_at: string
          country_code: string
          display_priority: number
          id: string
          media_id: string
          provider_logo_path: string | null
          provider_name: string
          provider_type: string
        }
        Insert: {
          cached_at?: string
          country_code: string
          display_priority?: number
          id?: string
          media_id: string
          provider_logo_path?: string | null
          provider_name: string
          provider_type: string
        }
        Update: {
          cached_at?: string
          country_code?: string
          display_priority?: number
          id?: string
          media_id?: string
          provider_logo_path?: string | null
          provider_name?: string
          provider_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_watch_providers_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "enriched_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_watch_providers_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_feedback: {
        Row: {
          created_at: string
          id: string
          log_id: string
          match_response: Database["public"]["Enums"]["mood_match_enum"]
          media_id: string
          mood_tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_id: string
          match_response: Database["public"]["Enums"]["mood_match_enum"]
          media_id: string
          mood_tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          log_id?: string
          match_response?: Database["public"]["Enums"]["mood_match_enum"]
          media_id?: string
          mood_tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_feedback_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: true
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mood_feedback_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "enriched_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mood_feedback_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mood_feedback_mood_tag_id_fkey"
            columns: ["mood_tag_id"]
            isOneToOne: false
            referencedRelation: "mood_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mood_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_questions: {
        Row: {
          created_at: string
          id: string
          option_a: Json
          option_b: Json
          option_c: Json
          option_d: Json
          option_e: Json
          option_f: Json | null
          question_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_a: Json
          option_b: Json
          option_c: Json
          option_d: Json
          option_e: Json
          option_f?: Json | null
          question_text: string
        }
        Update: {
          created_at?: string
          id?: string
          option_a?: Json
          option_b?: Json
          option_c?: Json
          option_d?: Json
          option_e?: Json
          option_f?: Json | null
          question_text?: string
        }
        Relationships: []
      }
      mood_tags: {
        Row: {
          avoid_genres: number[]
          created_at: string
          description: string | null
          display_order: number
          emoji: string
          id: string
          label: string
          max_runtime_mins: number | null
          min_tmdb_rating: number
          pace_preference: Database["public"]["Enums"]["pace_enum"] | null
          preferred_genres: number[]
          preferred_tone: string[]
          slug: string
        }
        Insert: {
          avoid_genres?: number[]
          created_at?: string
          description?: string | null
          display_order?: number
          emoji: string
          id?: string
          label: string
          max_runtime_mins?: number | null
          min_tmdb_rating?: number
          pace_preference?: Database["public"]["Enums"]["pace_enum"] | null
          preferred_genres?: number[]
          preferred_tone?: string[]
          slug: string
        }
        Update: {
          avoid_genres?: number[]
          created_at?: string
          description?: string | null
          display_order?: number
          emoji?: string
          id?: string
          label?: string
          max_runtime_mins?: number | null
          min_tmdb_rating?: number
          pace_preference?: Database["public"]["Enums"]["pace_enum"] | null
          preferred_genres?: number[]
          preferred_tone?: string[]
          slug?: string
        }
        Relationships: []
      }
      phase_label_rules: {
        Row: {
          genre_name: string | null
          id: string
          mood_slug: string | null
          phase_label: string
          priority: number
        }
        Insert: {
          genre_name?: string | null
          id?: string
          mood_slug?: string | null
          phase_label: string
          priority?: number
        }
        Update: {
          genre_name?: string | null
          id?: string
          mood_slug?: string | null
          phase_label?: string
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "phase_label_rules_mood_slug_fkey"
            columns: ["mood_slug"]
            isOneToOne: false
            referencedRelation: "mood_tags"
            referencedColumns: ["slug"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          total_logs: number
          total_watch_hours: number
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          total_logs?: number
          total_watch_hours?: number
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          total_logs?: number
          total_watch_hours?: number
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      taste_dna: {
        Row: {
          avg_rating: number | null
          binge_vs_casual: number | null
          comfort_rewatcher: boolean
          created_at: string
          genre_affinities: Json
          id: string
          last_computed_at: string | null
          pace_tolerance: Database["public"]["Enums"]["pace_enum"] | null
          series_vs_movie: number | null
          total_logged: number
          twin_cache: Json
          twin_cache_updated_at: string | null
          twist_dependency: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_rating?: number | null
          binge_vs_casual?: number | null
          comfort_rewatcher?: boolean
          created_at?: string
          genre_affinities?: Json
          id?: string
          last_computed_at?: string | null
          pace_tolerance?: Database["public"]["Enums"]["pace_enum"] | null
          series_vs_movie?: number | null
          total_logged?: number
          twin_cache?: Json
          twin_cache_updated_at?: string | null
          twist_dependency?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_rating?: number | null
          binge_vs_casual?: number | null
          comfort_rewatcher?: boolean
          created_at?: string
          genre_affinities?: Json
          id?: string
          last_computed_at?: string | null
          pace_tolerance?: Database["public"]["Enums"]["pace_enum"] | null
          series_vs_movie?: number | null
          total_logged?: number
          twin_cache?: Json
          twin_cache_updated_at?: string | null
          twist_dependency?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taste_dna_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_periods: {
        Row: {
          avg_rating: number | null
          binge_session_count: number
          computed_at: string
          created_at: string
          dominant_genre: string | null
          dominant_mood_id: string | null
          id: string
          life_context_note: string | null
          period_month: number | null
          period_type: Database["public"]["Enums"]["period_type_enum"]
          period_year: number
          phase_label: string | null
          total_hours: number
          updated_at: string
          user_id: string
          watch_count: number
        }
        Insert: {
          avg_rating?: number | null
          binge_session_count?: number
          computed_at?: string
          created_at?: string
          dominant_genre?: string | null
          dominant_mood_id?: string | null
          id?: string
          life_context_note?: string | null
          period_month?: number | null
          period_type: Database["public"]["Enums"]["period_type_enum"]
          period_year: number
          phase_label?: string | null
          total_hours?: number
          updated_at?: string
          user_id: string
          watch_count?: number
        }
        Update: {
          avg_rating?: number | null
          binge_session_count?: number
          computed_at?: string
          created_at?: string
          dominant_genre?: string | null
          dominant_mood_id?: string | null
          id?: string
          life_context_note?: string | null
          period_month?: number | null
          period_type?: Database["public"]["Enums"]["period_type_enum"]
          period_year?: number
          phase_label?: string | null
          total_hours?: number
          updated_at?: string
          user_id?: string
          watch_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "timeline_periods_dominant_mood_id_fkey"
            columns: ["dominant_mood_id"]
            isOneToOne: false
            referencedRelation: "mood_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_periods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          added_at: string
          id: string
          media_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          media_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          media_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "enriched_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      enriched_media: {
        Row: {
          avg_user_rating: number | null
          backdrop_path: string | null
          cached_at: string | null
          computed_score: number | null
          created_at: string | null
          id: string | null
          last_enriched_at: string | null
          media_type: Database["public"]["Enums"]["media_type_enum"] | null
          mood_labels: string[] | null
          mood_match_rates: Json | null
          mood_scores: Json | null
          mood_tag_slugs: string[] | null
          original_language: string | null
          original_title: string | null
          overview: string | null
          poster_path: string | null
          release_year: number | null
          runtime_minutes: number | null
          status: string | null
          title: string | null
          tmdb_genre_ids: number[] | null
          tmdb_genres: Json | null
          tmdb_id: number | null
          tmdb_keywords: string[] | null
          tmdb_rating: number | null
          tmdb_vote_count: number | null
          total_logs_count: number | null
          watch_yourself_score: number | null
        }
        Insert: {
          avg_user_rating?: number | null
          backdrop_path?: string | null
          cached_at?: string | null
          computed_score?: never
          created_at?: string | null
          id?: string | null
          last_enriched_at?: string | null
          media_type?: Database["public"]["Enums"]["media_type_enum"] | null
          mood_labels?: never
          mood_match_rates?: Json | null
          mood_scores?: Json | null
          mood_tag_slugs?: string[] | null
          original_language?: string | null
          original_title?: string | null
          overview?: string | null
          poster_path?: string | null
          release_year?: number | null
          runtime_minutes?: number | null
          status?: string | null
          title?: string | null
          tmdb_genre_ids?: number[] | null
          tmdb_genres?: Json | null
          tmdb_id?: number | null
          tmdb_keywords?: string[] | null
          tmdb_rating?: number | null
          tmdb_vote_count?: number | null
          total_logs_count?: number | null
          watch_yourself_score?: number | null
        }
        Update: {
          avg_user_rating?: number | null
          backdrop_path?: string | null
          cached_at?: string | null
          computed_score?: never
          created_at?: string | null
          id?: string | null
          last_enriched_at?: string | null
          media_type?: Database["public"]["Enums"]["media_type_enum"] | null
          mood_labels?: never
          mood_match_rates?: Json | null
          mood_scores?: Json | null
          mood_tag_slugs?: string[] | null
          original_language?: string | null
          original_title?: string | null
          overview?: string | null
          poster_path?: string | null
          release_year?: number | null
          runtime_minutes?: number | null
          status?: string | null
          title?: string | null
          tmdb_genre_ids?: number[] | null
          tmdb_genres?: Json | null
          tmdb_id?: number | null
          tmdb_keywords?: string[] | null
          tmdb_rating?: number | null
          tmdb_vote_count?: number | null
          total_logs_count?: number | null
          watch_yourself_score?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      compute_watch_yourself_score: {
        Args: {
          p_keyword_count?: number
          p_tmdb_rating: number
          p_vote_count: number
        }
        Returns: number
      }
      get_media_log_aggregates: {
        Args: never
        Returns: {
          avg_rating: number
          log_count: number
          media_id: string
        }[]
      }
      is_username_available: { Args: { p_username: string }; Returns: boolean }
      refresh_media_behavior_signals: {
        Args: { p_media_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      stamp_to_rating: { Args: { stamp: string }; Returns: number }
      user_media_log_count: { Args: { p_media_id: string }; Returns: number }
      watched_episode_ids: { Args: { p_media_id: string }; Returns: string[] }
    }
    Enums: {
      log_type_enum:
        | "movie"
        | "series_episode"
        | "series_season"
        | "series_full"
      media_type_enum: "movie" | "series"
      mood_match_enum: "yes" | "no" | "somewhat"
      pace_enum: "slow" | "medium" | "fast" | "mixed"
      period_type_enum: "month" | "year"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      log_type_enum: [
        "movie",
        "series_episode",
        "series_season",
        "series_full",
      ],
      media_type_enum: ["movie", "series"],
      mood_match_enum: ["yes", "no", "somewhat"],
      pace_enum: ["slow", "medium", "fast", "mixed"],
      period_type_enum: ["month", "year"],
    },
  },
} as const
