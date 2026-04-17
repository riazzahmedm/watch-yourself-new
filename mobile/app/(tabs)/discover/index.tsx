// ============================================================
// Discover Tab — app/(tabs)/discover/index.tsx
// Mood chip row → recommendation FlashList
// Pull-to-refresh → new set of recommendations
// ============================================================

import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { useQueryClient } from "@tanstack/react-query";

import { Colors } from "@/constants/colors";
import { MOODS } from "@/constants/moods";
import { MoodChip } from "@/components/MoodChip";
import { MediaCard } from "@/components/MediaCard";
import { useRecommendations } from "@/hooks/useRecommendations";

export default function DiscoverScreen() {
  const router       = useRouter();
  const queryClient  = useQueryClient();
  const [activeMood, setActiveMood] = useState<string>(MOODS[0].slug);

  const { data, isLoading, isFetching } = useRecommendations(activeMood);

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["recommendations", activeMood] });
  }, [activeMood, queryClient]);

  const handleMoodSelect = (slug: string) => {
    setActiveMood(slug);
  };

  const handleCardPress = (mediaId: string, tmdbId: number) => {
    router.push(`/media/${tmdbId}`);
  };

  const currentMood = MOODS.find((m) => m.slug === activeMood);

  return (
    <View style={styles.container}>
      {/* ---- Header ------------------------------------------ */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>How are you feeling?</Text>
        <Text style={styles.headerSub}>Pick a mood, we'll find the movie</Text>
      </View>

      {/* ---- Mood chips (horizontal scroll) ------------------ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
        style={styles.chipsScroll}
      >
        {MOODS.map((mood) => (
          <MoodChip
            key={mood.slug}
            mood={mood}
            selected={activeMood === mood.slug}
            onPress={handleMoodSelect}
          />
        ))}
      </ScrollView>

      {/* ---- Section heading --------------------------------- */}
      {currentMood && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {currentMood.emoji} {currentMood.label}
          </Text>
          {data?.personalized && (
            <View style={styles.personalizedBadge}>
              <Text style={styles.personalizedText}>✦ Personalised</Text>
            </View>
          )}
        </View>
      )}

      {/* ---- Recommendation feed ----------------------------- */}
      {isLoading ? (
        <LoadingSkeleton />
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
              tintColor={Colors.accent}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <MediaCard
                id={item.id}
                title={item.title}
                posterUrl={item.posterUrl}
                releaseYear={item.releaseYear}
                tmdbRating={item.tmdbRating}
                cineMoodScore={item.cineMoodScore}
                mediaType={item.mediaType}
                moodScore={item.moodScore}
                onPress={() => handleCardPress(item.id, item.tmdbId)}
                onLongPress={() => {
                  // TODO: quick-action sheet (Log, Watchlist, Similar)
                }}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No films found for this mood yet.{"\n"}
                The catalog is still growing 🎬
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.skeletonCard} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop:        60,
    paddingBottom:     16,
  },
  headerTitle: {
    fontSize:   28,
    fontWeight: "800",
    color:      Colors.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize:  15,
    color:     Colors.textSecondary,
    marginTop: 4,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsContainer: {
    paddingHorizontal: 20,
    paddingVertical:   8,
    gap:               8,
    flexDirection:     "row",
  },
  sectionHeader: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 20,
    paddingVertical:   12,
    justifyContent:    "space-between",
  },
  sectionTitle: {
    fontSize:   18,
    fontWeight: "700",
    color:      Colors.text,
  },
  personalizedBadge: {
    backgroundColor: Colors.accentDim,
    borderRadius:    8,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderWidth:     1,
    borderColor:     Colors.accent,
  },
  personalizedText: {
    color:      Colors.accent,
    fontSize:   11,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom:     100,
  },
  cardWrapper: {
    flex:           1,
    paddingHorizontal: 4,
  },
  empty: {
    alignItems:  "center",
    paddingTop:  80,
  },
  emptyText: {
    color:       Colors.textSecondary,
    textAlign:   "center",
    fontSize:    15,
    lineHeight:  24,
  },
  skeletonGrid: {
    flexDirection:     "row",
    flexWrap:          "wrap",
    paddingHorizontal: 16,
    gap:               8,
  },
  skeletonCard: {
    width:           "48%",
    height:          250,
    backgroundColor: Colors.surface,
    borderRadius:    12,
  },
});
