// ============================================================
// Watch Yourself Design System — Colors & Tokens
// Dark-first. All screens use this palette.
// ============================================================

export const Colors = {
  // Backgrounds
  background:      "#080810",   // near-black, deep cinema
  surface:         "#111118",   // cards, sheets
  surfaceElevated: "#1a1a28",   // modals, drawers

  // Text
  text:            "#f0f0f8",
  textSecondary:   "#8888a8",
  textMuted:       "#44445a",

  // Accent
  accent:          "#7c6af5",
  accentLight:     "#a78bfa",
  accentDim:       "#7c6af518",

  // Mood colours
  moods: {
    feeling_low:    "#6ea8fe",
    need_intensity: "#f87171",
    comfort_watch:  "#86efac",
    mind_blown:     "#c084fc",
    existential:    "#38bdf8",
  },

  // Status
  success:  "#4ade80",
  warning:  "#facc15",
  error:    "#f87171",

  // UI chrome
  border:    "#ffffff12",
  tabBar:    "#08080f",
  separator: "#ffffff0a",

  // Star rating
  starActive:   "#facc15",
  starInactive: "#ffffff18",

  // Glass morphism
  glass:          "rgba(255,255,255,0.05)",
  glassBorder:    "rgba(255,255,255,0.10)",
  glassStrong:    "rgba(255,255,255,0.09)",
} as const;

// Gradient presets (for use with expo-linear-gradient)
export const Gradients = {
  accent:         ["#7c6af5", "#a78bfa"] as const,
  accentDeep:     ["#5b4dd4", "#7c6af5"] as const,
  hero:           ["#080810", "#0e0b1e"] as const,
  posterOverlay:  ["transparent", "rgba(8,8,16,0.7)", "#080810"] as const,
  cardOverlay:    ["transparent", "rgba(8,8,16,0.95)"] as const,
  fadeUp:         ["transparent", "#080810"] as const,
  darkScrim:      ["rgba(0,0,0,0)", "rgba(0,0,0,0.85)"] as const,
} as const;

export type MoodSlug = keyof typeof Colors.moods;
