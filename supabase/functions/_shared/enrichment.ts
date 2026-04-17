// ============================================================
// Watch Yourself — Media Enrichment Logic
// Shared by: enrich-media, import-catalog
//
// Converts raw TMDB data (genres + keywords) into:
//   1. mood_scores   → {moodSlug: 0.0–1.0}
//   2. mood_tag_slugs → string[] of qualifying moods
//   3. watch_yourself_score → single quality float
//
// This is the proprietary layer that makes Watch Yourself different
// from a plain TMDB wrapper. Over time, user behavior signals
// (mood_match_rates, avg_user_rating) will layer on top.
// ============================================================

// ---- Mood Rule Definitions ----------------------------------
//
// Each mood has:
//   genreWeights   — TMDB genre ID → contribution score (0–1)
//   keywordBoosts  — keyword substring → boost amount
//   keywordPenalties — keyword that reduces this mood's score
//   threshold      — minimum score to qualify for this mood
//
// Final mood score = sum(genre weights) + sum(keyword boosts)
//                    - sum(penalties), clamped 0–1

interface MoodRule {
  slug: string;
  genreWeights: Record<number, number>;
  keywordBoosts: { term: string; boost: number }[];
  keywordPenalties: { term: string; penalty: number }[];
  threshold: number; // minimum score to qualify
}

export const MOOD_RULES: MoodRule[] = [
  // ---- 😔 Feeling Low ----------------------------------------
  {
    slug: "feeling_low",
    genreWeights: {
      18:    0.50,  // Drama         ← core
      10749: 0.40,  // Romance
      16:    0.20,  // Animation     ← Studio Ghibli etc.
      10751: 0.15,  // Family
      36:    0.15,  // History
      99:    0.10,  // Documentary
    },
    keywordBoosts: [
      { term: "grief",           boost: 0.20 },
      { term: "loss",            boost: 0.18 },
      { term: "healing",         boost: 0.18 },
      { term: "redemption",      boost: 0.15 },
      { term: "heartbreak",      boost: 0.15 },
      { term: "loneliness",      boost: 0.15 },
      { term: "hope",            boost: 0.12 },
      { term: "friendship",      boost: 0.10 },
      { term: "coming of age",   boost: 0.10 },
      { term: "family drama",    boost: 0.10 },
    ],
    keywordPenalties: [
      { term: "action",    penalty: 0.15 },
      { term: "gore",      penalty: 0.30 },
      { term: "slasher",   penalty: 0.35 },
    ],
    threshold: 0.30,
  },

  // ---- 😤 Need Intensity -------------------------------------
  {
    slug: "need_intensity",
    genreWeights: {
      28:  0.55,  // Action        ← core
      53:  0.55,  // Thriller      ← core
      80:  0.40,  // Crime
      12:  0.25,  // Adventure
      878: 0.15,  // Sci-Fi        (space battles, etc.)
      10752: 0.20, // War
    },
    keywordBoosts: [
      { term: "heist",      boost: 0.20 },
      { term: "assassin",   boost: 0.18 },
      { term: "survival",   boost: 0.18 },
      { term: "revenge",    boost: 0.15 },
      { term: "chase",      boost: 0.15 },
      { term: "combat",     boost: 0.15 },
      { term: "adrenaline", boost: 0.12 },
      { term: "shoot",      boost: 0.10 },
      { term: "explosion",  boost: 0.10 },
      { term: "fight",      boost: 0.10 },
    ],
    keywordPenalties: [
      { term: "romantic comedy", penalty: 0.20 },
      { term: "feel-good",       penalty: 0.15 },
      { term: "cozy",            penalty: 0.15 },
    ],
    threshold: 0.30,
  },

  // ---- 😌 Comfort Watch ---------------------------------------
  {
    slug: "comfort_watch",
    genreWeights: {
      35:    0.55,  // Comedy        ← core
      10749: 0.40,  // Romance       ← core
      16:    0.35,  // Animation
      10751: 0.35,  // Family
      12:    0.20,  // Adventure     (light adventure)
    },
    keywordBoosts: [
      { term: "feel-good",    boost: 0.25 },
      { term: "heartwarming", boost: 0.25 },
      { term: "cozy",         boost: 0.22 },
      { term: "wholesome",    boost: 0.22 },
      { term: "road trip",    boost: 0.15 },
      { term: "holiday",      boost: 0.15 },
      { term: "friendship",   boost: 0.12 },
      { term: "romantic",     boost: 0.12 },
      { term: "lighthearted", boost: 0.12 },
      { term: "warm",         boost: 0.10 },
    ],
    keywordPenalties: [
      { term: "horror",     penalty: 0.30 },
      { term: "gore",       penalty: 0.35 },
      { term: "disturbing", penalty: 0.30 },
      { term: "dark",       penalty: 0.10 },
    ],
    threshold: 0.30,
  },

  // ---- 🤯 Mind Blown -----------------------------------------
  {
    slug: "mind_blown",
    genreWeights: {
      878:  0.55,  // Sci-Fi        ← core
      9648: 0.55,  // Mystery       ← core
      53:   0.40,  // Thriller
      14:   0.20,  // Fantasy
      18:   0.15,  // Drama
    },
    keywordBoosts: [
      { term: "twist",               boost: 0.30 },
      { term: "plot twist",          boost: 0.30 },
      { term: "mind-bending",        boost: 0.28 },
      { term: "mindbending",         boost: 0.28 },
      { term: "nonlinear",           boost: 0.25 },
      { term: "unreliable narrator", boost: 0.25 },
      { term: "psychological",       boost: 0.20 },
      { term: "cerebral",            boost: 0.20 },
      { term: "time travel",         boost: 0.18 },
      { term: "alternate reality",   boost: 0.18 },
      { term: "dystopia",            boost: 0.15 },
      { term: "conspiracy",          boost: 0.12 },
    ],
    keywordPenalties: [
      { term: "romantic comedy", penalty: 0.20 },
      { term: "feel-good",       penalty: 0.20 },
      { term: "family",          penalty: 0.10 },
    ],
    threshold: 0.35,
  },

  // ---- 🌌 Existential ----------------------------------------
  {
    slug: "existential",
    genreWeights: {
      18:  0.50,  // Drama         ← core
      878: 0.45,  // Sci-Fi        ← core
      99:  0.40,  // Documentary
      14:  0.25,  // Fantasy
      36:  0.25,  // History
    },
    keywordBoosts: [
      { term: "existential",         boost: 0.35 },
      { term: "existentialism",      boost: 0.35 },
      { term: "philosophical",       boost: 0.30 },
      { term: "meaning of life",     boost: 0.30 },
      { term: "consciousness",       boost: 0.25 },
      { term: "isolation",           boost: 0.22 },
      { term: "identity",            boost: 0.20 },
      { term: "contemplative",       boost: 0.20 },
      { term: "slow burn",           boost: 0.15 },
      { term: "introspective",       boost: 0.15 },
      { term: "mortality",           boost: 0.15 },
      { term: "spirituality",        boost: 0.12 },
    ],
    keywordPenalties: [
      { term: "action",          penalty: 0.20 },
      { term: "comedy",          penalty: 0.15 },
      { term: "romantic comedy", penalty: 0.20 },
    ],
    threshold: 0.30,
  },
];

// ---- Types --------------------------------------------------

export interface MediaInput {
  tmdb_genre_ids:  number[];
  tmdb_keywords:   string[];    // keyword name strings from TMDB
  tmdb_rating:     number | null;
  tmdb_vote_count: number;
}

export interface EnrichmentResult {
  mood_scores:     Record<string, number>;  // {slug: 0.0–1.0}
  mood_tag_slugs:  string[];
  watch_yourself_score:  number;
}

// ---- Core enrichment function ------------------------------

/**
 * Scores a media item against every mood rule and computes
 * the Watch Yourself quality score. Pure function — no DB calls.
 */
export function enrichMedia(media: MediaInput): EnrichmentResult {
  const moodScores: Record<string, number> = {};
  const qualifyingSlugs: string[] = [];

  const kwLower = media.tmdb_keywords.map((k) => k.toLowerCase());

  for (const rule of MOOD_RULES) {
    let score = 0;

    // --- Genre contributions ---
    for (const gId of media.tmdb_genre_ids) {
      score += rule.genreWeights[gId] ?? 0;
    }

    // --- Keyword boosts ---
    for (const { term, boost } of rule.keywordBoosts) {
      if (kwLower.some((k) => k.includes(term))) {
        score += boost;
      }
    }

    // --- Keyword penalties ---
    for (const { term, penalty } of rule.keywordPenalties) {
      if (kwLower.some((k) => k.includes(term))) {
        score -= penalty;
      }
    }

    // Clamp 0–1, round to 2dp
    const finalScore = Math.round(Math.min(Math.max(score, 0), 1) * 100) / 100;
    moodScores[rule.slug] = finalScore;

    if (finalScore >= rule.threshold) {
      qualifyingSlugs.push(rule.slug);
    }
  }

  const cineMoodScore = computeWatchYourselfScore(
    media.tmdb_rating,
    media.tmdb_vote_count,
    media.tmdb_keywords.length
  );

  return {
    mood_scores:    moodScores,
    mood_tag_slugs: qualifyingSlugs,
    watch_yourself_score: cineMoodScore,
  };
}

/**
 * Blends TMDB signals into a single quality score (0–1).
 * Mirrors the SQL compute_watch_yourself_score() function exactly
 * so results are consistent whether computed in TypeScript or SQL.
 *
 * Weights:
 *   55% — normalised TMDB rating  (quality signal)
 *   35% — log-scaled vote count   (credibility signal)
 *   10% — keyword count           (metadata richness)
 */
export function computeWatchYourselfScore(
  rating:       number | null,
  voteCount:    number,
  keywordCount: number
): number {
  const ratingNorm   = (rating ?? 0) / 10;
  const voteNorm     = Math.min(Math.log(Math.max(voteCount, 1)) / Math.log(100_000), 1.0);
  const keywordNorm  = Math.min(keywordCount / 20, 1.0);

  const score = ratingNorm * 0.55 + voteNorm * 0.35 + keywordNorm * 0.10;
  return Math.round(score * 1000) / 1000; // 3dp
}

/**
 * After collecting MoodFeedback rows, compute per-mood match rates
 * for a media item. Returns {moodSlug: matchRate 0–1}.
 *
 * matchRate = (yes + 0.5 * somewhat) / total
 */
export function computeMoodMatchRates(
  feedbackRows: { mood_tag_slug: string; match_response: "yes" | "no" | "somewhat" }[]
): Record<string, number> {
  const totals: Record<string, { yes: number; somewhat: number; total: number }> = {};

  for (const row of feedbackRows) {
    const slug = row.mood_tag_slug;
    if (!totals[slug]) totals[slug] = { yes: 0, somewhat: 0, total: 0 };
    totals[slug].total++;
    if (row.match_response === "yes")      totals[slug].yes++;
    if (row.match_response === "somewhat") totals[slug].somewhat++;
  }

  const rates: Record<string, number> = {};
  for (const [slug, counts] of Object.entries(totals)) {
    rates[slug] = Math.round(
      ((counts.yes + 0.5 * counts.somewhat) / counts.total) * 100
    ) / 100;
  }
  return rates;
}
