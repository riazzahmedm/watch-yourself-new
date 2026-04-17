// ============================================================
// Edge Function: send-push
// POST /functions/v1/send-push
// Body (service-role only):
//   { type: NotificationType, userId?: string, payload?: object }
//
// Notification types:
//   "mood_feedback"   → prompt user to rate how a recent movie felt
//   "dna_ready"       → weekly "Your Taste DNA is updated"
//   "timeline_nudge"  → monthly "Your [Month] summary is ready"
//   "custom"          → arbitrary title + body (admin use)
//
// Called by:
//   - pg_cron job (mood feedback, weekly DNA summary)
//   - Timeline compute function (monthly nudge)
//   - Admin/internal tooling (custom)
// ============================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100; // Expo's max per request

type NotificationType = "mood_feedback" | "dna_ready" | "timeline_nudge" | "custom";

interface PushPayload {
  type: NotificationType;
  userId?: string;          // null = broadcast to all active users
  logId?: string;           // for mood_feedback
  periodId?: string;        // for timeline_nudge
  customTitle?: string;
  customBody?: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // This function is service-role only — no user auth header
  // Validate using a shared secret instead
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader || !authHeader.includes(serviceKey ?? "INVALID")) {
    return errorResponse("Unauthorized", 401);
  }

  let payload: PushPayload;
  try {
    payload = await req.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const supabase = getServiceClient();

  try {
    // ----------------------------------------------------------
    // 1. Build notification content
    // ----------------------------------------------------------
    const notification = buildNotification(payload);
    if (!notification) return errorResponse("Unknown notification type");

    // ----------------------------------------------------------
    // 2. Fetch push tokens
    // ----------------------------------------------------------
    let tokenQuery = supabase
      .from("device_tokens")
      .select("expo_push_token, user_id");

    if (payload.userId) {
      tokenQuery = tokenQuery.eq("user_id", payload.userId);
    }

    const { data: tokens, error: tokenError } = await tokenQuery;
    if (tokenError) throw tokenError;
    if (!tokens || tokens.length === 0) {
      return jsonResponse({ sent: 0, message: "No tokens found" });
    }

    // ----------------------------------------------------------
    // 3. Build Expo push messages
    // ----------------------------------------------------------
    const messages = tokens.map((t) => ({
      to:    t.expo_push_token,
      title: notification.title,
      body:  notification.body,
      data: {
        type: payload.type,
        userId: t.user_id,
        ...(payload.logId    ? { logId:    payload.logId }    : {}),
        ...(payload.periodId ? { periodId: payload.periodId } : {}),
        ...(payload.data ?? {}),
      },
      sound:    "default",
      priority: "high",
      // Deep link target (handled by expo-notifications on the app side)
      channelId: "default",
    }));

    // ----------------------------------------------------------
    // 4. Send in batches of 100
    // ----------------------------------------------------------
    let totalSent = 0;
    const errors: string[] = [];

    for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
      const batch = messages.slice(i, i + EXPO_BATCH_SIZE);

      const res = await fetch(EXPO_PUSH_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(batch),
      });

      if (!res.ok) {
        const text = await res.text();
        errors.push(`Batch ${i / EXPO_BATCH_SIZE + 1}: ${text}`);
        continue;
      }

      const result = await res.json();

      // Check for individual ticket errors
      const tickets: { status: string; message?: string }[] =
        result.data ?? [];
      const failed = tickets.filter((t) => t.status === "error");
      if (failed.length > 0) {
        errors.push(
          ...failed.map((f) => f.message ?? "unknown error")
        );
      }

      totalSent += tickets.filter((t) => t.status === "ok").length;
    }

    console.log(`send-push [${payload.type}]: ${totalSent} sent, ${errors.length} errors`);

    return jsonResponse({
      sent:   totalSent,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err) {
    console.error("send-push error:", err);
    return errorResponse("Internal server error", 500);
  }
});

// ---- Notification templates ---------------------------------

function buildNotification(
  payload: PushPayload
): { title: string; body: string } | null {
  switch (payload.type) {
    case "mood_feedback":
      return {
        title: "How did that movie land? 🎬",
        body:  "Tap to share how it matched your mood — takes 5 seconds.",
      };

    case "dna_ready":
      return {
        title: "Your Taste DNA updated 🧬",
        body:  "You've logged more films. See how your taste profile evolved.",
      };

    case "timeline_nudge":
      return {
        title: "Your monthly recap is ready 📅",
        body:  "See what your watch history says about this month.",
      };

    case "custom":
      if (!payload.customTitle || !payload.customBody) return null;
      return {
        title: payload.customTitle,
        body:  payload.customBody,
      };

    default:
      return null;
  }
}
