// ============================================================
// Root Layout — app/_layout.tsx
// Responsibilities:
//   1. Initialise auth listener (Supabase session restore)
//   2. Handle deep link auth callbacks (OAuth redirect)
//   3. Flush offline log queue when app comes to foreground
//   4. Provide TanStack Query client
//   5. Route guard: unauthenticated → /auth, authenticated → /(tabs)
// ============================================================

import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import * as Linking from "expo-linking";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { Toaster } from "sonner-native";

import { supabase } from "@/lib/supabase";
import { initAuthListener, useAuthStore } from "@/stores/auth";
import { useLogQueue } from "@/stores/logQueue";
import { useOnboardingStore } from "@/stores/onboarding";

// TanStack Query client — shared across the whole app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:  5 * 60 * 1000,   // 5 min
      gcTime:     30 * 60 * 1000,  // 30 min
      retry:      2,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <AuthGate />
        <Toaster
          theme="dark"
          richColors
          position="top-center"
          offset={56}
          toastOptions={{
            style: { borderRadius: 14 },
          }}
        />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

// ---- Auth gate (handles routing based on session) -----------

function AuthGate() {
  const { session, isLoading } = useAuthStore();
  const { flush }              = useLogQueue();
  const { isOnboarded }        = useOnboardingStore();
  const router                 = useRouter();
  const segments               = useSegments();

  // 1. Initialise Supabase auth listener once
  useEffect(() => {
    const unsubscribe = initAuthListener();
    return unsubscribe;
  }, []);

  // 2. Handle deep link auth callbacks
  //    Supabase PKCE flow:     watch-yourself://auth/callback?code=...
  //    Legacy implicit flow:   watch-yourself://auth/callback#access_token=...
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url.includes("auth/callback")) return;

      const parsed = Linking.parse(url);

      // PKCE flow (default in Supabase v2+) — exchange code for session
      const code = parsed.queryParams?.code as string | undefined;
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        return;
      }

      // Legacy implicit flow fallback
      const accessToken  = parsed.queryParams?.access_token as string | undefined;
      const refreshToken = parsed.queryParams?.refresh_token as string | undefined;
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    };

    // Check the URL that opened the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Listen for URLs while app is running (warm start / foreground)
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // 3. Flush offline queue when app returns to foreground
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active" && session) {
        flush();
      }
    };
    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [session, flush]);

  // 4. Route guard (runs once isLoading is false)
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup  = segments[0] === "auth";
    const inOnboarding = segments[0] === "onboarding";
    const inTabs       = segments[0] === "(tabs)";

    if (!session && !inAuthGroup) {
      // Not signed in → auth screen
      router.replace("/auth");
    } else if (session && !isOnboarded && !inOnboarding) {
      // Signed in but hasn't picked genres yet → onboarding
      router.replace("/onboarding");
    } else if (session && isOnboarded && !inTabs) {
      // Signed in + onboarded → main app
      router.replace("/(tabs)/discover");
    }
  }, [session, isLoading, isOnboarded, segments, router]);

  return <Slot />;
}
