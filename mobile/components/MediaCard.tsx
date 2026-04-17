// ============================================================
// MediaCard — reusable movie/series poster card
// Used in: Discover feed, Search results, Library list
// ============================================================

import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Colors } from "@/constants/colors";

const BLURHASH = "LGF5?xYk^6#M@-5c,1J5@[or[Q6."; // generic cinema blurhash

interface Props {
  id:          string;
  title:       string;
  posterUrl:   string | null;
  releaseYear: number | null;
  tmdbRating?: number;
  cineMoodScore?: number;
  mediaType:   "movie" | "series";
  moodScore?:  number;
  onPress:     () => void;
  onLongPress?: () => void;
  size?:       "small" | "medium" | "large";
}

const CARD_WIDTHS = {
  small:  (Dimensions.get("window").width - 48) / 3,
  medium: (Dimensions.get("window").width - 40) / 2,
  large:  Dimensions.get("window").width - 32,
};

export function MediaCard({
  title,
  posterUrl,
  releaseYear,
  tmdbRating,
  cineMoodScore,
  mediaType,
  moodScore,
  onPress,
  onLongPress,
  size = "medium",
}: Props) {
  const cardWidth  = CARD_WIDTHS[size];
  const cardHeight = cardWidth * 1.5;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
    >
      {/* Poster */}
      <View style={[styles.posterContainer, { height: cardHeight }]}>
        <Image
          source={{ uri: posterUrl ?? undefined }}
          style={styles.poster}
          placeholder={{ blurhash: BLURHASH }}
          contentFit="cover"
          transition={200}
        />

        {/* Type badge */}
        {mediaType === "series" && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>TV</Text>
          </View>
        )}

        {/* CineMood score badge (only for recommendations) */}
        {cineMoodScore != null && (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeText}>
              {Math.round(cineMoodScore * 100)}
            </Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <View style={styles.meta}>
          {releaseYear && (
            <Text style={styles.metaText}>{releaseYear}</Text>
          )}
          {tmdbRating != null && (
            <Text style={styles.metaText}>⭐ {tmdbRating.toFixed(1)}</Text>
          )}
        </View>
        {moodScore != null && moodScore > 0.5 && (
          <View style={styles.moodBar}>
            <View style={[styles.moodFill, { width: `${moodScore * 100}%` }]} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius:    12,
    overflow:        "hidden",
    marginBottom:    16,
  },
  posterContainer: {
    width:    "100%",
    position: "relative",
  },
  poster: {
    width:        "100%",
    height:       "100%",
    borderRadius: 8,
  },
  typeBadge: {
    position:        "absolute",
    top:             8,
    right:           8,
    backgroundColor: Colors.accent,
    borderRadius:    4,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  typeBadgeText: {
    color:      "#fff",
    fontSize:   10,
    fontWeight: "700",
  },
  scoreBadge: {
    position:        "absolute",
    bottom:          8,
    left:            8,
    backgroundColor: "#00000090",
    borderRadius:    6,
    paddingHorizontal: 6,
    paddingVertical:   3,
    borderWidth:     1,
    borderColor:     Colors.accent,
  },
  scoreBadgeText: {
    color:      Colors.accent,
    fontSize:   11,
    fontWeight: "700",
  },
  info: {
    padding: 8,
    gap:     4,
  },
  title: {
    color:      Colors.text,
    fontSize:   13,
    fontWeight: "600",
    lineHeight: 18,
  },
  meta: {
    flexDirection: "row",
    gap:           8,
  },
  metaText: {
    color:    Colors.textSecondary,
    fontSize: 11,
  },
  moodBar: {
    height:          3,
    backgroundColor: Colors.border,
    borderRadius:    2,
    overflow:        "hidden",
    marginTop:       2,
  },
  moodFill: {
    height:          "100%",
    backgroundColor: Colors.accent,
    borderRadius:    2,
  },
});
