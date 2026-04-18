// ============================================================
// Onboarding — genre picker
// Seeds Taste DNA on first launch after sign-up.
// Writes initial genre affinities (weight 0.5) to taste_dna.
// ============================================================

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { toast } from "sonner-native";
import * as Haptics from "expo-haptics";

import { Colors, Gradients } from "@/constants/colors";
import { useOnboardingStore } from "@/stores/onboarding";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/lib/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TILE_SIZE = (SCREEN_WIDTH - 48 - 16) / 3; // 3-col grid

const MIN_PICKS = 3;

interface Genre {
  id:    number;
  name:  string;
  emoji: string;
  color: string;
}

const GENRES: Genre[] = [
  { id: 28,    name: "Action",      emoji: "💥", color: "#f87171" },
  { id: 35,    name: "Comedy",      emoji: "😂", color: "#fbbf24" },
  { id: 18,    name: "Drama",       emoji: "🎭", color: "#6ea8fe" },
  { id: 27,    name: "Horror",      emoji: "😱", color: "#a78bfa" },
  { id: 10749, name: "Romance",     emoji: "💕", color: "#f9a8d4" },
  { id: 878,   name: "Sci-Fi",      emoji: "🚀", color: "#38bdf8" },
  { id: 53,    name: "Thriller",    emoji: "🔪", color: "#fb923c" },
  { id: 16,    name: "Animation",   emoji: "✨", color: "#86efac" },
  { id: 99,    name: "Documentary", emoji: "📽️", color: "#d9f99d" },
  { id: 14,    name: "Fantasy",     emoji: "🧙", color: "#c084fc" },
  { id: 9648,  name: "Mystery",     emoji: "🔍", color: "#67e8f9" },
  { id: 12,    name: "Adventure",   emoji: "🗺️", color: "#fde68a" },
  { id: 80,    name: "Crime",       emoji: "🕵️", color: "#fca5a5" },
  { id: 36,    name: "History",     emoji: "📜", color: "#d4d4aa" },
  { id: 10752, name: "War",         emoji: "⚔️", color: "#94a3b8" },
];

export default function OnboardingScreen() {
  const router    = useRouter();
  const { user }  = useAuthStore();
  const complete  = useOnboardingStore((s) => s.complete);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving,   setSaving]   = useState(false);

  const toggle = (id: number) => {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleContinue = async () => {
    if (selected.size < MIN_PICKS) {
      toast.error(`Pick at least ${MIN_PICKS} genres to continue.`);
      return;
    }

    setSaving(true);

    // 1. Save locally first — onboarding completes regardless of network
    const genreIdArray = Array.from(selected);
    complete(genreIdArray);
    // Route guard picks up isOnboarded: true and navigates to /(tabs)/discover

    // 2. Try to sync genre picks to taste_dna in the background
    //    (fails gracefully if migrations aren't applied yet)
    if (user) {
      const genreAffinities: Record<string, number> = {};
      genreIdArray.forEach((id) => { genreAffinities[String(id)] = 0.5; });

      supabase
        .from("taste_dna")
        .upsert(
          { user_id: user.id, genre_affinities: genreAffinities },
          { onConflict: "user_id" }
        )
        .then(({ error }) => {
          if (error) console.warn("[onboarding] taste_dna sync failed:", error.message);
        });
    }

    setSaving(false);
  };

  const remaining = MIN_PICKS - selected.size;

  return (
    <View style={styles.root}>
      {/* Background */}
      <LinearGradient
        colors={["#0e0b1e", "#080810", "#080810"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbBottom]} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>WATCH YOURSELF</Text>
        <Text style={styles.title}>What do you{"\n"}love watching?</Text>
        <Text style={styles.subtitle}>
          {remaining > 0
            ? `Pick at least ${remaining} more genre${remaining > 1 ? "s" : ""}`
            : `${selected.size} genres selected · looking good!`}
        </Text>
      </View>

      {/* Genre grid */}
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {GENRES.map((genre) => {
          const isSelected = selected.has(genre.id);
          return (
            <TouchableOpacity
              key={genre.id}
              style={[
                styles.tile,
                { width: TILE_SIZE, height: TILE_SIZE },
                isSelected && {
                  backgroundColor: genre.color + "22",
                  borderColor:     genre.color + "99",
                  shadowColor:     genre.color,
                  shadowOpacity:   0.4,
                  shadowRadius:    10,
                  shadowOffset:    { width: 0, height: 0 },
                  elevation:       6,
                },
              ]}
              onPress={() => toggle(genre.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.tileEmoji}>{genre.emoji}</Text>
              <Text
                style={[
                  styles.tileName,
                  { color: isSelected ? genre.color : Colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {genre.name}
              </Text>
              {isSelected && (
                <View style={[styles.checkDot, { backgroundColor: genre.color }]} />
              )}
            </TouchableOpacity>
          );
        })}

        {/* Bottom padding so content clears the CTA */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.footer}>
        <LinearGradient
          colors={["transparent", Colors.background]}
          style={styles.footerFade}
          pointerEvents="none"
        />
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.85}
          disabled={saving || selected.size < MIN_PICKS}
          style={styles.btnWrap}
        >
          <LinearGradient
            colors={selected.size >= MIN_PICKS ? Gradients.accent : ["#2a2a3a", "#2a2a3a"]}
            style={styles.btn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.btnText, selected.size < MIN_PICKS && styles.btnTextDim]}>
                {selected.size >= MIN_PICKS
                  ? `Let's go  →`
                  : `Select ${remaining} more`}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.background,
  },

  // Orbs
  orb: {
    position:     "absolute",
    borderRadius: 999,
    opacity:      0.12,
  },
  orbTop: {
    width:           250,
    height:          250,
    backgroundColor: "#7c6af5",
    top:             -60,
    left:            -60,
  },
  orbBottom: {
    width:           200,
    height:          200,
    backgroundColor: "#a78bfa",
    bottom:          100,
    right:           -60,
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop:        64,
    paddingBottom:     20,
    gap:               6,
  },
  eyebrow: {
    fontSize:      11,
    fontWeight:    "700",
    color:         Colors.accent,
    letterSpacing: 1.5,
    marginBottom:  4,
  },
  title: {
    fontSize:      34,
    fontWeight:    "800",
    color:         Colors.text,
    letterSpacing: -0.8,
    lineHeight:    40,
  },
  subtitle: {
    fontSize:  15,
    color:     Colors.textSecondary,
    marginTop: 4,
  },

  // Grid
  grid: {
    flexDirection:     "row",
    flexWrap:          "wrap",
    paddingHorizontal: 24,
    gap:               8,
  },
  tile: {
    backgroundColor:   Colors.glass,
    borderWidth:       1,
    borderColor:       Colors.border,
    borderRadius:      16,
    alignItems:        "center",
    justifyContent:    "center",
    gap:               6,
    position:          "relative",
  },
  tileEmoji: {
    fontSize: 28,
  },
  tileName: {
    fontSize:      11,
    fontWeight:    "600",
    letterSpacing: 0.2,
    textAlign:     "center",
    paddingHorizontal: 4,
  },
  checkDot: {
    position:     "absolute",
    top:          8,
    right:        8,
    width:        8,
    height:       8,
    borderRadius: 4,
  },

  // Footer CTA
  footer: {
    position: "absolute",
    bottom:   0,
    left:     0,
    right:    0,
    padding:  24,
    paddingBottom: 48,
  },
  footerFade: {
    position: "absolute",
    top:      -40,
    left:     0,
    right:    0,
    height:   40,
  },
  btnWrap: {
    borderRadius: 16,
    overflow:     "hidden",
  },
  btn: {
    paddingVertical: 17,
    alignItems:      "center",
    justifyContent:  "center",
    borderRadius:    16,
  },
  btnText: {
    color:         "#fff",
    fontSize:      16,
    fontWeight:    "700",
    letterSpacing: 0.3,
  },
  btnTextDim: {
    color: Colors.textMuted,
  },
});
