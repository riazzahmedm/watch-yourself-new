// ============================================================
// Auth Screen — email + password (sign in & sign up)
// ============================================================

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const [mode, setMode]       = useState<Mode>("signin");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        // Session set → auth listener in _layout.tsx routes to /(tabs)/discover
      } else {
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        Alert.alert(
          "Check your email",
          "We sent you a confirmation link. Tap it to activate your account, then sign in."
        );
        setMode("signin");
      }
    } catch (err: unknown) {
      Alert.alert(
        mode === "signin" ? "Sign in failed" : "Sign up failed",
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
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

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <TouchableOpacity
            style={[styles.btn, styles.primaryBtn]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === "signin" ? "Sign In" : "Create Account"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Mode toggle */}
          <TouchableOpacity
            onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleText}>
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legal}>
          By continuing you agree to our Terms of Service{"\n"}and Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  form: {
    width: "100%",
    gap: 12,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.text,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    marginTop: 4,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  toggleText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
  },
  legal: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
});
