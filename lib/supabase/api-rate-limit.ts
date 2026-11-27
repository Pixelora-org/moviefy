import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

export type ApiRateLimitBucket = "pick_for_me" | "movie_catalog";

export async function consumeApiRateLimit(
  token: string,
  bucket: ApiRateLimitBucket,
): Promise<boolean | null> {
  const config = getSupabaseBrowserConfig();
  if (!config) return null;

  const client = createClient(config.url, config.anonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
  const { data, error } = await client.rpc("consume_api_rate_limit", {
    p_bucket: bucket,
  });
  if (error) {
    console.error("[api-rate-limit] Supabase rate limit check failed:", error);
    return null;
  }
  return data === true;
}
