-- ============================================================
-- Watch Yourself: Seed Emotions
-- Migration: 20260506000003_seed_emotions.sql
-- ============================================================

insert into public.emotions (slug, label, emoji, valence, energy_level) values
  -- Positive / high energy
  ('happy',       'Happy',       '😊', 'positive', 5),
  ('excited',     'Excited',     '🎉', 'positive', 5),
  ('inspired',    'Inspired',    '✨', 'positive', 5),
  ('hopeful',     'Hopeful',     '🌱', 'positive', 4),
  ('curious',     'Curious',     '🔍', 'positive', 4),
  -- Positive / low-medium energy
  ('grateful',    'Grateful',    '🙏', 'positive', 3),
  ('content',     'Content',     '😌', 'positive', 3),
  ('peaceful',    'Peaceful',    '🕊️',  'positive', 2),
  -- Neutral
  ('nostalgic',   'Nostalgic',   '🌅', 'neutral',  2),
  ('reflective',  'Reflective',  '💭', 'neutral',  3),
  ('bored',       'Bored',       '😑', 'neutral',  2),
  ('restless',    'Restless',    '🌀', 'neutral',  4),
  -- Negative / low energy
  ('sad',         'Sad',         '😢', 'negative', 2),
  ('melancholic', 'Melancholic', '🌧️',  'negative', 2),
  ('lonely',      'Lonely',      '🌃', 'negative', 2),
  ('tired',       'Tired',       '😴', 'negative', 1),
  ('drained',     'Drained',     '🪫', 'negative', 1),
  ('numb',        'Numb',        '🌫️',  'negative', 1),
  -- Negative / high energy
  ('anxious',     'Anxious',     '😰', 'negative', 4),
  ('stressed',    'Stressed',    '😤', 'negative', 5),
  ('overwhelmed', 'Overwhelmed', '🌊', 'negative', 5)
on conflict (slug) do nothing;
