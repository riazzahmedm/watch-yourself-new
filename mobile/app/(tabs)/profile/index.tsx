// ============================================================
// Profile Tab — Taste DNA card + stats + settings
// ============================================================

import { useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Share,
} from "react-native";
import { Image } from "expo-image";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { useTasteDna, useComputeTasteDna } from "@/hooks/useTasteDna";
import { useLogs } from "@/hooks/useLogs";
import { useAuthStore } from "@/stores/auth";

const PACE_LABELS: Record<string, string> = {
  slow:   "Slow Burn 🐢",
  medium: "Balanced ⚖️",
  fast:   "Fast-Paced ⚡",
  mixed:  "Mixed 🎲",
};

export default function ProfileScreen() {
  const { user, signOut }  = useAuthStore();
  const { data: dna }       = useTasteDna();
  const { data: logs }      = useLogs(200);
  const computeDna          = useComputeTasteDna();
  const cardRef             = useRef<ViewShot>(null);

  const totalLogged  = dna?.total_logged ?? 0;
  const isDisplayable = totalLogged >= 10;
  const logsNeeded   = Math.max(10 - totalLogged, 0);

  // ---- Share Taste DNA card --------------------------------
  const handleShare = async () => {
    if (!cardRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await (cardRef.current as ViewShot).capture?.();
      if (!uri) return;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png" });
      } else {
        await Share.share({ url: uri });
      }
    } catch {
      Alert.alert("Could not share", "Please try again.");
    }
  };

  // ---- Recompute DNA --------------------------------------
  const handleRecompute = () => {
    computeDna.mutate(undefined, {
      onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    });
  };

  const genreAffinities = (dna?.genre_affinities as Record<string, number> | null) ?? {};
  const topGenres       = (dna?.twin_cache as unknown as { sharedGenres: string[] }[] | null);
  const twins           = (dna?.twin_cache as {
    userId: string; username: string; avatarUrl: string | null; matchScore: number;
  }[] | null) ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.email?.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
          <View>
            <Text style={styles.username}>{user?.email?.split("@")[0] ?? "You"}</Text>
            <Text style={styles.userSub}>{totalLogged} logged</Text>
          </View>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* ---- Taste DNA card --------------------------------- */}
      {isDisplayable ? (
        <>
          <ViewShot ref={cardRef} options={{ format: "png", quality: 1 }}>
            <View style={styles.dnaCard}>
              <Text style={styles.dnaTitle}>🧬 Your Taste DNA</Text>

              {/* Genre affinities */}
              <View style={styles.genreList}>
                {Object.entries(genreAffinities)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([genreId, score]) => (
                    <GenreBar key={genreId} genreId={genreId} score={score} />
                  ))}
              </View>

              {/* Signals row */}
              <View style={styles.signalRow}>
                {dna?.pace_tolerance && (
                  <SignalChip label={PACE_LABELS[dna.pace_tolerance as string]} />
                )}
                {(dna?.twist_dependency as number) > 0.6 && (
                  <SignalChip label="Twist Lover 🤯" />
                )}
                {dna?.comfort_rewatcher && (
                  <SignalChip label="Comfort Rewatcher 😌" />
                )}
                {(dna?.binge_vs_casual as number) > 0.5 && (
                  <SignalChip label="Binge Watcher 🍿" />
                )}
              </View>

              {/* Stats footer */}
              <View style={styles.dnaFooter}>
                <Text style={styles.dnaFooterText}>
                  Based on {totalLogged} logs · Watch Yourself
                </Text>
              </View>
            </View>
          </ViewShot>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Text style={styles.shareBtnText}>Share my Taste DNA 🧬</Text>
          </TouchableOpacity>
        </>
      ) : (
        // ---- Not enough logs yet ----------------------------
        <View style={styles.dnaLocked}>
          <Text style={styles.dnaLockedEmoji}>🔒</Text>
          <Text style={styles.dnaLockedTitle}>Taste DNA unlocks soon</Text>
          <Text style={styles.dnaLockedSub}>
            Log {logsNeeded} more movie{logsNeeded !== 1 ? "s" : ""} to unlock your profile
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${(totalLogged / 10) * 100}%` }]}
            />
          </View>
          <Text style={styles.progressLabel}>{totalLogged} / 10</Text>
        </View>
      )}

      {/* ---- Movie Twins ------------------------------------ */}
      {twins.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎭 Your Movie Twins</Text>
          {twins.map((twin) => (
            <View key={twin.userId} style={styles.twinRow}>
              <View style={styles.twinAvatar}>
                <Text style={styles.twinAvatarText}>
                  {twin.username.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.twinInfo}>
                <Text style={styles.twinUsername}>{twin.username}</Text>
              </View>
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>{twin.matchScore}% match</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ---- Recompute button ------------------------------- */}
      {totalLogged >= 10 && (
        <TouchableOpacity
          style={styles.recomputeBtn}
          onPress={handleRecompute}
          disabled={computeDna.isPending}
        >
          <Text style={styles.recomputeText}>
            {computeDna.isPending ? "Updating…" : "↺ Refresh DNA"}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function GenreBar({ genreId, score }: { genreId: string; score: number }) {
  // In production: resolve genre name from a local TMDB genre map
  const GENRE_NAMES: Record<string, string> = {
    "28": "Action", "12": "Adventure", "16": "Animation", "35": "Comedy",
    "80": "Crime", "99": "Documentary", "18": "Drama", "10751": "Family",
    "14": "Fantasy", "27": "Horror", "9648": "Mystery", "10749": "Romance",
    "878": "Sci-Fi", "53": "Thriller", "10752": "War", "37": "Western",
  };
  const name = GENRE_NAMES[genreId] ?? `Genre ${genreId}`;
  return (
    <View style={genreBarStyles.row}>
      <Text style={genreBarStyles.label}>{name}</Text>
      <View style={genreBarStyles.track}>
        <View style={[genreBarStyles.fill, { width: `${score * 100}%` }]} />
      </View>
      <Text style={genreBarStyles.score}>{Math.round(score * 100)}%</Text>
    </View>
  );
}

const genreBarStyles = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  label: { color: Colors.text, fontSize: 13, width: 90 },
  track: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden" },
  fill:  { height: "100%", backgroundColor: Colors.accent, borderRadius: 3 },
  score: { color: Colors.textSecondary, fontSize: 12, width: 32, textAlign: "right" },
});

function SignalChip({ label }: { label: string }) {
  return (
    <View style={styles.signalChip}>
      <Text style={styles.signalChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.background },
  content:          { paddingBottom: 100 },
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  userRow:          { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar:           { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText:       { color: "#fff", fontSize: 20, fontWeight: "700" },
  username:         { color: Colors.text, fontSize: 16, fontWeight: "700" },
  userSub:          { color: Colors.textSecondary, fontSize: 12 },
  signOutBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  signOutText:      { color: Colors.textSecondary, fontSize: 13 },
  dnaCard:          { margin: 20, backgroundColor: Colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.border },
  dnaTitle:         { color: Colors.text, fontSize: 20, fontWeight: "800", marginBottom: 16 },
  genreList:        { gap: 4, marginBottom: 16 },
  signalRow:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  signalChip:       { backgroundColor: Colors.accentDim, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.accent },
  signalChipText:   { color: Colors.accent, fontSize: 12, fontWeight: "500" },
  dnaFooter:        { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  dnaFooterText:    { color: Colors.textMuted, fontSize: 11, textAlign: "center" },
  shareBtn:         { marginHorizontal: 20, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  shareBtnText:     { color: "#fff", fontSize: 16, fontWeight: "700" },
  dnaLocked:        { margin: 20, backgroundColor: Colors.surface, borderRadius: 20, padding: 24, alignItems: "center", gap: 10, borderWidth: 1, borderColor: Colors.border },
  dnaLockedEmoji:   { fontSize: 40 },
  dnaLockedTitle:   { color: Colors.text, fontSize: 18, fontWeight: "700" },
  dnaLockedSub:     { color: Colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 22 },
  progressBar:      { width: "100%", height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden", marginTop: 8 },
  progressFill:     { height: "100%", backgroundColor: Colors.accent, borderRadius: 3 },
  progressLabel:    { color: Colors.textMuted, fontSize: 12 },
  section:          { marginHorizontal: 20, marginTop: 24 },
  sectionTitle:     { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  twinRow:          { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  twinAvatar:       { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  twinAvatarText:   { color: Colors.accent, fontSize: 16, fontWeight: "700" },
  twinInfo:         { flex: 1 },
  twinUsername:     { color: Colors.text, fontSize: 15, fontWeight: "600" },
  matchBadge:       { backgroundColor: Colors.accentDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.accent },
  matchBadgeText:   { color: Colors.accent, fontSize: 12, fontWeight: "600" },
  recomputeBtn:     { margin: 20, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingVertical: 12, alignItems: "center" },
  recomputeText:    { color: Colors.textSecondary, fontSize: 14, fontWeight: "500" },
});
