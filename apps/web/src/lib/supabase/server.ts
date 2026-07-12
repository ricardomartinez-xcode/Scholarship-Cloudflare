import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getClientEnv } from "@/lib/env/client";

type CookieRecord = {
  name: string;
  value: string;
};

type MutableCookieStore = {
  getAll(): CookieRecord[];
  set(name: string, value: string, options?: CookieOptions): void;
};

export async function createSupabaseServerClient() {
  const cookieStore = (await cookies()) as MutableCookieStore;
  return createSupabaseServerClientFromCookieStore(cookieStore);
}

export function createSupabaseServerClientFromCookieStore(cookieStore: MutableCookieStore) {
  const env = getClientEnv();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. Middleware refresh handles it.
        }
      },
    },
  });
}
