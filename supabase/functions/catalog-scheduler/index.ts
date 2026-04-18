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
import { MOOD_RULES } from "../_shared/enrichment.ts";

const PAGES_PER_MOOD = 10;  // cron imports up to this page; skips already-done
const MOOD_SLUGS     = MOOD_RULES.map((r) => r.slug);

// ---- Core: import one mood ----------------------------------

async function importMood(slug: string): Promise<Record<string, unknown>> {
  const adminKey  = Deno.env.get("IMPORT_ADMIN_KEY") ?? "";
  const baseUrl   = Deno.env.get("SUPABASE_URL") ?? "";
  const importUrl = `${baseUrl}/functions/v1/import-catalog`;

  if (!adminKey || !baseUrl) throw new Error("Missing IMPORT_ADMIN_KEY or SUPABASE_URL");

  const res = await fetch(importUrl, {
    method:  "POST",
    headers: { "X-Admin-Key": adminKey, "Content-Type": "application/json" },
    body:    JSON.stringify({ moodSlug: slug, pages: PAGES_PER_MOOD }),
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

  console.log(`[catalog-scheduler] Starting import — moods: ${moods.join(", ")}`);

  // Run in background so HTTP response is immediate (avoid gateway timeout)
  (async () => {
    const results: Record<string, unknown> = {};
    for (const slug of moods) {
      try {
        results[slug] = await importMood(slug);
        console.log(`[catalog-scheduler] ${slug}:`, results[slug]);
      } catch (err) {
        console.error(`[catalog-scheduler] ${slug} failed:`, err);
        results[slug] = { error: String(err) };
      }
    }
    console.log("[catalog-scheduler] Import complete:", JSON.stringify(results));
  })();

  return jsonResponse(
    {
      message: "Catalog refresh triggered",
      moods,
      pages:   PAGES_PER_MOOD,
      note:    "Running in background — check Supabase function logs for progress",
    },
    202
  );
});
