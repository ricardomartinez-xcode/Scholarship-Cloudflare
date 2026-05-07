import { createClient } from "@supabase/supabase-js";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

let supabaseBrowserClient: SupabaseBrowserClient | null = null;

export function getSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseClientKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseClientKey) {
    return null;
  }

  supabaseBrowserClient ??= createClient(supabaseUrl, supabaseClientKey);
  return supabaseBrowserClient;
}
