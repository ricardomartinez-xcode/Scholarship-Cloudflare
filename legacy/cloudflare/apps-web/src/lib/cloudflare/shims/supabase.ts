function fail() {
  throw new Error(
    "Supabase is disabled in the Cloudflare Worker runtime. Use Cloudflare-native realtime infrastructure.",
  );
}

export function createClient() {
  return new Proxy(
    {},
    {
      get() {
        return fail;
      },
    },
  );
}
