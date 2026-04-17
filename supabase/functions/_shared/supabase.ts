// ============================================================
// Supabase admin client for Edge Functions
// Uses SERVICE_ROLE key — bypasses RLS for server-side ops.
// Never expose this key to the mobile client.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "./database.types.ts";

export function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

/**
 * Extract the authenticated user from the Authorization header.
 * Returns null if the token is missing or invalid.
 */
export async function getAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  const supabase = getServiceClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}
