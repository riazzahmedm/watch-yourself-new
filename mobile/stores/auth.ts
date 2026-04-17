// ============================================================
// Auth store — Zustand
// Tracks session, user, loading state.
// Subscribes to Supabase auth state changes once at app start.
// ============================================================

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  session:     Session | null;
  user:        User | null;
  isLoading:   boolean;
  isOnboarded: boolean;

  setSession:     (session: Session | null) => void;
  setIsOnboarded: (value: boolean) => void;
  signOut:        () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session:     null,
  user:        null,
  isLoading:   true,
  isOnboarded: false,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, isLoading: false }),

  setIsOnboarded: (value) => set({ isOnboarded: value }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, isOnboarded: false });
  },
}));

// ---- Bootstrap: call once in the root layout ----------------

export function initAuthListener() {
  // Restore existing session on app start
  supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState().setSession(session);
  });

  // Listen to future changes (sign in, sign out, token refresh)
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      useAuthStore.getState().setSession(session);
    }
  );

  return () => subscription.unsubscribe();
}
