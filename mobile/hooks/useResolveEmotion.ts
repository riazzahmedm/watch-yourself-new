// ============================================================
// useResolveEmotion — post-watch mood check-in mutation
// Calls resolve-emotion edge function with energy + mind levels,
// returns the resolved emotion for the app toast.
// ============================================================

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

export interface ResolvedEmotion {
  slug:        string;
  label:       string;
  emoji:       string;
}

interface ResolveEmotionResult {
  emotion:     ResolvedEmotion;
  energyLabel: string;
  mindLabel:   string;
}

export function useResolveEmotion() {
  const queryClient = useQueryClient();
  const { user }    = useAuthStore();

  return useMutation<
    ResolveEmotionResult,
    Error,
    { logId: string; energyLevel: number; mindLevel: number }
  >({
    mutationFn: async ({ logId, energyLevel, mindLevel }) => {
      const { data, error } = await supabase.functions.invoke<ResolveEmotionResult>(
        "resolve-emotion",
        { body: { logId, energyLevel, mindLevel } }
      );
      if (error) throw error;
      return data as ResolveEmotionResult;
    },

    onSuccess: () => {
      // Invalidate logs so Library/Timeline reflect the new emotion
      queryClient.invalidateQueries({ queryKey: ["logs", user?.id] });
    },
  });
}

// ---- Energy / Mind label constants --------------------------

export const ENERGY_OPTIONS = [
  { level: 1, label: "Drained",  emoji: "🪫" },
  { level: 2, label: "Low",      emoji: "😔" },
  { level: 3, label: "Neutral",  emoji: "😐" },
  { level: 4, label: "Buzzing",  emoji: "⚡" },
  { level: 5, label: "Wired",    emoji: "🔥" },
] as const;

export const MIND_OPTIONS = [
  { level: 1, label: "Empty",       emoji: "💭" },
  { level: 2, label: "Light",       emoji: "🌤️" },
  { level: 3, label: "Neutral",     emoji: "😐" },
  { level: 4, label: "A bit full",  emoji: "🤔" },
  { level: 5, label: "Spinning",    emoji: "🌀" },
] as const;
