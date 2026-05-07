-- ============================================================
-- Watch Yourself: Seed Mood Questions
-- Migration: 20260506000004_seed_mood_questions.sql
--
-- Each option is a JSON object: { label, emoji, emotion_slug }
-- emotion_slug must match a slug in the emotions table.
-- ============================================================

insert into public.mood_questions (question_text, option_a, option_b, option_c, option_d, option_e, option_f) values

-- Q1: Weather
(
  'If your inner world were weather right now, it''d be…',
  '{"label": "Foggy",    "emoji": "🌫️", "emotion_slug": "numb"}',
  '{"label": "Drizzly",  "emoji": "🌧️", "emotion_slug": "melancholic"}',
  '{"label": "Overcast", "emoji": "☁️",  "emotion_slug": "tired"}',
  '{"label": "Breezy",   "emoji": "🌬️", "emotion_slug": "content"}',
  '{"label": "Stormy",   "emoji": "⛈️",  "emotion_slug": "anxious"}',
  '{"label": "Sunny",    "emoji": "☀️",  "emotion_slug": "happy"}'
),

-- Q2: Object metaphor
(
  'Right now you feel most like…',
  '{"label": "A drained phone",   "emoji": "🪫", "emotion_slug": "drained"}',
  '{"label": "A slow Sunday",     "emoji": "🐢", "emotion_slug": "peaceful"}',
  '{"label": "A spinning top",    "emoji": "🌀", "emotion_slug": "restless"}',
  '{"label": "A quiet flame",     "emoji": "🕯️", "emotion_slug": "hopeful"}',
  '{"label": "A live wire",       "emoji": "🎸", "emotion_slug": "excited"}',
  '{"label": "A crashing wave",   "emoji": "🌊", "emotion_slug": "overwhelmed"}'
),

-- Q3: What crossed your mind
(
  'The last thing that crossed your mind was…',
  '{"label": "Nothing, actually",       "emoji": "😶",  "emotion_slug": "numb"}',
  '{"label": "A distant memory",        "emoji": "💭",  "emotion_slug": "nostalgic"}',
  '{"label": "Something I need to do",  "emoji": "✅",  "emotion_slug": "anxious"}',
  '{"label": "Someone I care about",    "emoji": "💛",  "emotion_slug": "grateful"}',
  '{"label": "Something bigger than me","emoji": "🌌",  "emotion_slug": "reflective"}',
  '{"label": "Something funny",         "emoji": "😂",  "emotion_slug": "happy"}'
),

-- Q4: Room metaphor
(
  'If you were a room right now, you''d be…',
  '{"label": "A dimly lit hallway",   "emoji": "🪞", "emotion_slug": "melancholic"}',
  '{"label": "A cosy living room",    "emoji": "🛋️", "emotion_slug": "content"}',
  '{"label": "An empty house",        "emoji": "🏚️", "emotion_slug": "lonely"}',
  '{"label": "A rooftop at night",    "emoji": "🎆", "emotion_slug": "inspired"}',
  '{"label": "A room with too much",  "emoji": "🌀", "emotion_slug": "overwhelmed"}',
  '{"label": "A sunlit window seat",  "emoji": "🌅", "emotion_slug": "peaceful"}'
),

-- Q5: Volume (5 options, no option_f)
(
  'Your inner volume is currently set to…',
  '{"label": "Muted",           "emoji": "🔇", "emotion_slug": "numb"}',
  '{"label": "Low and distant", "emoji": "🔈", "emotion_slug": "sad"}',
  '{"label": "Background hum",  "emoji": "🔉", "emotion_slug": "reflective"}',
  '{"label": "Normal, present", "emoji": "🔊", "emotion_slug": "content"}',
  '{"label": "Sharp and alert", "emoji": "🔔", "emotion_slug": "curious"}',
  null
);
