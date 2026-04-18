// ============================================================
// Edge Function: import-catalog
// POST /functions/v1/import-catalog
// Body: { moodSlug?: string, pages?: number, dryRun?: boolean }
//
// Pre-populates the media table with TMDB catalog data.
// Run this:
//   - Once before launch to seed the DB
//   - On a weekly pg_cron schedule to stay fresh
//
// Strategy per mood:
//   1. Use TMDB Discover with mood's preferred genres
//   2. Fetch N pages (default 5, ~100 movies per mood)
//   3. Upsert into media with full detail
//   4. Enrich each batch immediately (mood scores + watch_yourself_score)
//   5. Log imported pages into catalog_import_log
//
// All recommendation queries hit OUR DB — never TMDB at runtime.
// ============================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { discoverMovies, getMovieDetail } from "../_shared/tmdb.ts";
import { enrichMedia } from "../_shared/enrichment.ts";
import { MOOD_RULES } from "../_shared/enrichment.ts";

const DEFAULT_PAGES     = 5;   // ~100 movies per mood (20 per page)
const ENRICH_BATCH_SIZE = 20;  // how many to detail-fetch at once
const TMDB_DELAY_MS     = 250; // polite delay between TMDB calls

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Admin-only endpoint: check X-Admin-Key header against IMPORT_ADMIN_KEY secret
  const providedKey = req.headers.get("X-Admin-Key") ?? "";
  const adminKey    = Deno.env.get("IMPORT_ADMIN_KEY") ?? "INVALID";
  if (!providedKey || providedKey !== adminKey) {
    return errorResponse("Unauthorized", 401);
  }

  let targetMoodSlug: string | undefined;
  let pages: number;
  let dryRun: boolean;

  try {
    const body = await req.json().catch(() => ({}));
    targetMoodSlug = body.moodSlug?.trim() || undefined;
    pages          = Math.min(Number(body.pages ?? DEFAULT_PAGES), 20);
    dryRun         = Boolean(body.dryRun ?? false);
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const supabase = getServiceClient();
  const summary: Record<string, { imported: number; skipped: number; enriched: number }> = {};

  // Pick which moods to run
  const moodsToRun = targetMoodSlug
    ? MOOD_RULES.filter((r) => r.slug === targetMoodSlug)
    : MOOD_RULES;

  if (moodsToRun.length === 0) {
    return errorResponse(`Unknown moodSlug: ${targetMoodSlug}`, 404);
  }

  for (const rule of moodsToRun) {
    console.log(`[import-catalog] Starting mood: ${rule.slug}`);
    summary[rule.slug] = { imported: 0, skipped: 0, enriched: 0 };

    // Get mood tag config for genre filters
    const { data: moodTag } = await supabase
      .from("mood_tags")
      .select("preferred_genres, avoid_genres, min_tmdb_rating, max_runtime_mins")
      .eq("slug", rule.slug)
      .single();

    if (!moodTag) {
      console.warn(`[import-catalog] No mood_tag row for ${rule.slug}, skipping`);
      continue;
    }

    for (let page = 1; page <= pages; page++) {
      // Check if already imported
      const { data: alreadyImported } = await supabase
        .from("catalog_import_log")
        .select("id")
        .eq("mood_slug", rule.slug)
        .eq("tmdb_page", page)
        .single();

      if (alreadyImported && !dryRun) {
        summary[rule.slug].skipped += 20;
        continue;
      }

      // Fetch from TMDB Discover
      await sleep(TMDB_DELAY_MS);
      const movies = await discoverMovies({
        with_genres:        moodTag.preferred_genres.join("|"),   // | = OR logic in TMDB
        without_genres:     moodTag.avoid_genres.join("|"),
        "vote_average.gte": String(moodTag.min_tmdb_rating),
        "runtime.lte":      moodTag.max_runtime_mins
          ? String(moodTag.max_runtime_mins)
          : undefined,
        sort_by: "popularity.desc",  // popularity first for catalog seeding
        page,
      });

      if (movies.length === 0) {
        console.log(`[import-catalog] ${rule.slug} page ${page}: 0 results, stopping`);
        break;
      }

      // --------------------------------------------------------
      // Fetch full detail for each movie (for keywords + genres)
      // Do this in batches to avoid TMDB rate limits
      // --------------------------------------------------------
      const enriched = [];
      for (let i = 0; i < movies.length; i += ENRICH_BATCH_SIZE) {
        const batch = movies.slice(i, i + ENRICH_BATCH_SIZE);

        const detailPromises = batch.map(async (m) => {
          try {
            await sleep(TMDB_DELAY_MS);
            return await getMovieDetail(m.id);
          } catch (e) {
            console.warn(`[import-catalog] Failed to fetch detail for tmdbId ${m.id}:`, e);
            return null;
          }
        });

        const details = (await Promise.allSettled(detailPromises))
          .map((r) => (r.status === "fulfilled" ? r.value : null))
          .filter(Boolean);

        for (const detail of details) {
          if (!detail) continue;

          // Compute enrichment
          const enrichmentResult = enrichMedia({
            tmdb_genre_ids:  detail.genres?.map((g) => g.id) ?? [],
            tmdb_keywords:   detail.keywords.map((k) => k.name),
            tmdb_rating:     detail.vote_average,
            tmdb_vote_count: detail.vote_count,
          });

          enriched.push({
            // Media columns
            tmdb_id:           detail.id,
            media_type:        "movie" as const,
            title:             detail.title,
            original_title:    detail.original_title,
            overview:          detail.overview,
            poster_path:       detail.poster_path,
            backdrop_path:     detail.backdrop_path,
            release_year:      parseYear(detail.release_date),
            tmdb_genres:       detail.genres ?? [],
            tmdb_genre_ids:    detail.genres?.map((g) => g.id) ?? [],
            runtime_minutes:   detail.runtime,
            tmdb_rating:       detail.vote_average,
            tmdb_vote_count:   detail.vote_count,
            original_language: detail.original_language,
            status:            detail.status,
            tmdb_keywords:     detail.keywords.map((k) => k.name),
            cached_at:         new Date().toISOString(),
            // Enrichment columns
            mood_scores:       enrichmentResult.mood_scores,
            mood_tag_slugs:    enrichmentResult.mood_tag_slugs,
            watch_yourself_score:    enrichmentResult.watch_yourself_score,
            last_enriched_at:  new Date().toISOString(),
          });
        }
      }

      if (!dryRun && enriched.length > 0) {
        // Upsert into media table
        const { error: upsertError } = await supabase
          .from("media")
          .upsert(enriched, { onConflict: "tmdb_id", ignoreDuplicates: false });

        if (upsertError) {
          console.error(`[import-catalog] Upsert error on page ${page}:`, upsertError);
        } else {
          summary[rule.slug].imported += enriched.length;
          summary[rule.slug].enriched += enriched.length;

          // Log the page as imported
          await supabase
            .from("catalog_import_log")
            .upsert(
              { mood_slug: rule.slug, tmdb_page: page, media_count: enriched.length },
              { onConflict: "mood_slug, tmdb_page" }
            );
        }
      } else if (dryRun) {
        summary[rule.slug].imported += enriched.length; // simulate
        console.log(`[import-catalog] DRY RUN — would import ${enriched.length} from page ${page}`);
      }

      console.log(
        `[import-catalog] ${rule.slug} page ${page}: ` +
        `${enriched.length} enriched, total so far: ${summary[rule.slug].imported}`
      );
    }
  }

  return jsonResponse({
    summary,
    dryRun,
    message: dryRun
      ? "Dry run complete — no data written"
      : "Catalog import complete",
  });
});

// ---- Helpers ------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseYear(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const y = parseInt(dateStr.substring(0, 4), 10);
  return isNaN(y) ? null : y;
}
