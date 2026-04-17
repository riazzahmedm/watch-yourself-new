import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, callEdgeFunction } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

export interface TasteDna {
  genreAffinities:  Record<string, number>;
  topGenres:        { id: number; name: string; score: number }[];
  paceTolerance:    "slow" | "medium" | "fast" | "mixed" | null;
  twistDependency:  number | null;
  comfortRewatcher: boolean;
  seriesVsMovie:    number | null;
  bingeVsCasual:    number | null;
  avgRating:        number | null;
  totalLogged:      number;
  twins:            TwinMatch[];
  lastComputedAt:   string | null;
}

export interface TwinMatch {
  userId:      string;
  username:    string;
  displayName: string | null;
  avatarUrl:   string | null;
  matchScore:  number;
  sharedGenres: string[];
}

// ---- Fetch stored DNA from DB --------------------------------

export function useTasteDna() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey:  ["taste-dna", user?.id],
    queryFn:   async () => {
      const { data, error } = await supabase
        .from("taste_dna")
        .select("*")
        .eq("user_id", user!.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled:   !!user,
    staleTime: 30 * 60 * 1000,  // 30 min
  });
}

// ---- Trigger recomputation -----------------------------------

export function useComputeTasteDna() {
  const queryClient = useQueryClient();
  const { user }    = useAuthStore();

  return useMutation({
    mutationFn: () =>
      callEdgeFunction<{ dna: TasteDna; isDisplayable: boolean; logsUntilDisplayable: number }>(
        "generate-taste-dna",
        {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taste-dna", user?.id] });
    },
  });
}
