import "server-only";

import { parseServerEnv } from "./shared";

export type { ServerEnv } from "./shared";

let cachedServerEnv: ReturnType<typeof parseServerEnv> | null = null;

export function getServerEnv() {
  cachedServerEnv ??= parseServerEnv(process.env);
  return cachedServerEnv;
}

export function getSupabaseServiceRoleKey() {
  const key = getServerEnv().supabaseServiceRoleKey;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this server-only operation.");
  }
  return key;
}
