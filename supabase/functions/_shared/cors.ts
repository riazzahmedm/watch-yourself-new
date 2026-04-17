// ============================================================
// Shared CORS headers for all Watch Yourself Edge Functions
// ============================================================

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/** Respond to CORS preflight requests */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

/** Wrap a JSON payload with CORS headers */
export function jsonResponse(
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Wrap an error with CORS headers */
export function errorResponse(
  message: string,
  status = 400
): Response {
  return jsonResponse({ error: message }, status);
}
