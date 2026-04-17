// ============================================================
// StarRating — interactive 0.5–5 star picker
// Used in: Log sheet, Library list item
// ============================================================

import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";

interface Props {
  value:    number | null;
  onChange: (rating: number | null) => void;
  readonly?: boolean;
  size?:    "small" | "medium" | "large";
}

const SIZES = { small: 20, medium: 28, large: 36 };

export function StarRating({ value, onChange, readonly = false, size = "medium" }: Props) {
  const starSize = SIZES[size];

  const handlePress = (starIndex: number, isHalf: boolean) => {
    if (readonly) return;

    const tapped = isHalf ? starIndex - 0.5 : starIndex;

    // Double-tap same value → clear rating
    if (tapped === value) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(null);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(tapped);
  };

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (value ?? 0) >= star;
        const half   = !filled && (value ?? 0) >= star - 0.5;

        return (
          <View key={star} style={styles.starWrapper}>
            {/* Left half tap zone */}
            {!readonly && (
              <TouchableOpacity
                style={[styles.halfZone, { width: starSize / 2, height: starSize }]}
                onPress={() => handlePress(star, true)}
                activeOpacity={1}
              />
            )}
            {/* Right half tap zone */}
            {!readonly && (
              <TouchableOpacity
                style={[styles.halfZone, { width: starSize / 2, height: starSize }]}
                onPress={() => handlePress(star, false)}
                activeOpacity={1}
              />
            )}
            <Text style={[styles.star, { fontSize: starSize }]}>
              {filled ? "★" : half ? "⯨" : "☆"}
            </Text>
          </View>
        );
      })}
      {value != null && (
        <Text style={styles.valueLabel}>{value.toFixed(1)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           2,
  },
  starWrapper: {
    position: "relative",
  },
  halfZone: {
    position: "absolute",
    top:      0,
    zIndex:   1,
  },
  star: {
    color: Colors.starActive,
  },
  valueLabel: {
    color:      Colors.textSecondary,
    fontSize:   14,
    marginLeft: 6,
    fontWeight: "600",
  },
});
