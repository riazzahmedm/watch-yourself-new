// ============================================================
// Timeline Tab — monthly/yearly emotional watch history
// ============================================================

import { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { Colors } from "@/constants/colors";
import { getMood } from "@/constants/moods";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function TimelineScreen() {
  const { user }      = useAuthStore();
  const queryClient   = useQueryClient();
  const currentYear   = new Date().getFullYear();
  const [activeYear, setActiveYear] = useState(currentYear);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [noteText, setNoteText]  = useState("");

  // Fetch timeline periods for active year
  const { data: periods, isLoading } = useQuery({
    queryKey: ["timeline", user?.id, activeYear],
    queryFn:  async () => {
      const { data, error } = await supabase
        .from("timeline_periods")
        .select("*, mood_tag:dominant_mood_id(slug, emoji, label)")
        .eq("user_id", user!.id)
        .eq("period_year", activeYear)
        .eq("period_type", "month")
        .order("period_month", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Save life context note
  const saveNote = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase
        .from("timeline_periods")
        .update({ life_context_note: note })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline", user?.id, activeYear] });
      setEditingPeriodId(null);
    },
  });

  const yearStats = periods
    ? {
        totalWatched: periods.reduce((s, p) => s + p.watch_count, 0),
        totalHours:   periods.reduce((s, p) => s + p.total_hours, 0),
        topMood: getMostFrequent(periods.map((p) => (p.mood_tag as { emoji: string; label: string } | null)?.label).filter(Boolean) as string[]),
      }
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Timeline</Text>

        {/* Year selector */}
        <View style={styles.yearRow}>
          <TouchableOpacity onPress={() => setActiveYear(activeYear - 1)}>
            <Text style={styles.yearArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.yearLabel}>{activeYear}</Text>
          <TouchableOpacity
            onPress={() => setActiveYear(activeYear + 1)}
            disabled={activeYear >= currentYear}
          >
            <Text style={[styles.yearArrow, activeYear >= currentYear && styles.yearArrowDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Year summary bar */}
      {yearStats && yearStats.totalWatched > 0 && (
        <View style={styles.yearSummary}>
          <StatChip label="Watched" value={String(yearStats.totalWatched)} emoji="🎬" />
          <StatChip label="Hours"   value={String(yearStats.totalHours)}   emoji="⏱" />
          {yearStats.topMood && (
            <StatChip label="Top Mood" value={yearStats.topMood} emoji="💭" />
          )}
        </View>
      )}

      {/* Month cards */}
      {isLoading ? (
        <View style={styles.loadingRow}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : periods && periods.length > 0 ? (
        periods.map((period) => {
          const mood   = period.mood_tag as { slug: string; emoji: string; label: string } | null;
          const isEdit = editingPeriodId === period.id;

          return (
            <View key={period.id} style={styles.monthCard}>
              {/* Month header */}
              <View style={styles.monthHeader}>
                <View style={styles.monthLeft}>
                  <Text style={styles.monthName}>
                    {MONTHS[(period.period_month ?? 1) - 1]}
                  </Text>
                  {mood && (
                    <View style={styles.moodBadge}>
                      <Text style={styles.moodBadgeEmoji}>{mood.emoji}</Text>
                      <Text style={styles.moodBadgeLabel}>{mood.label}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.monthStats}>
                  <Text style={styles.monthStatText}>🎬 {period.watch_count}</Text>
                  <Text style={styles.monthStatText}>⏱ {period.total_hours}h</Text>
                </View>
              </View>

              {/* Phase label */}
              {period.phase_label && (
                <View style={styles.phaseLabel}>
                  <Text style={styles.phaseLabelText}>✦ {period.phase_label}</Text>
                </View>
              )}

              {/* Life context note */}
              {isEdit ? (
                <View style={styles.noteEdit}>
                  <TextInput
                    style={styles.noteInput}
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder="What was happening in your life during this time?"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    autoFocus
                  />
                  <View style={styles.noteButtons}>
                    <TouchableOpacity onPress={() => setEditingPeriodId(null)}>
                      <Text style={styles.noteCancelBtn}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => saveNote.mutate({ id: period.id, note: noteText })}
                      style={styles.noteSaveBtn}
                    >
                      <Text style={styles.noteSaveBtnText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.noteTouchable}
                  onPress={() => {
                    setEditingPeriodId(period.id);
                    setNoteText(period.life_context_note ?? "");
                  }}
                >
                  <Text style={period.life_context_note ? styles.noteText : styles.notePlaceholder}>
                    {period.life_context_note || "✎ What was happening in your life?"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>No timeline yet</Text>
          <Text style={styles.emptySubtitle}>
            Log at least 5 movies this month to generate your first summary
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function StatChip({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getMostFrequent(arr: string[]): string | null {
  if (!arr.length) return null;
  const counts = arr.reduce<Record<string, number>>((acc, val) => {
    acc[val] = (acc[val] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.background },
  content:            { paddingBottom: 100 },
  header:             { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  headerTitle:        { fontSize: 32, fontWeight: "800", color: Colors.text, marginBottom: 16 },
  yearRow:            { flexDirection: "row", alignItems: "center", gap: 20 },
  yearArrow:          { color: Colors.accent, fontSize: 28, fontWeight: "300" },
  yearArrowDisabled:  { opacity: 0.3 },
  yearLabel:          { color: Colors.text, fontSize: 22, fontWeight: "700" },
  yearSummary:        { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  statChip:           { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, alignItems: "center", gap: 4, borderWidth: 1, borderColor: Colors.border },
  statEmoji:          { fontSize: 20 },
  statValue:          { color: Colors.text, fontSize: 18, fontWeight: "700" },
  statLabel:          { color: Colors.textSecondary, fontSize: 11 },
  loadingRow:         { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 20 },
  skeletonCard:       { width: "47%", height: 140, backgroundColor: Colors.surface, borderRadius: 16 },
  monthCard:          { marginHorizontal: 20, marginBottom: 12, backgroundColor: Colors.surface, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  monthHeader:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  monthLeft:          { gap: 6 },
  monthName:          { color: Colors.text, fontSize: 20, fontWeight: "700" },
  moodBadge:          { flexDirection: "row", alignItems: "center", gap: 4 },
  moodBadgeEmoji:     { fontSize: 14 },
  moodBadgeLabel:     { color: Colors.textSecondary, fontSize: 12 },
  monthStats:         { gap: 4, alignItems: "flex-end" },
  monthStatText:      { color: Colors.textSecondary, fontSize: 13 },
  phaseLabel:         { marginHorizontal: 16, marginBottom: 10, backgroundColor: Colors.accentDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  phaseLabelText:     { color: Colors.accent, fontSize: 12, fontWeight: "600" },
  noteTouchable:      { paddingHorizontal: 16, paddingBottom: 16 },
  noteText:           { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  notePlaceholder:    { color: Colors.textMuted, fontSize: 13, fontStyle: "italic" },
  noteEdit:           { padding: 16, gap: 10 },
  noteInput:          { backgroundColor: Colors.surfaceElevated, borderRadius: 10, padding: 12, color: Colors.text, fontSize: 14, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: Colors.border },
  noteButtons:        { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  noteCancelBtn:      { color: Colors.textSecondary, fontSize: 14, paddingVertical: 8 },
  noteSaveBtn:        { backgroundColor: Colors.accent, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  noteSaveBtnText:    { color: "#fff", fontSize: 14, fontWeight: "600" },
  empty:              { alignItems: "center", paddingTop: 80, gap: 10, paddingHorizontal: 40 },
  emptyEmoji:         { fontSize: 48 },
  emptyTitle:         { color: Colors.text, fontSize: 18, fontWeight: "700" },
  emptySubtitle:      { color: Colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 22 },
});
