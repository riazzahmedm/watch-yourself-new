// ============================================================
// Watch Yourself Design System — Colors
// Dark-first. All screens use this palette.
// ============================================================

export const Colors = {
  // Backgrounds
  background:      "#0a0a0f",   // near-black, deep cinema
  surface:         "#141420",   // cards, sheets
  surfaceElevated: "#1e1e2e",   // modals, drawers

  // Text
  text:            "#f4f4f8",   // primary
  textSecondary:   "#9898b0",   // captions, subtitles
  textMuted:       "#5a5a72",   // placeholders, legal

  // Accent
  accent:          "#7c6af5",   // purple — mood / DNA brand colour
  accentDim:       "#7c6af520", // accent at 12% opacity (chips background)

  // Mood colours (each mood has its own tint)
  moods: {
    feeling_low:    "#6ea8fe",   // soft blue
    need_intensity: "#f87171",   // red
    comfort_watch:  "#86efac",   // mint green
    mind_blown:     "#c084fc",   // violet
    existential:    "#38bdf8",   // sky blue
  },

  // Status
  success:  "#4ade80",
  warning:  "#facc15",
  error:    "#f87171",

  // UI chrome
  border:    "#2a2a3a",
  tabBar:    "#10101c",
  separator: "#1e1e2e",

  // Star rating
  starActive:   "#facc15",
  starInactive: "#2a2a3a",
} as const;

export type MoodSlug = keyof typeof Colors.moods;
