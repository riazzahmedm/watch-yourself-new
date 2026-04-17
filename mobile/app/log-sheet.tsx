// ============================================================
// Log Sheet — app/log-sheet.tsx
// The most-used screen in the app. Opens as a modal.
// Handles: search → select media → fill details → submit
// Offline-safe: if Supabase fails, entry queued in MMKV.
// ============================================================

import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { MOODS } from "@/constants/moods";
import { MoodChip } from "@/components/MoodChip";
import { StarRating } from "@/components/StarRating";
import { useSearch } from "@/hooks/useSearch";
import { useCreateLog } from "@/hooks/useLogs";
import { supabase, callEdgeFunction } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

type Step = "search" | "form";

export default function LogSheet() {
  const router = useRouter();
  const { user } = useAuthStore();
  const createLog = useCreateLog();

  const [step,       setStep]       = useState<Step>("search");
  const [selectedMedia, setSelectedMedia] = useState<{
    id: string; tmdbId: number; title: string; posterUrl: string | null;
    mediaType: "movie" | "series";
  } | null>(null);

  // Form state
  const [rating,     setRating]     = useState<number | null>(null);
  const [review,     setReview]     = useState("");
  const [moodSlug,   setMoodSlug]   = useState<string | null>(null);
  const [isRewatch,  setIsRewatch]  = useState(false);
  const [isPrivate,  setIsPrivate]  = useState(false);
  const [watchedAt,  setWatchedAt]  = useState(new Date().toISOString().split("T")[0]);

  const { query, setQuery, results, isLoading: searchLoading } = useSearch();

  // ---- Select a media item from search --------------------
  const handleSelectMedia = useCallback(async (item: typeof results[0]) => {
    Haptics.selectionAsync();

    // Ensure full detail is cached in our DB
    try {
      await callEdgeFunction("tmdb-detail", {
        tmdbId:    item.tmdbId,
        mediaType: item.mediaType,
      });
    } catch {
      // Non-fatal — we proceed even if detail fetch fails
    }

    setSelectedMedia({
      id:        item.id,
      tmdbId:    item.tmdbId,
      title:     item.title,
      posterUrl: item.posterUrl,
      mediaType: item.mediaType,
    });
    setStep("form");
  }, []);

  // ---- Submit log -----------------------------------------
  const handleSubmit = useCallback(async () => {
    if (!selectedMedia || !user) return;

    // Find moodTagId from slug
    let moodTagId: string | undefined;
    if (moodSlug) {
      const { data } = await supabase
        .from("mood_tags")
        .select("id")
        .eq("slug", moodSlug)
        .single();
      moodTagId = data?.id;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    createLog.mutate(
      {
        mediaId:   selectedMedia.id,
        logType:   selectedMedia.mediaType === "movie" ? "movie" : "series_full",
        watchedAt,
        rating:    rating ?? undefined,
        review:    review.trim() || undefined,
        moodTagId,
        isRewatch,
        isPrivate,
      },
      {
        onSuccess: () => router.back(),
        onError:   () => {
          // Queue handled inside useLogs — just close and show toast
          Alert.alert(
            "Saved offline",
            "No connection. Your log is saved and will sync when you're back online."
          );
          router.back();
        },
      }
    );
  }, [selectedMedia, user, moodSlug, rating, review, isRewatch, isPrivate, watchedAt, createLog, router]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ---- Header ---------------------------------------- */}
      <View style={styles.header}>
        <View style={styles.handle} />
        <Text style={styles.headerTitle}>
          {step === "search" ? "What did you watch?" : "Log it"}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {step === "search" ? (
        // ---- Step 1: Search --------------------------------
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search movies & series..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchLoading && (
            <ActivityIndicator style={styles.searchSpinner} color={Colors.accent} />
          )}
          <ScrollView keyboardShouldPersistTaps="handled">
            {results.map((item) => (
              <TouchableOpacity
                key={item.tmdbId}
                style={styles.searchResult}
                onPress={() => handleSelectMedia(item)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: item.posterUrl ?? undefined }}
                  style={styles.searchPoster}
                  contentFit="cover"
                />
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.searchResultMeta}>
                    {item.mediaType === "series" ? "📺 Series" : "🎬 Movie"}
                    {item.releaseYear ? ` · ${item.releaseYear}` : ""}
                    {item.tmdbRating > 0 ? ` · ⭐ ${item.tmdbRating.toFixed(1)}` : ""}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        // ---- Step 2: Log form ------------------------------
        <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
          {/* Selected media header */}
          {selectedMedia && (
            <View style={styles.selectedMedia}>
              <Image
                source={{ uri: selectedMedia.posterUrl ?? undefined }}
                style={styles.selectedPoster}
                contentFit="cover"
              />
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedTitle}>{selectedMedia.title}</Text>
                <TouchableOpacity onPress={() => { setStep("search"); setSelectedMedia(null); }}>
                  <Text style={styles.changeBtn}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Rating */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Rating</Text>
            <StarRating value={rating} onChange={setRating} size="large" />
          </View>

          {/* Mood */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Your mood when watching</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.moodRow}>
                {MOODS.map((mood) => (
                  <MoodChip
                    key={mood.slug}
                    mood={mood}
                    selected={moodSlug === mood.slug}
                    onPress={(slug) => setMoodSlug(moodSlug === slug ? null : slug)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Review */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Review (optional)</Text>
            <TextInput
              style={styles.reviewInput}
              placeholder="What did you think?"
              placeholderTextColor={Colors.textMuted}
              value={review}
              onChangeText={setReview}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Toggles */}
          <View style={styles.toggleRow}>
            <Toggle
              label="Rewatch"
              emoji="🔁"
              value={isRewatch}
              onToggle={() => setIsRewatch(!isRewatch)}
            />
            <Toggle
              label="Private"
              emoji="🔒"
              value={isPrivate}
              onToggle={() => setIsPrivate(!isPrivate)}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, createLog.isPending && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={createLog.isPending || !selectedMedia}
            activeOpacity={0.85}
          >
            {createLog.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Log it 🎬</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function Toggle({ label, emoji, value, onToggle }: {
  label: string; emoji: string; value: boolean; onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.toggle, value && styles.toggleActive]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <Text style={styles.toggleEmoji}>{emoji}</Text>
      <Text style={[styles.toggleLabel, value && styles.toggleLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
  },
  header: {
    alignItems:        "center",
    paddingHorizontal: 20,
    paddingTop:        12,
    paddingBottom:     16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  handle: {
    width:           40,
    height:          4,
    backgroundColor: Colors.border,
    borderRadius:    2,
    marginBottom:    16,
  },
  headerTitle: {
    fontSize:   20,
    fontWeight: "700",
    color:      Colors.text,
  },
  closeBtn: {
    position: "absolute",
    right:    20,
    top:      20,
  },
  closeBtnText: {
    color:    Colors.textSecondary,
    fontSize: 18,
  },
  // ---- Search step
  searchContainer: {
    flex:    1,
    padding: 16,
  },
  searchInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius:    12,
    padding:         14,
    color:           Colors.text,
    fontSize:        16,
    borderWidth:     1,
    borderColor:     Colors.border,
    marginBottom:    12,
  },
  searchSpinner: {
    marginVertical: 12,
  },
  searchResult: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchPoster: {
    width:        48,
    height:       72,
    borderRadius: 6,
    backgroundColor: Colors.surfaceElevated,
  },
  searchResultInfo: {
    flex: 1,
    gap:  4,
  },
  searchResultTitle: {
    color:      Colors.text,
    fontSize:   15,
    fontWeight: "600",
  },
  searchResultMeta: {
    color:    Colors.textSecondary,
    fontSize: 12,
  },
  // ---- Form step
  formScroll: {
    flex: 1,
  },
  selectedMedia: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             12,
    padding:         16,
    backgroundColor: Colors.surfaceElevated,
    margin:          16,
    borderRadius:    12,
  },
  selectedPoster: {
    width:        56,
    height:       84,
    borderRadius: 8,
    backgroundColor: Colors.border,
  },
  selectedInfo: {
    flex: 1,
    gap:  6,
  },
  selectedTitle: {
    color:      Colors.text,
    fontSize:   16,
    fontWeight: "700",
  },
  changeBtn: {
    color:    Colors.accent,
    fontSize: 13,
  },
  field: {
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  fieldLabel: {
    color:      Colors.textSecondary,
    fontSize:   12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  moodRow: {
    flexDirection: "row",
    gap:           8,
  },
  reviewInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius:    10,
    padding:         12,
    color:           Colors.text,
    fontSize:        15,
    minHeight:       80,
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  toggleRow: {
    flexDirection:     "row",
    gap:               12,
    paddingHorizontal: 16,
    paddingVertical:   16,
  },
  toggle: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius:    10,
    paddingHorizontal: 14,
    paddingVertical:   10,
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  toggleActive: {
    backgroundColor: Colors.accentDim,
    borderColor:     Colors.accent,
  },
  toggleEmoji: {
    fontSize: 16,
  },
  toggleLabel: {
    color:      Colors.textSecondary,
    fontSize:   14,
    fontWeight: "500",
  },
  toggleLabelActive: {
    color: Colors.accent,
  },
  submitBtn: {
    backgroundColor: Colors.accent,
    margin:          16,
    borderRadius:    14,
    paddingVertical: 16,
    alignItems:      "center",
    marginBottom:    40,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color:      "#fff",
    fontSize:   17,
    fontWeight: "700",
  },
});
