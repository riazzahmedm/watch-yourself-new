// ============================================================
// MoodChip — selectable mood pill
// Used in: Discover header row, Log sheet
// ============================================================

import { TouchableOpacity, Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import type { Mood } from "@/constants/moods";

interface Props {
  mood:      Mood;
  selected:  boolean;
  onPress:   (slug: string) => void;
  size?:     "small" | "large";
}

export function MoodChip({ mood, selected, onPress, size = "small" }: Props) {
  const handlePress = () => {
    Haptics.selectionAsync();
    onPress(mood.slug);
  };

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        size === "large" && styles.chipLarge,
        selected && { backgroundColor: mood.color + "22", borderColor: mood.color },
        !selected && styles.chipDefault,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Text style={[styles.emoji, size === "large" && styles.emojiLarge]}>
        {mood.emoji}
      </Text>
      <Text
        style={[
          styles.label,
          size === "large" && styles.labelLarge,
          selected && { color: mood.color },
          !selected && { color: Colors.textSecondary },
        ]}
      >
        {mood.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             6,
    borderRadius:    20,
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderWidth:     1,
  },
  chipDefault: {
    backgroundColor: Colors.surface,
    borderColor:     Colors.border,
  },
  chipLarge: {
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderRadius:      16,
    gap:               10,
  },
  emoji: {
    fontSize: 16,
  },
  emojiLarge: {
    fontSize: 28,
  },
  label: {
    fontSize:   13,
    fontWeight: "500",
  },
  labelLarge: {
    fontSize:   16,
    fontWeight: "600",
  },
});
