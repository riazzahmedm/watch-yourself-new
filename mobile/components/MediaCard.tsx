// ============================================================
// MediaCard — cinematic full-bleed poster card
// Info overlaid at bottom with gradient scrim
// ============================================================

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";

const BLURHASH = "LGF5?xYk^6#M@-5c,1J5@[or[Q6.";

interface Props {
  id:             string;
  title:          string;
  posterUrl:      string | null;
  releaseYear:    number | null;
  tmdbRating?:    number;
  watchYourselfScore?: number;
  mediaType:      "movie" | "series";
  moodScore?:     number;
  moodColor?:     string;
  onPress:        () => void;
  onLongPress?:   () => void;
  size?:          "small" | "medium" | "large";
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CARD_WIDTHS = {
  small:  (SCREEN_WIDTH - 52) / 3,
  medium: (SCREEN_WIDTH - 44) / 2,
  large:  SCREEN_WIDTH - 32,
};

export function MediaCard({
  title,
  posterUrl,
  releaseYear,
  tmdbRating,
  watchYourselfScore,
  mediaType,
  moodScore,
  moodColor,
  onPress,
  onLongPress,
  size = "medium",
}: Props) {
  const cardWidth  = CARD_WIDTHS[size];
  const cardHeight = cardWidth * 1.52;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth, height: cardHeight }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.9}
    >
      {/* ── Poster ─────────────────────────────────────────── */}
      <Image
        source={{ uri: posterUrl ?? undefined }}
        style={StyleSheet.absoluteFill}
        placeholder={{ blurhash: BLURHASH }}
        contentFit="cover"
        transition={300}
      />

      {/* ── Gradient scrim ─────────────────────────────────── */}
      <LinearGradient
        colors={["transparent", "rgba(8,8,16,0.5)", "rgba(8,8,16,0.97)"]}
        locations={[0.35, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Top badges ─────────────────────────────────────── */}
      <View style={styles.topRow}>
        {mediaType === "series" && (
          <View style={styles.tvBadge}>
            <Text style={styles.tvBadgeText}>TV</Text>
          </View>
        )}
        {watchYourselfScore != null && (
          <View style={[styles.scoreBadge, { marginLeft: "auto" }]}>
            <Text style={styles.scoreText}>
              {Math.round(watchYourselfScore * 100)}
            </Text>
          </View>
        )}
      </View>

      {/* ── Bottom info ────────────────────────────────────── */}
      <View style={styles.info}>
        {/* Mood match bar */}
        {moodScore != null && moodScore > 0.4 && (
          <View style={styles.moodBar}>
            <View
              style={[
                styles.moodFill,
                {
                  width:           `${Math.round(moodScore * 100)}%`,
                  backgroundColor: moodColor ?? Colors.accent,
                },
              ]}
            />
          </View>
        )}

        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.meta}>
          {releaseYear && (
            <Text style={styles.metaText}>{releaseYear}</Text>
          )}
          {tmdbRating != null && tmdbRating > 0 && (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>
                ★ {tmdbRating.toFixed(1)}
              </Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius:  14,
    overflow:      "hidden",
    marginBottom:  12,
    backgroundColor: Colors.surface,
  },
  topRow: {
    flexDirection:   "row",
    alignItems:      "flex-start",
    padding:         10,
    position:        "absolute",
    top:             0,
    left:            0,
    right:           0,
  },
  tvBadge: {
    backgroundColor: Colors.accent,
    borderRadius:    5,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  tvBadgeText: {
    color:      "#fff",
    fontSize:   9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  scoreBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius:    6,
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderWidth:     1,
    borderColor:     Colors.accent + "80",
  },
  scoreText: {
    color:      Colors.accent,
    fontSize:   10,
    fontWeight: "800",
  },
  info: {
    position: "absolute",
    bottom:   0,
    left:     0,
    right:    0,
    padding:  12,
    gap:      5,
  },
  moodBar: {
    height:          2,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius:    1,
    overflow:        "hidden",
    marginBottom:    2,
  },
  moodFill: {
    height:       "100%",
    borderRadius: 1,
  },
  title: {
    color:         Colors.text,
    fontSize:      13,
    fontWeight:    "700",
    lineHeight:    18,
    letterSpacing: -0.2,
  },
  meta: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           5,
  },
  metaText: {
    color:    Colors.textSecondary,
    fontSize: 11,
    fontWeight: "500",
  },
  metaDot: {
    width:           3,
    height:          3,
    borderRadius:    1.5,
    backgroundColor: Colors.textMuted,
  },
});
