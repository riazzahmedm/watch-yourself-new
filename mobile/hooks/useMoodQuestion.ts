// ============================================================
// useMoodQuestion — returns a random evocative pre-watch question
//
// Questions are defined locally (offline-safe). The local set
// mirrors the seed data in 20260506000004_seed_mood_questions.sql.
// ============================================================

export interface MoodQuestionOption {
  label:       string;
  emoji:       string;
  emotionSlug: string;
}

export interface MoodQuestion {
  id:           string;   // stable local ID
  questionText: string;
  options:      MoodQuestionOption[];
}

// ---- Local question bank (mirrors DB seed) ------------------

const QUESTIONS: MoodQuestion[] = [
  {
    id: "q1",
    questionText: "If your inner world were weather right now, it’d be…",
    options: [
      { label: "Foggy",    emoji: "🌫️", emotionSlug: "numb"        },
      { label: "Drizzly",  emoji: "🌧️", emotionSlug: "melancholic" },
      { label: "Overcast", emoji: "☁️",       emotionSlug: "tired"       },
      { label: "Breezy",   emoji: "🌬️", emotionSlug: "content"     },
      { label: "Stormy",   emoji: "⛈️",       emotionSlug: "anxious"     },
      { label: "Sunny",    emoji: "☀️",       emotionSlug: "happy"       },
    ],
  },
  {
    id: "q2",
    questionText: "Right now you feel most like…",
    options: [
      { label: "A drained phone",  emoji: "\uD83EUDE2B", emotionSlug: "drained"    },
      { label: "A slow Sunday",    emoji: "🐢", emotionSlug: "peaceful"  },
      { label: "A spinning top",   emoji: "🌀", emotionSlug: "restless"  },
      { label: "A quiet flame",    emoji: "🕯️", emotionSlug: "hopeful" },
      { label: "A live wire",      emoji: "🎸", emotionSlug: "excited"   },
      { label: "A crashing wave",  emoji: "🌊", emotionSlug: "overwhelmed" },
    ],
  },
  {
    id: "q3",
    questionText: "The last thing that crossed your mind was…",
    options: [
      { label: "Nothing, actually",        emoji: "😶", emotionSlug: "numb"       },
      { label: "A distant memory",         emoji: "💭", emotionSlug: "nostalgic"  },
      { label: "Something I need to do",   emoji: "✅",       emotionSlug: "anxious"    },
      { label: "Someone I care about",     emoji: "📛", emotionSlug: "grateful"   },
      { label: "Something bigger than me", emoji: "🌌", emotionSlug: "reflective" },
      { label: "Something funny",          emoji: "😂", emotionSlug: "happy"      },
    ],
  },
  {
    id: "q4",
    questionText: "If you were a room right now, you’d be…",
    options: [
      { label: "A dimly lit hallway",  emoji: "🚪", emotionSlug: "melancholic" },
      { label: "A cosy living room",   emoji: "🛋️", emotionSlug: "content" },
      { label: "An empty house",       emoji: "🏠", emotionSlug: "lonely"      },
      { label: "A rooftop at night",   emoji: "🎆", emotionSlug: "inspired"    },
      { label: "A room with too much", emoji: "🌀", emotionSlug: "overwhelmed" },
      { label: "A sunlit window seat", emoji: "🌅", emotionSlug: "peaceful"    },
    ],
  },
  {
    id: "q5",
    questionText: "Your inner volume is currently set to…",
    options: [
      { label: "Muted",           emoji: "🔇", emotionSlug: "numb"       },
      { label: "Low and distant", emoji: "🔈", emotionSlug: "sad"        },
      { label: "Background hum",  emoji: "🔉", emotionSlug: "reflective" },
      { label: "Normal, present", emoji: "🔊", emotionSlug: "content"    },
      { label: "Sharp and alert", emoji: "🔔", emotionSlug: "curious"    },
    ],
  },
];

// ---- Hook ---------------------------------------------------

let _lastIndex = -1;

/**
 * Returns a random mood question. Avoids repeating the same
 * question twice in a row (simple shuffle-like behaviour).
 */
export function getRandomMoodQuestion(): MoodQuestion {
  let idx: number;
  do {
    idx = Math.floor(Math.random() * QUESTIONS.length);
  } while (idx === _lastIndex && QUESTIONS.length > 1);
  _lastIndex = idx;
  return QUESTIONS[idx];
}

export { QUESTIONS as MOOD_QUESTIONS };
