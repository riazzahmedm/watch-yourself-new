// ============================================================
// Auth Screen — app/auth/index.tsx
// Google OAuth via expo-web-browser (openAuthSessionAsync).
// Uses Supabase PKCE flow: browser returns ?code= which is
// exchanged for a session in _layout.tsx deep-link handler.
// ============================================================

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

// Warm up the browser on Android so it opens instantly
WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);

  // ---- Google OAuth -----------------------------------------
  const signInWithGoogle = async () => {
    setLoading("google");
    try {
      // The redirect URL must EXACTLY match what's in Supabase →
      // Authentication → URL Configuration → Redirect URLs
      const redirectTo = Linking.createURL("/auth/callback");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true, // we open the browser ourselves below
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error("No OAuth URL returned from Supabase");

      // openAuthSessionAsync closes the browser automatically once the
      // redirect URL is detected — much cleaner than Linking.openURL
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      if (result.type === "success") {
        // The deep-link handler in _layout.tsx handles the code exchange.
        // Force-trigger it in case the app was already foregrounded.
        const url = result.url;
        const parsed = Linking.parse(url);
        const code = parsed.queryParams?.code as string | undefined;
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      Alert.alert("Sign in failed", message);
    } finally {
      setLoading(null);
    }
  };

  // ---- Apple Sign In ----------------------------------------
  const signInWithApple = () => {
    Alert.alert(
      "Coming soon",
      "Apple Sign In requires a physical device and a paid Apple Developer account. Use Google for now."
    );
  };

  return (
    <View style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.emoji}>🎬</Text>
        <Text style={styles.title}>Watch Yourself</Text>
        <Text style={styles.subtitle}>
          Understand yourself{"\n"}through movies
        </Text>
      </View>

      {/* Mood preview pills */}
      <View style={styles.moodRow}>
        {["😔 Feeling Low", "🤯 Mind Blown", "😌 Comfort Watch"].map((m) => (
          <View key={m} style={styles.moodPill}>
            <Text style={styles.moodPillText}>{m}</Text>
          </View>
        ))}
      </View>

      {/* Auth buttons */}
      <View style={styles.buttons}>
        {/* Apple */}
        <TouchableOpacity
          style={[styles.btn, styles.appleBtn]}
          onPress={signInWithApple}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnIcon, { color: Colors.background }]}>🍎</Text>
          <Text style={[styles.btnText, styles.appleBtnText]}>
            Continue with Apple
          </Text>
        </TouchableOpacity>

        {/* Google */}
        <TouchableOpacity
          style={[styles.btn, styles.googleBtn]}
          onPress={signInWithGoogle}
          activeOpacity={0.85}
          disabled={loading === "google"}
        >
          {loading === "google" ? (
            <ActivityIndicator color={Colors.text} size="small" />
          ) : (
            <>
              <Text style={[styles.btnIcon, { color: Colors.text }]}>G</Text>
              <Text style={[styles.btnText, styles.googleBtnText]}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.legal}>
        By continuing you agree to our Terms of Service{"\n"}and Privacy Policy
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 48,
  },
  hero: {
    alignItems: "center",
    gap: 12,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 42,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 26,
  },
  moodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  moodPill: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  moodPillText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  buttons: {
    width: "100%",
    gap: 12,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
    width: "100%",
  },
  appleBtn: {
    backgroundColor: Colors.text,
  },
  googleBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  appleBtnText: {
    color: Colors.background,
  },
  googleBtnText: {
    color: Colors.text,
  },
  btnIcon: {
    fontSize: 18,
  },
  legal: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
});
