// ============================================================
// Auth store — Zustand
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
    set({ session: null, user: null, isLoading: false, isOnboarded: false });
  },
}));

// ---- Bootstrap — call once from the root layout -------------
//
// Flow:
//  1. Register onAuthStateChange listener first so no event is missed.
//  2. Call getSession() to hydrate immediately (handles the case where
//     INITIAL_SESSION already fired before the listener was attached).
//  3. Catch any getSession error (e.g. failed token refresh on bad network)
//     so isLoading is always resolved.
//  4. 5-second hard timeout as the ultimate fallback — if neither
//     getSession nor the listener resolves, we stop the spinner and
//     treat the user as logged out.

export function initAuthListener() {
  // 1. Listener (catches all future events including INITIAL_SESSION)
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      useAuthStore.getState().setSession(session);
    }
  );

  // 2. Explicit session fetch — resolves isLoading even if the
  //    listener fires INITIAL_SESSION before we subscribed
  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      useAuthStore.getState().setSession(session);
    })
    .catch(() => {
      // Token refresh failed (network error, revoked token, etc.)
      // Treat as signed out so the user isn't stuck on a spinner
      useAuthStore.getState().setSession(null);
    });

  // 3. Hard timeout — absolute safety net
  const timeout = setTimeout(() => {
    if (useAuthStore.getState().isLoading) {
      console.warn("[auth] Session resolution timed out — signing out");
      useAuthStore.getState().setSession(null);
    }
  }, 5000);

  return () => {
    subscription.unsubscribe();
    clearTimeout(timeout);
  };
}
