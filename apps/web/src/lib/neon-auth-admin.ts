import "server-only";

import { getSmtpStatus } from "@/lib/smtp";

const DEFAULT_PROJECT_ID = "jolly-king-13100259";
const DEFAULT_BRANCH_ID = "br-old-mountain-ai239lh2";
const DEFAULT_WEBHOOK_PATH = "/api/integrations/neon-auth/webhook";
const DEFAULT_EVENTS = [
  "user.created",
  "organization.invitation.created",
  "organization.invitation.accepted",
  "phone.number.verified",
];

export type NeonAuthAdminStatus = {
  projectId: string;
  branchId: string;
  webhookUrl: string;
  env: Record<string, boolean>;
  health: unknown;
  webhookConfig: unknown;
  oauthProviders: unknown;
  authPlugins: unknown;
  errors: string[];
};

function env(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function projectId() {
  return env("NEON_PROJECT_ID", DEFAULT_PROJECT_ID);
}

function branchId() {
  return env("NEON_BRANCH_ID", DEFAULT_BRANCH_ID);
}

function configuredWebhookUrl(origin?: string) {
  const explicit = env("NEON_AUTH_WEBHOOK_URL");
  if (explicit) return explicit;
  const siteUrl = env("NEXT_PUBLIC_SITE_URL") || env("VERCEL_PROJECT_PRODUCTION_URL");
  if (siteUrl) return siteUrl.startsWith("http") ? `${siteUrl.replace(/\/$/, "")}${DEFAULT_WEBHOOK_PATH}` : `https://${siteUrl}${DEFAULT_WEBHOOK_PATH}`;
  return `${origin?.replace(/\/$/, "") ?? "https://recalc.relead.com.mx"}${DEFAULT_WEBHOOK_PATH}`;
}

function parseEvents(raw?: string | null) {
  if (!raw?.trim()) return DEFAULT_EVENTS;
  return raw
    .split(",")
    .map((event) => event.trim())
    .filter(Boolean);
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /secret|token|key|password/i.test(key) && typeof entry === "string" ? "••••••••" : redact(entry),
    ]),
  );
}

async function neonRequest(path: string, init?: RequestInit) {
  const apiKey = env("NEON_API_KEY");
  if (!apiKey) throw new Error("NEON_API_KEY no está configurado en Vercel.");

  const response = await fetch(`https://console.neon.tech/api/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`Neon API ${response.status}: ${JSON.stringify(redact(payload ?? text))}`);
  }
  return redact(payload);
}

async function optional<T>(label: string, errors: string[], task: () => Promise<T>) {
  try {
    return await task();
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : "falló"}`);
    return null;
  }
}

export async function getNeonAuthAdminStatus(origin?: string): Promise<NeonAuthAdminStatus> {
  const errors: string[] = [];
  const pid = projectId();
  const bid = branchId();
  const webhookUrl = configuredWebhookUrl(origin);

  const health = await optional("health", errors, async () => {
    const response = await fetch(`${origin?.replace(/\/$/, "") ?? ""}${DEFAULT_WEBHOOK_PATH}`, { cache: "no-store" });
    const text = await response.text();
    return { ok: response.ok, status: response.status, body: text ? JSON.parse(text) : null };
  });

  const webhookConfig = await optional("webhook config", errors, () =>
    neonRequest(`/projects/${pid}/branches/${bid}/auth/webhooks`),
  );

  const oauthProviders = await optional("oauth providers", errors, () =>
    neonRequest(`/projects/${pid}/branches/${bid}/auth/oauth_providers`),
  );

  const authPlugins = await optional("auth plugins", errors, () =>
    neonRequest(`/projects/${pid}/branches/${bid}/auth`),
  );

  return {
    projectId: pid,
    branchId: bid,
    webhookUrl,
    env: {
      NEON_API_KEY: Boolean(env("NEON_API_KEY")),
      NEON_AUTH_WEBHOOK_SECRET: Boolean(env("NEON_AUTH_WEBHOOK_SECRET") || env("NEON_AUTH_SVIX_WEBHOOK_SECRET") || env("SVIX_WEBHOOK_SECRET")),
      NEON_AUTH_BASE_URL: Boolean(env("NEON_AUTH_BASE_URL")),
      NEON_AUTH_JWKS_URL: Boolean(env("NEON_AUTH_JWKS_URL")),
      NEON_AUTH_WEBHOOK_FORWARD_URL: Boolean(env("NEON_AUTH_WEBHOOK_FORWARD_URL")),
      SMTP_DELIVERY: getSmtpStatus().ok,
    },
    health,
    webhookConfig,
    oauthProviders,
    authPlugins,
    errors,
  };
}

export async function syncNeonAuthWebhook(origin?: string, events?: string[]) {
  const pid = projectId();
  const bid = branchId();
  const webhookUrl = configuredWebhookUrl(origin);
  const enabledEvents = events?.length ? events : parseEvents(env("NEON_AUTH_WEBHOOK_EVENTS"));
  return neonRequest(`/projects/${pid}/branches/${bid}/auth/webhooks`, {
    method: "PUT",
    body: JSON.stringify({
      enabled: true,
      webhook_url: webhookUrl,
      enabled_events: enabledEvents,
      timeout_seconds: Number(env("NEON_AUTH_WEBHOOK_TIMEOUT_SECONDS", "5")),
    }),
  });
}

export async function updateNeonAuthOAuthProvider(input: {
  provider: string;
  clientId?: string;
  clientSecret?: string;
  microsoftTenantId?: string;
}) {
  const provider = input.provider.trim().toLowerCase();
  if (!provider) throw new Error("provider es requerido.");
  if (!["google", "github", "microsoft", "vercel"].includes(provider)) {
    throw new Error("Provider no soportado. Usa google, github, microsoft o vercel.");
  }

  const body: Record<string, string> = {};
  if (input.clientId?.trim()) body.client_id = input.clientId.trim();
  if (input.clientSecret?.trim()) body.client_secret = input.clientSecret.trim();
  if (input.microsoftTenantId?.trim()) body.microsoft_tenant_id = input.microsoftTenantId.trim();
  if (!Object.keys(body).length) throw new Error("No hay cambios para enviar.");

  return neonRequest(`/projects/${projectId()}/branches/${branchId()}/auth/oauth_providers/${provider}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
