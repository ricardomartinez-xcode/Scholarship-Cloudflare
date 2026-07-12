import "server-only";

import { createClient } from "@supabase/supabase-js";

import { parseServerEnv } from "@/lib/env/shared";

type EnvSource = Record<string, string | undefined>;

export function createSupabaseAdminClient(envSource: EnvSource = process.env) {
  const env = parseServerEnv(envSource);

  if (!env.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Supabase admin operations.");
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
