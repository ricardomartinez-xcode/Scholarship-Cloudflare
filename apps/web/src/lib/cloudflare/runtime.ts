export function isCloudflareRuntime() {
  return process.env.NEXT_PUBLIC_APP_ENV === "cloudflare" || process.env.CLOUDFLARE_BUILD === "1";
}
