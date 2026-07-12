export function isCloudflareRuntime() {
  // Backward-compatible name for legacy call sites. These paths now run through
  // the PostgreSQL compatibility adapter in `cloudflare/d1.ts` when enabled.
  return (
    process.env.NEXT_PUBLIC_APP_ENV === "cloudflare" ||
    process.env.CLOUDFLARE_BUILD === "1" ||
    process.env.VERCEL === "1" ||
    process.env.POSTGRES_COMPAT_RUNTIME === "1"
  );
}
