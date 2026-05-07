// ============================================================
// Edge Function: catalog-scheduler
// Called by pg_cron every Sunday — no manual work needed.
// Also callable manually for ad-hoc imports.
//
// pg_cron schedule lives in migration 20260418000008_pg_cron.sql
// Both the cron job and this function use IMPORT_ADMIN_KEY.
//
// Growth model:
//   Seed run                : pages 1-5   → ~500 movies
//   Week 1 cron (pages 6-10): +~500 movies
//   Week 2 cron (11-15)     : +~500 movies …
//   import-catalog skips already-imported pages automatically.
// ============================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { MOOD_RULES } from "../_shared/enrichment.ts";

// Pages imported per mood per daily run.
// 5 pages × ~20 movies = ~100 new movies per mood per day.
const PAGES_PER_RUN = 5;
const MOOD_SLUGS    = MOOD_RULES.map((r) => r.slug);

// ---- High-water-mark helpers --------------------------------

// deno-lint-ignore no-explicit-any
type AnyClient = any;

async function getHWM(supabase: AnyClient): Promise<number> {
  const { data, error } = await supabase.rpc("get_catalog_high_water");
  if (error) {
    console.warn("[catalog-scheduler] Could not read HWM, defaulting to 0:", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

async function setHWM(supabase: AnyClient, page: number): Promise<void> {
  const { error } = await supabase.rpc("set_catalog_high_water", { p_page: page });
  if (error) console.warn("[catalog-scheduler] Could not update HWM:", error.message);
}

// ---- Core: import one mood ----------------------------------

async function importMood(
  slug: string,
  startPage: number,
): Promise<Record<string, unknown>> {
  const adminKey  = Deno.env.get("IMPORT_ADMIN_KEY") ?? "";
  const baseUrl   = Deno.env.get("SUPABASE_URL") ?? "";
  const importUrl = `${baseUrl}/functions/v1/import-catalog`;

  if (!adminKey || !baseUrl) throw new Error("Missing IMPORT_ADMIN_KEY or SUPABASE_URL");

  const res = await fetch(importUrl, {
    method:  "POST",
    headers: { "X-Admin-Key": adminKey, "Content-Type": "application/json" },
    body:    JSON.stringify({ moodSlug: slug, startPage, pages: PAGES_PER_RUN }),
  });

  if (!res.ok) throw new Error(`import-catalog HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json() as { summary?: Record<string, unknown> };
  return (data.summary?.[slug] ?? {}) as Record<string, unknown>;
}

// ---- HTTP handler -------------------------------------------
// Called by pg_cron via pg_net.http_post, OR manually.
// Returns 202 immediately; import continues in the background.

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const providedKey = req.headers.get("X-Admin-Key") ?? "";
  const adminKey    = Deno.env.get("IMPORT_ADMIN_KEY") ?? "INVALID";

  if (!providedKey || providedKey !== adminKey) {
    return errorResponse("Unauthorized", 401);
  }

  // Optional: scope to a single mood (?moodSlug=feeling_low)
  const url      = new URL(req.url);
  const moodSlug = url.searchParams.get("moodSlug") ?? undefined;
  const moods    = moodSlug ? [moodSlug] : MOOD_SLUGS;

  const supabase  = getServiceClient();
  const hwm       = await getHWM(supabase);
  const startPage = hwm + 1;
  const endPage   = hwm + PAGES_PER_RUN;   // inclusive

  console.log(
    `[catalog-scheduler] Starting import — moods: ${moods.join(", ")} ` +
    `pages ${startPage}–${endPage} (HWM was ${hwm})`
  );

  // Run in background so HTTP response is immediate (avoid gateway timeout)
  (async () => {
    const results: Record<string, unknown> = {};
    for (const slug of moods) {
      try {
        results[slug] = await importMood(slug, startPage);
        console.log(`[catalog-scheduler] ${slug}:`, results[slug]);
      } catch (err) {
        console.error(`[catalog-scheduler] ${slug} failed:`, err);
        results[slug] = { error: String(err) };
      }
    }

    // Advance HWM after all moods have run
    await setHWM(supabase, endPage);
    console.log(
      "[catalog-scheduler] Import complete, HWM advanced to",
      endPage,
      JSON.stringify(results)
    );
  })();

  return jsonResponse(
    {
      message:   "Catalog refresh triggered",
      moods,
      startPage,
      endPage,
      pagesPerRun: PAGES_PER_RUN,
      note:      "Running in background — check Supabase function logs for progress",
    },
    202
  );
});
