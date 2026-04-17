// ============================================================
// Library Tab — watch history with swipe actions
// ============================================================

import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";

import { Colors } from "@/constants/colors";
import { useLogs, useDeleteLog } from "@/hooks/useLogs";
import { StarRating } from "@/components/StarRating";

export default function LibraryScreen() {
  const router    = useRouter();
  const { data: logs, isLoading, refetch, isFetching } = useLogs(100);
  const deleteLog = useDeleteLog();
  const [filter, setFilter] = useState<"all" | "movies" | "series">("all");

  const filtered = (logs ?? []).filter((log) => {
    if (filter === "movies")  return log.media.mediaType === "movie";
    if (filter === "series")  return log.media.mediaType === "series";
    return true;
  });

  const handleDelete = (logId: string, title: string) => {
    Alert.alert("Remove log", `Remove "${title}" from your library?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => deleteLog.mutate(logId),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        <Text style={styles.headerCount}>
          {logs?.length ?? 0} watched
        </Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["all", "movies", "series"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === "all" ? "All" : f === "movies" ? "Movies" : "Series"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlashList
        data={filtered}
        estimatedItemSize={88}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={Colors.accent}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.logRow}
            onPress={() => router.push(`/library/${item.id}` as never)}
            onLongPress={() => handleDelete(item.id, item.media.title)}
            activeOpacity={0.8}
          >
            <Image
              source={{
                uri: item.media.posterPath
                  ? `https://image.tmdb.org/t/p/w185${item.media.posterPath}`
                  : undefined,
              }}
              style={styles.poster}
              contentFit="cover"
            />
            <View style={styles.logInfo}>
              <Text style={styles.logTitle} numberOfLines={1}>
                {item.media.title}
              </Text>
              <View style={styles.logMeta}>
                <Text style={styles.logDate}>{formatDate(item.watchedAt)}</Text>
                {item.moodTag && (
                  <Text style={styles.logMood}>{item.moodTag.emoji}</Text>
                )}
                {item.isRewatch && (
                  <Text style={styles.rewatchBadge}>🔁 Rewatch</Text>
                )}
              </View>
              {item.rating != null && (
                <StarRating value={item.rating} onChange={() => {}} readonly size="small" />
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎬</Text>
              <Text style={styles.emptyTitle}>Nothing logged yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the + button to log your first movie
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.background },
  header:           { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerTitle:      { fontSize: 32, fontWeight: "800", color: Colors.text },
  headerCount:      { fontSize: 14, color: Colors.textSecondary, paddingBottom: 4 },
  filterRow:        { flexDirection: "row", paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  filterBtn:        { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive:  { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  filterText:       { color: Colors.textSecondary, fontSize: 13, fontWeight: "500" },
  filterTextActive: { color: Colors.accent },
  logRow:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  poster:           { width: 48, height: 72, borderRadius: 6, backgroundColor: Colors.surface },
  logInfo:          { flex: 1, gap: 4 },
  logTitle:         { color: Colors.text, fontSize: 15, fontWeight: "600" },
  logMeta:          { flexDirection: "row", alignItems: "center", gap: 8 },
  logDate:          { color: Colors.textSecondary, fontSize: 12 },
  logMood:          { fontSize: 14 },
  rewatchBadge:     { color: Colors.textMuted, fontSize: 11 },
  chevron:          { color: Colors.textMuted, fontSize: 22 },
  empty:            { alignItems: "center", paddingTop: 100, gap: 8 },
  emptyEmoji:       { fontSize: 48 },
  emptyTitle:       { color: Colors.text, fontSize: 18, fontWeight: "700" },
  emptySubtitle:    { color: Colors.textSecondary, fontSize: 14, textAlign: "center" },
});
