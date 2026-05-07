// ============================================================
// useEmotions — fetch granular emotion lookup from Supabase
// Cached aggressively — the emotions table rarely changes.
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Emotion {
  id:          string;
  slug:        string;
  label:       string;
  emoji:       string;
  valence:     "positive" | "negative" | "neutral";
  energyLevel: number;
}

export function useEmotions() {
  return useQuery<Emotion[]>({
    queryKey: ["emotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emotions")
        .select("id, slug, label, emoji, valence, energy_level")
        .order("energy_level", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((e) => ({
        id:          e.id,
        slug:        e.slug,
        label:       e.label,
        emoji:       e.emoji,
        valence:     e.valence as Emotion["valence"],
        energyLevel: e.energy_level,
      }));
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hr
    gcTime:    7  * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Look up a single emotion by slug from a pre-fetched list.
 */
export function findEmotion(
  emotions: Emotion[] | undefined,
  slug: string
): Emotion | undefined {
  return emotions?.find((e) => e.slug === slug);
}
