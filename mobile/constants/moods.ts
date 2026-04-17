// ============================================================
// CineMood — Mood definitions (client-side copy of DB seed data)
// Used for UI rendering without a DB round-trip.
// ============================================================

export interface Mood {
  slug:        string;
  label:       string;
  emoji:       string;
  description: string;
  color:       string;
}

export const MOODS: Mood[] = [
  {
    slug:        "feeling_low",
    label:       "Feeling Low",
    emoji:       "😔",
    description: "Need something gentle, warm, or quietly moving",
    color:       "#6ea8fe",
  },
  {
    slug:        "need_intensity",
    label:       "Need Intensity",
    emoji:       "😤",
    description: "High energy, adrenaline, edge of your seat",
    color:       "#f87171",
  },
  {
    slug:        "comfort_watch",
    label:       "Comfort Watch",
    emoji:       "😌",
    description: "Something safe, familiar, and easy to enjoy",
    color:       "#86efac",
  },
  {
    slug:        "mind_blown",
    label:       "Mind Blown",
    emoji:       "🤯",
    description: "Complex, twisty, mind-bending stories",
    color:       "#c084fc",
  },
  {
    slug:        "existential",
    label:       "Existential",
    emoji:       "🌌",
    description: "Deep, philosophical, makes you question everything",
    color:       "#38bdf8",
  },
];

export const getMood = (slug: string): Mood | undefined =>
  MOODS.find((m) => m.slug === slug);
