// ============================================================
// Auth Screen — app/auth/index.tsx
// Apple Sign In + Google OAuth.
// Opens system browser for OAuth (not in-app WebView — Apple rejects WebViews).
// ============================================================

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { useState } from "react";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

export default function AuthScreen() {
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);

  // ---- Google OAuth -----------------------------------------
  const signInWithGoogle = async () => {
    setLoading("google");
    try {
      const redirectTo = Linking.createURL("/auth/callback");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data.url) {
        // Opens system browser — NOT an in-app WebView
        await Linking.openURL(data.url);
      }
    } catch (err) {
      Alert.alert("Sign in failed", (err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  // ---- Apple Sign In ----------------------------------------
  // Requires expo-apple-authentication — add in a future sprint
  // For now stub with a placeholder that shows intent
  const signInWithApple = async () => {
    Alert.alert(
      "Coming soon",
      "Apple Sign In requires a physical device and paid Apple Developer account. Use Google for now."
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
          <Text style={styles.btnIcon}>🍎</Text>
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
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <>
              <Text style={styles.btnIcon}>G</Text>
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
    color: Colors.background,
  },
  legal: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
});
