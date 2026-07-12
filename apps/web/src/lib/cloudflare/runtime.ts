export function isCloudflareRuntime() {
  // Backward-compatible name for legacy call sites. These paths now run through
  // the PostgreSQL compatibility adapter in `cloudflare/d1.ts`, not Cloudflare.
  return true;
}
