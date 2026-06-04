const DEFAULT_PROJECT_ID = "jolly-king-13100259";
const DEFAULT_BRANCH_ID = "br-old-mountain-ai239lh2";

export const NEON_AUTH_OAUTH_PROVIDERS = ["google", "github", "microsoft", "vercel"] as const;

export type NeonAuthOAuthProvider = (typeof NEON_AUTH_OAUTH_PROVIDERS)[number];

export type OAuthProviderOption = {
  id: NeonAuthOAuthProvider;
  label: string;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

const DEFAULT_UI_PROVIDERS: NeonAuthOAuthProvider[] = ["google"];

const PROVIDER_LABELS: Record<NeonAuthOAuthProvider, string> = {
  google: "Google",
  github: "GitHub",
  microsoft: "Microsoft",
  vercel: "Vercel",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function env(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function asProvider(value: unknown): NeonAuthOAuthProvider | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return (NEON_AUTH_OAUTH_PROVIDERS as readonly string[]).includes(normalized)
    ? (normalized as NeonAuthOAuthProvider)
    : null;
}

function stringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function booleanValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

function providerFromRecord(record: Record<string, unknown>) {
  return (
    asProvider(record.id) ??
    asProvider(record.provider) ??
    asProvider(record.provider_id) ??
    asProvider(record.oauth_provider_id) ??
    asProvider(record.name)
  );
}

function isProviderExplicitlyDisabled(record: Record<string, unknown>) {
  if (booleanValue(record, "enabled") === false) return true;
  if (booleanValue(record, "active") === false) return true;
  if (booleanValue(record, "configured") === false) return true;
  if (booleanValue(record, "disabled") === true) return true;

  const status = stringValue(record, "status").toLowerCase();
  return ["disabled", "inactive", "missing", "not_configured", "unconfigured"].includes(status);
}

function isProviderConfigured(record: Record<string, unknown>) {
  if (isProviderExplicitlyDisabled(record)) return false;
  if (booleanValue(record, "enabled") === true) return true;
  if (booleanValue(record, "active") === true) return true;
  if (booleanValue(record, "configured") === true) return true;
  if (booleanValue(record, "client_secret_set") === true) return true;
  if (booleanValue(record, "clientSecretSet") === true) return true;
  if (booleanValue(record, "has_client_secret") === true) return true;
  if (stringValue(record, "client_id")) return true;
  if (stringValue(record, "clientId")) return true;

  const status = stringValue(record, "status").toLowerCase();
  if (["enabled", "active", "ready", "configured"].includes(status)) return true;

  return providerFromRecord(record) !== null;
}

function collectConfiguredProviders(value: unknown, providers: Set<NeonAuthOAuthProvider>) {
  if (Array.isArray(value)) {
    for (const entry of value) collectConfiguredProviders(entry, providers);
    return;
  }

  if (!isRecord(value)) return;

  const provider = providerFromRecord(value);
  if (provider && isProviderConfigured(value)) providers.add(provider);

  for (const entry of Object.values(value)) {
    if (Array.isArray(entry) || isRecord(entry)) collectConfiguredProviders(entry, providers);
  }
}

export function extractConfiguredNeonAuthOAuthProviders(payload: unknown): NeonAuthOAuthProvider[] {
  const providers = new Set<NeonAuthOAuthProvider>();
  collectConfiguredProviders(payload, providers);
  return NEON_AUTH_OAUTH_PROVIDERS.filter((provider) => providers.has(provider));
}

export function parseManualNeonAuthOAuthProviders(raw?: string | null): NeonAuthOAuthProvider[] {
  if (!raw?.trim()) return [];

  const providers = new Set<NeonAuthOAuthProvider>();
  for (const entry of raw.split(",")) {
    const provider = asProvider(entry);
    if (provider) providers.add(provider);
  }

  return NEON_AUTH_OAUTH_PROVIDERS.filter((provider) => providers.has(provider));
}

export function toOAuthProviderOptions(providers: NeonAuthOAuthProvider[]): OAuthProviderOption[] {
  return providers.map((id) => ({ id, label: PROVIDER_LABELS[id] }));
}

function defaultUiProviders() {
  return [...DEFAULT_UI_PROVIDERS];
}

export async function getVerifiedNeonAuthOAuthProviders(fetchImpl: FetchLike = fetch): Promise<NeonAuthOAuthProvider[]> {
  const manualUiProviders = parseManualNeonAuthOAuthProviders(env("NEON_AUTH_OAUTH_UI_PROVIDERS"));
  if (manualUiProviders.length) return manualUiProviders;

  const manualEnabledProviders = parseManualNeonAuthOAuthProviders(env("NEON_AUTH_ENABLED_OAUTH_PROVIDERS"));
  if (manualEnabledProviders.length) return manualEnabledProviders;

  const apiKey = env("NEON_API_KEY");
  const authBaseUrl = env("NEON_AUTH_BASE_URL");
  if (!apiKey || !authBaseUrl) return defaultUiProviders();

  const projectId = env("NEON_PROJECT_ID", DEFAULT_PROJECT_ID);
  const branchId = env("NEON_BRANCH_ID", DEFAULT_BRANCH_ID);
  const url = new URL(
    `/api/v2/projects/${projectId}/branches/${branchId}/auth/oauth_providers`,
    "https://console.neon.tech",
  );

  try {
    const response = await fetchImpl(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) return defaultUiProviders();
    const configuredProviders = extractConfiguredNeonAuthOAuthProviders(await response.json());
    return configuredProviders.length ? configuredProviders : defaultUiProviders();
  } catch {
    return defaultUiProviders();
  }
}
