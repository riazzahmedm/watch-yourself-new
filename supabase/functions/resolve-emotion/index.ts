// ============================================================
// Edge Function: resolve-emotion
// POST /functions/v1/resolve-emotion
// Body: { logId: string, energyLevel: 1-5, mindLevel: 1-5 }
//
// Called after the post-watch check-in in the mobile app.
// Triangulates energy + mind levels to a resolved emotion,
// then patches the log row with post_watch_emotion_id,
// post_energy_level, and post_mind_level.
//
// Returns the resolved emotion so the app can show a toast:
//   "You're feeling Inspired ✨"
// ============================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient, getAuthUser } from "../_shared/supabase.ts";

// ---- Emotion triangulation matrix ---------------------------
// Rows = energy label, Cols = mind label
// Energy:  1=Drained  2=Low     3=Neutral  4=Buzzing  5=Wired
// Mind:    1=Empty    2=Light   3=Neutral  4=A bit full  5=Spinning

const ENERGY_LABELS: Record<number, string> = {
  1: "Drained",
  2: "Low",
  3: "Neutral",
  4: "Buzzing",
  5: "Wired",
};

const MIND_LABELS: Record<number, string> = {
  1: "Empty",
  2: "Light",
  3: "Neutral",
  4: "A bit full",
  5: "Spinning",
};

// [energyLevel][mindLevel] → emotion slug
const MATRIX: Record<number, Record<number, string>> = {
  1: { 1: "numb",        2: "peaceful",    3: "tired",       4: "drained",    5: "overwhelmed" },
  2: { 1: "lonely",      2: "melancholic", 3: "sad",         4: "reflective", 5: "anxious"     },
  3: { 1: "bored",       2: "peaceful",    3: "content",     4: "reflective", 5: "restless"    },
  4: { 1: "curious",     2: "hopeful",     3: "grateful",    4: "inspired",   5: "restless"    },
  5: { 1: "curious",     2: "excited",     3: "excited",     4: "inspired",   5: "anxious"     },
};

// ---- Handler ------------------------------------------------

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const user = await getAuthUser(req);
  if (!user) return errorResponse("Unauthorized", 401);

  let logId: string;
  let energyLevel: number;
  let mindLevel: number;

  try {
    const body = await req.json();
    logId       = body.logId as string;
    energyLevel = Number(body.energyLevel);
    mindLevel   = Number(body.mindLevel);
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (!logId)                                      return errorResponse("logId is required");
  if (energyLevel < 1 || energyLevel > 5 || isNaN(energyLevel)) return errorResponse("energyLevel must be 1–5");
  if (mindLevel   < 1 || mindLevel   > 5 || isNaN(mindLevel))   return errorResponse("mindLevel must be 1–5");

  const supabase = getServiceClient();

  try {
    // ----------------------------------------------------------
    // 1. Verify this log belongs to the authenticated user
    // ----------------------------------------------------------
    const { data: log, error: logError } = await supabase
      .from("logs")
      .select("id, user_id")
      .eq("id", logId)
      .single();

    if (logError || !log) return errorResponse("Log not found", 404);

    // Use profile id for auth check (logs.user_id references profiles.id)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!profile || log.user_id !== profile.id) {
      return errorResponse("Forbidden", 403);
    }

    // ----------------------------------------------------------
    // 2. Resolve emotion from matrix
    // ----------------------------------------------------------
    const emotionSlug = MATRIX[energyLevel]?.[mindLevel] ?? "content";

    const { data: emotion, error: emotionError } = await supabase
      .from("emotions")
      .select("id, slug, label, emoji")
      .eq("slug", emotionSlug)
      .single();

    if (emotionError || !emotion) {
      console.error("emotion lookup failed:", emotionSlug, emotionError);
      return errorResponse("Emotion not found", 500);
    }

    // ----------------------------------------------------------
    // 3. Patch the log row
    // ----------------------------------------------------------
    const { error: updateError } = await supabase
      .from("logs")
      .update({
        post_watch_emotion_id: emotion.id,
        post_energy_level:     energyLevel,
        post_mind_level:       mindLevel,
      })
      .eq("id", logId);

    if (updateError) throw updateError;

    // ----------------------------------------------------------
    // 4. Return resolved emotion for the app toast
    // ----------------------------------------------------------
    return jsonResponse({
      emotion: {
        slug:  emotion.slug,
        label: emotion.label,
        emoji: emotion.emoji,
      },
      energyLabel: ENERGY_LABELS[energyLevel],
      mindLabel:   MIND_LABELS[mindLevel],
    });

  } catch (err) {
    console.error("resolve-emotion error:", err);
    return errorResponse("Internal server error", 500);
  }
});
