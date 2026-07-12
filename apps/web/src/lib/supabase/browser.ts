"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/env/client";

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserSupabaseClient | null = null;

export function createSupabaseBrowserClient() {
  const env = getClientEnv();
  browserClient ??= createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return browserClient;
}
