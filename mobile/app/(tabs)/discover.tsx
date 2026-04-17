// ============================================================
// Discover Tab — cinematic header + mood chip row + film grid
// ============================================================

import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";

import { Colors } from "@/constants/colors";
import { MOODS } from "@/constants/moods";
import { MoodChip } from "@/components/MoodChip";
import { MediaCard } from "@/components/MediaCard";
import { useRecommendations } from "@/hooks/useRecommendations";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function DiscoverScreen() {
  const router      = useRouter();
  const queryClient = useQueryClient();
  const [activeMood, setActiveMood] = useState(MOODS[0].slug);

  const { data, isLoading, isFetching } = useRecommendations(activeMood);

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["recommendations", activeMood] });
  }, [activeMood, queryClient]);

  const currentMood = MOODS.find((m) => m.slug === activeMood)!;

  return (
    <View style={styles.container}>

      {/* ── Header ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <LinearGradient
          colors={["#0e0b1e", Colors.background]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerContent}>
          <Text style={styles.headerEyebrow}>Watch Yourself</Text>
          <Text style={styles.headerTitle}>How are{"\n"}you feeling?</Text>
        </View>

        {/* Mood chip row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {MOODS.map((mood) => (
            <MoodChip
              key={mood.slug}
              mood={mood}
              selected={activeMood === mood.slug}
              onPress={setActiveMood}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Film grid ────────────────────────────────────────── */}
      {isLoading ? (
        <SkeletonGrid />
      ) : (
        <FlashList
          data={data?.results ?? []}
          numColumns={2}
          estimatedItemSize={280}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={onRefresh}
              tintColor={currentMood.color}
            />
          }
          ListHeaderComponent={
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLeft}>
                <Text style={styles.sectionEmoji}>{currentMood.emoji}</Text>
                <Text style={styles.sectionTitle}>{currentMood.label}</Text>
              </View>
              {data?.personalized && (
                <View style={[styles.personalizedBadge, { borderColor: currentMood.color + "60" }]}>
                  <View style={[styles.personalizedDot, { backgroundColor: currentMood.color }]} />
                  <Text style={[styles.personalizedText, { color: currentMood.color }]}>
                    For you
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <MediaCard
                id={item.id}
                title={item.title}
                posterUrl={item.posterUrl}
                releaseYear={item.releaseYear}
                tmdbRating={item.tmdbRating}
                watchYourselfScore={item.cineMoodScore}
                mediaType={item.mediaType}
                moodScore={item.moodScore}
                moodColor={currentMood.color}
                onPress={() => router.push(`/media/${item.tmdbId}`)}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{currentMood.emoji}</Text>
              <Text style={styles.emptyTitle}>Catalog growing</Text>
              <Text style={styles.emptyBody}>
                No films for this mood yet.{"\n"}Check back soon.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function SkeletonGrid() {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.skeletonCard,
            { opacity: 1 - i * 0.12 },
          ]}
        />
      ))}
    </View>
  );
}

const CARD_W = (SCREEN_WIDTH - 44) / 2;

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    paddingTop:    56,
    paddingBottom: 4,
    overflow:      "hidden",
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingBottom:     16,
  },
  headerEyebrow: {
    fontSize:      11,
    fontWeight:    "700",
    color:         Colors.accent,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom:  6,
  },
  headerTitle: {
    fontSize:      32,
    fontWeight:    "800",
    color:         Colors.text,
    letterSpacing: -0.8,
    lineHeight:    38,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsRow: {
    paddingHorizontal: 20,
    paddingVertical:   12,
    gap:               8,
    flexDirection:     "row",
  },

  // Section heading
  sectionHeader: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 4,
    paddingTop:        16,
    paddingBottom:     12,
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  sectionEmoji: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize:      18,
    fontWeight:    "700",
    color:         Colors.text,
    letterSpacing: -0.3,
  },
  personalizedBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    borderWidth:       1,
    borderRadius:      8,
    paddingHorizontal: 9,
    paddingVertical:   4,
    backgroundColor:   Colors.glass,
  },
  personalizedDot: {
    width:        5,
    height:       5,
    borderRadius: 2.5,
  },
  personalizedText: {
    fontSize:   11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Grid
  listContent: {
    paddingHorizontal: 16,
    paddingBottom:     110,
  },
  cardWrapper: {
    flex:              1,
    paddingHorizontal: 4,
  },

  // Empty state
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap:        10,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize:   18,
    fontWeight: "700",
    color:      Colors.text,
  },
  emptyBody: {
    color:     Colors.textSecondary,
    textAlign: "center",
    fontSize:  14,
    lineHeight: 22,
  },

  // Skeleton
  skeletonGrid: {
    flexDirection:     "row",
    flexWrap:          "wrap",
    paddingHorizontal: 16,
    paddingTop:        12,
    gap:               12,
  },
  skeletonCard: {
    width:           CARD_W,
    height:          CARD_W * 1.52,
    backgroundColor: Colors.surface,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     Colors.border,
  },
});
