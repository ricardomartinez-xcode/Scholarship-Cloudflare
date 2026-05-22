const DEFAULT_META_PUBLIC_BASE_URL = "https://recalc.relead.com.mx";
const DEFAULT_META_SUPPORT_EMAIL = "recalc@relead.com.mx";

function normalizeBaseUrl(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return DEFAULT_META_PUBLIC_BASE_URL;

  try {
    return new URL(candidate).toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_META_PUBLIC_BASE_URL;
  }
}

export function getMetaPublicBaseUrl() {
  return normalizeBaseUrl(process.env.META_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL);
}

export function getMetaSupportEmail() {
  return process.env.META_SUPPORT_EMAIL?.trim() || DEFAULT_META_SUPPORT_EMAIL;
}

export function getMetaLegalUrls() {
  const baseUrl = getMetaPublicBaseUrl();

  return {
    cancelAuthorizationUrl: new URL("/legal/meta/cancelled", baseUrl).toString(),
    dataDeletionRequestUrl: new URL("/legal/meta/data-deletion", baseUrl).toString(),
    dataDeletionCallbackUrl: new URL("/api/integrations/meta/data-deletion", baseUrl).toString(),
  };
}
