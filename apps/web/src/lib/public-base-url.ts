export function getPublicBaseUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  return (process.env.NEXT_PUBLIC_BASE_URL ?? "https://recalc.relead.com.mx").replace(/\/+$/, "");
}
