// ============================================================
// Auth Screen — cinematic dark hero + glass form
// ============================================================

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { toast } from "sonner-native";
import { supabase } from "@/lib/supabase";
import { Colors, Gradients } from "@/constants/colors";

type Mode = "signin" | "signup";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const [mode, setMode]         = useState<Mode>("signin");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
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
        // Route guard in _layout.tsx handles the redirect
      } else {
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm.");
        setMode("signin");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    // Clear fields when switching modes
    setEmail("");
    setPassword("");
  };

  return (
    <View style={styles.root}>
      {/* ── Background gradient ───────────────────────────── */}
      <LinearGradient
        colors={["#0e0b1e", "#080810", "#080810"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* ── Ambient glow orbs ─────────────────────────────── */}
      <View style={[styles.orb, styles.orbTopLeft]} />
      <View style={[styles.orb, styles.orbBottomRight]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ──────────────────────────────────────── */}
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <Text style={styles.logoEmoji}>🎬</Text>
            </View>
            <Text style={styles.title}>Watch Yourself</Text>
            <Text style={styles.subtitle}>
              Understand yourself{"\n"}through what you watch
            </Text>
          </View>

          {/* ── Mood pills ────────────────────────────────── */}
          <View style={styles.pillRow}>
            {[
              { label: "Feeling Low", color: "#6ea8fe" },
              { label: "Mind Blown",  color: "#c084fc" },
              { label: "Comfort",     color: "#86efac" },
            ].map((p) => (
              <View
                key={p.label}
                style={[styles.pill, { borderColor: p.color + "50" }]}
              >
                <View style={[styles.pillDot, { backgroundColor: p.color }]} />
                <Text style={[styles.pillText, { color: p.color }]}>
                  {p.label}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Glass form card ───────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {mode === "signin" ? "Welcome back" : "Create account"}
            </Text>

            <View style={styles.fields}>
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
                placeholder="Password  (min. 6 characters)"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {/* Gradient submit button */}
            <TouchableOpacity
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={loading}
              style={styles.btnWrap}
            >
              <LinearGradient
                colors={Gradients.accent}
                style={styles.btn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnText}>
                    {mode === "signin" ? "Sign In" : "Create Account"}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleMode} activeOpacity={0.7}>
              <Text style={styles.toggle}>
                {mode === "signin"
                  ? "No account? Sign up"
                  : "Have an account? Sign in"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.legal}>
            By continuing you agree to our Terms & Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow:          1,
    alignItems:        "center",
    paddingHorizontal: 24,
    paddingTop:        80,
    paddingBottom:     48,
    gap:               32,
  },

  // Ambient orbs
  orb: {
    position:     "absolute",
    borderRadius: 999,
    opacity:      0.15,
  },
  orbTopLeft: {
    width:           280,
    height:          280,
    backgroundColor: "#7c6af5",
    top:             -80,
    left:            -80,
  },
  orbBottomRight: {
    width:           220,
    height:          220,
    backgroundColor: "#a78bfa",
    bottom:          80,
    right:           -80,
  },

  // Hero
  hero: {
    alignItems: "center",
    gap:        12,
  },
  logoWrap: {
    width:           72,
    height:          72,
    borderRadius:    22,
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  logoEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize:      38,
    fontWeight:    "800",
    color:         Colors.text,
    letterSpacing: -1,
    textAlign:     "center",
  },
  subtitle: {
    fontSize:   16,
    color:      Colors.textSecondary,
    textAlign:  "center",
    lineHeight: 24,
  },

  // Mood pills
  pillRow: {
    flexDirection:  "row",
    gap:            8,
    flexWrap:       "wrap",
    justifyContent: "center",
  },
  pill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               6,
    borderWidth:       1,
    borderRadius:      20,
    paddingHorizontal: 12,
    paddingVertical:   7,
    backgroundColor:   Colors.glass,
  },
  pillDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  pillText: {
    fontSize:   12,
    fontWeight: "600",
  },

  // Form card
  card: {
    width:           "100%",
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    borderRadius:    24,
    padding:         24,
    gap:             16,
  },
  cardTitle: {
    fontSize:      20,
    fontWeight:    "700",
    color:         Colors.text,
    letterSpacing: -0.3,
  },
  fields: {
    gap: 10,
  },
  input: {
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
    borderRadius:      14,
    paddingHorizontal: 16,
    paddingVertical:   15,
    fontSize:          16,
    color:             Colors.text,
  },
  btnWrap: {
    borderRadius: 14,
    overflow:     "hidden",
  },
  btn: {
    paddingVertical: 16,
    alignItems:      "center",
    justifyContent:  "center",
    borderRadius:    14,
  },
  btnText: {
    color:         "#fff",
    fontSize:      16,
    fontWeight:    "700",
    letterSpacing: 0.3,
  },
  toggle: {
    color:     Colors.textSecondary,
    fontSize:  14,
    textAlign: "center",
  },
  legal: {
    fontSize:  12,
    color:     Colors.textMuted,
    textAlign: "center",
  },
});
