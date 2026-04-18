-- ============================================================
-- Dev seed: 10 popular movies with mood enrichment
-- Lets the Discover screen work before import-catalog runs.
-- Safe to re-run (upsert on tmdb_id).
-- ============================================================

insert into public.media (
  tmdb_id, media_type, title, overview,
  poster_path, backdrop_path,
  release_year, tmdb_rating, tmdb_vote_count,
  tmdb_genre_ids, tmdb_genres, tmdb_keywords,
  runtime_minutes, original_language, status,
  mood_scores, mood_tag_slugs, watch_yourself_score,
  cached_at, last_enriched_at
)
values
(
  238, 'movie', 'The Godfather',
  'Spanning the years 1945 to 1955, a chronicle of the fictional Italian-American Corleone crime family.',
  '/3bhkrj58Vtu7enYsLegHzFLGd8A.jpg', '/tmU7GeKVybMWFButWEGl2M4GeiP.jpg',
  1972, 8.7, 20000,
  ARRAY[18,80], '[{"id":18,"name":"Drama"},{"id":80,"name":"Crime"}]'::jsonb,
  ARRAY['mafia','power','family','crime','organized crime'],
  175, 'en', 'Released',
  '{"feeling_low":0.50,"need_intensity":0.60,"comfort_watch":0.10,"mind_blown":0.30,"existential":0.40}'::jsonb,
  ARRAY['feeling_low','need_intensity'], 0.92,
  now(), now()
),
(
  278, 'movie', 'The Shawshank Redemption',
  'Framed in the 1940s for the double murder of his wife and her lover, upstanding banker Andy Dufresne begins a new life at the Shawshank State Penitentiary.',
  '/lyQBXzOQSuE59IsHyhrp0qIiPAz.jpg', '/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg',
  1994, 8.7, 26000,
  ARRAY[18,80], '[{"id":18,"name":"Drama"},{"id":80,"name":"Crime"}]'::jsonb,
  ARRAY['hope','prison','friendship','redemption','injustice'],
  142, 'en', 'Released',
  '{"feeling_low":0.80,"need_intensity":0.20,"comfort_watch":0.30,"mind_blown":0.25,"existential":0.55}'::jsonb,
  ARRAY['feeling_low','existential'], 0.94,
  now(), now()
),
(
  680, 'movie', 'Pulp Fiction',
  'A burger-loving hit man, his philosophical partner, a drug-addled gangster''s moll and a washed-up boxer converge in this sprawling, comedic crime caper.',
  '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', '/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg',
  1994, 8.5, 27000,
  ARRAY[80,53,35], '[{"id":80,"name":"Crime"},{"id":53,"name":"Thriller"},{"id":35,"name":"Comedy"}]'::jsonb,
  ARRAY['nonlinear','dark comedy','hitman','twist','violence'],
  154, 'en', 'Released',
  '{"feeling_low":0.15,"need_intensity":0.65,"comfort_watch":0.10,"mind_blown":0.75,"existential":0.30}'::jsonb,
  ARRAY['need_intensity','mind_blown'], 0.93,
  now(), now()
),
(
  13, 'movie', 'Forrest Gump',
  'A man with a low IQ has accomplished great things in his life and been present during significant historic events.',
  '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg', '/qdIMHd4sEfJSckfVJfKQvisL02a.jpg',
  1994, 8.5, 25000,
  ARRAY[35,18,10749], '[{"id":35,"name":"Comedy"},{"id":18,"name":"Drama"},{"id":10749,"name":"Romance"}]'::jsonb,
  ARRAY['feel-good','heartwarming','love','history','simplicity'],
  142, 'en', 'Released',
  '{"feeling_low":0.60,"need_intensity":0.10,"comfort_watch":0.85,"mind_blown":0.15,"existential":0.25}'::jsonb,
  ARRAY['feeling_low','comfort_watch'], 0.91,
  now(), now()
),
(
  157336, 'movie', 'Interstellar',
  'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel.',
  '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', '/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
  2014, 8.4, 35000,
  ARRAY[12,18,878], '[{"id":12,"name":"Adventure"},{"id":18,"name":"Drama"},{"id":878,"name":"Sci-Fi"}]'::jsonb,
  ARRAY['space','time travel','consciousness','love','survival'],
  169, 'en', 'Released',
  '{"feeling_low":0.35,"need_intensity":0.45,"comfort_watch":0.10,"mind_blown":0.85,"existential":0.80}'::jsonb,
  ARRAY['mind_blown','existential'], 0.91,
  now(), now()
),
(
  550, 'movie', 'Fight Club',
  'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.',
  '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', '/hZkgoQYus5vegHoetLkCJzVwQoD.jpg',
  1999, 8.4, 28000,
  ARRAY[18,53], '[{"id":18,"name":"Drama"},{"id":53,"name":"Thriller"}]'::jsonb,
  ARRAY['twist','psychological','identity','anarchism','unreliable narrator'],
  139, 'en', 'Released',
  '{"feeling_low":0.30,"need_intensity":0.70,"comfort_watch":0.05,"mind_blown":0.90,"existential":0.70}'::jsonb,
  ARRAY['need_intensity','mind_blown','existential'], 0.92,
  now(), now()
),
(
  19404, 'movie', 'Dilwale Dulhania Le Jayenge',
  'Raj is a rich, carefree man who falls in love with Simran during a trip across Europe. Simran must choose between love and family.',
  '/2CAL2433ZeIihfX1Hb2139CX0pW.jpg', '/90ez6ArvJC4Ll2JbcK2KNeMV6fI.jpg',
  1995, 8.1, 5000,
  ARRAY[10749,35,18], '[{"id":10749,"name":"Romance"},{"id":35,"name":"Comedy"},{"id":18,"name":"Drama"}]'::jsonb,
  ARRAY['romance','family','love','bollywood','heartwarming'],
  189, 'hi', 'Released',
  '{"feeling_low":0.55,"need_intensity":0.10,"comfort_watch":0.80,"mind_blown":0.10,"existential":0.15}'::jsonb,
  ARRAY['feeling_low','comfort_watch'], 0.82,
  now(), now()
),
(
  129, 'movie', 'Spirited Away',
  'During her family''s move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits.',
  '/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', '/bSXfU4dwZyBA1vMmXvejdRXBvuF.jpg',
  2001, 8.5, 15000,
  ARRAY[16,14,12], '[{"id":16,"name":"Animation"},{"id":14,"name":"Fantasy"},{"id":12,"name":"Adventure"}]'::jsonb,
  ARRAY['coming of age','magic','identity','wonder','healing'],
  125, 'ja', 'Released',
  '{"feeling_low":0.65,"need_intensity":0.15,"comfort_watch":0.70,"mind_blown":0.50,"existential":0.55}'::jsonb,
  ARRAY['feeling_low','comfort_watch','existential'], 0.90,
  now(), now()
),
(
  27205, 'movie', 'Inception',
  'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets is offered a chance to regain his old life.',
  '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
  2010, 8.4, 36000,
  ARRAY[28,878,12], '[{"id":28,"name":"Action"},{"id":878,"name":"Sci-Fi"},{"id":12,"name":"Adventure"}]'::jsonb,
  ARRAY['dream','heist','mind-bending','twist','alternate reality'],
  148, 'en', 'Released',
  '{"feeling_low":0.10,"need_intensity":0.70,"comfort_watch":0.10,"mind_blown":0.95,"existential":0.45}'::jsonb,
  ARRAY['need_intensity','mind_blown'], 0.92,
  now(), now()
),
(
  11, 'movie', 'Star Wars',
  'Princess Leia is captured and held hostage by the evil Imperial forces in their effort to take over the galactic Empire.',
  '/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg', '/4iJfYYoQzZcONB9hNzg0J0wWJPt.jpg',
  1977, 8.2, 20000,
  ARRAY[12,28,14], '[{"id":12,"name":"Adventure"},{"id":28,"name":"Action"},{"id":14,"name":"Fantasy"}]'::jsonb,
  ARRAY['space opera','hero journey','adventure','good vs evil','iconic'],
  121, 'en', 'Released',
  '{"feeling_low":0.20,"need_intensity":0.65,"comfort_watch":0.60,"mind_blown":0.30,"existential":0.20}'::jsonb,
  ARRAY['need_intensity','comfort_watch'], 0.89,
  now(), now()
)
on conflict (tmdb_id) do update set
  mood_scores          = excluded.mood_scores,
  mood_tag_slugs       = excluded.mood_tag_slugs,
  watch_yourself_score = excluded.watch_yourself_score,
  last_enriched_at     = now();
