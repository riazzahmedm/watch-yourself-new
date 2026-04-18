// ============================================================
// Onboarding store — persisted via MMKV
// Tracks whether the user has completed onboarding and which
// genres they picked (used to seed Taste DNA cold start).
// ============================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createKVStorage } from "@/lib/kvStorage";

const kvStorage = createKVStorage("onboarding");

interface OnboardingState {
  isOnboarded: boolean;
  genreIds:    number[];
  complete:    (genreIds: number[]) => void;
  reset:       () => void;        // dev utility
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      isOnboarded: false,
      genreIds:    [],

      complete: (genreIds) =>
        set({ isOnboarded: true, genreIds }),

      reset: () =>
        set({ isOnboarded: false, genreIds: [] }),
    }),
    {
      name:    "watch-yourself-onboarding",
      storage: createJSONStorage(() => kvStorage),
    }
  )
);
