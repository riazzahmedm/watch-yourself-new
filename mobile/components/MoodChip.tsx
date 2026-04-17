// ============================================================
// MoodChip — selectable mood pill with glow when selected
// ============================================================

import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import type { Mood } from "@/constants/moods";

interface Props {
  mood:     Mood;
  selected: boolean;
  onPress:  (slug: string) => void;
  size?:    "small" | "large";
}

export function MoodChip({ mood, selected, onPress, size = "small" }: Props) {
  const handlePress = () => {
    Haptics.selectionAsync();
    onPress(mood.slug);
  };

  const isLarge = size === "large";

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        isLarge && styles.chipLarge,
        selected
          ? {
              backgroundColor: mood.color + "20",
              borderColor:     mood.color + "90",
              shadowColor:     mood.color,
              shadowOpacity:   0.35,
              shadowRadius:    10,
              shadowOffset:    { width: 0, height: 0 },
              elevation:       6,
            }
          : styles.chipDefault,
      ]}
    >
      <Text style={[styles.emoji, isLarge && styles.emojiLarge]}>
        {mood.emoji}
      </Text>
      <Text
        style={[
          styles.label,
          isLarge && styles.labelLarge,
          { color: selected ? mood.color : Colors.textSecondary },
        ]}
      >
        {mood.label}
      </Text>

      {/* Active indicator dot */}
      {selected && (
        <View
          style={[styles.activeDot, { backgroundColor: mood.color }]}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               6,
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderWidth:       1,
  },
  chipDefault: {
    backgroundColor: Colors.glass,
    borderColor:     Colors.border,
  },
  chipLarge: {
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderRadius:      16,
    gap:               10,
  },
  emoji: {
    fontSize: 15,
  },
  emojiLarge: {
    fontSize: 26,
  },
  label: {
    fontSize:   13,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  labelLarge: {
    fontSize:   16,
    fontWeight: "700",
  },
  activeDot: {
    width:        5,
    height:       5,
    borderRadius: 2.5,
    marginLeft:   2,
  },
});
