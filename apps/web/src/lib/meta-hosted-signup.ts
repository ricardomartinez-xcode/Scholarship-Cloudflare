import { createHmac, timingSafeEqual } from "node:crypto";

const STATE_TTL_SECONDS = 10 * 60;

function getIntegrationSecret() {
  const secret = process.env.META_INTEGRATION_SECRET?.trim();
  if (!secret) throw new Error("META_INTEGRATION_SECRET is required for Hosted Embedded Signup state validation.");
  return secret;
}

function base64url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(value: string) {
  return createHmac("sha256", getIntegrationSecret()).update(value).digest("base64url");
}

export function createMetaHostedSignupState(params: { userId: string; clientSessionId: string }) {
  const payload = base64url(JSON.stringify({
    userId: params.userId,
    clientSessionId: params.clientSessionId,
    issuedAt: Math.floor(Date.now() / 1000),
  }));
  return `${payload}.${sign(payload)}`;
}

export function verifyMetaHostedSignupState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) throw new Error("invalid_meta_oauth_state");
  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error("invalid_meta_oauth_state_signature");
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    userId?: string;
    clientSessionId?: string;
    issuedAt?: number;
  };
  if (!parsed.userId || !parsed.clientSessionId || !parsed.issuedAt) throw new Error("invalid_meta_oauth_state_payload");
  if (Math.floor(Date.now() / 1000) - parsed.issuedAt > STATE_TTL_SECONDS) throw new Error("expired_meta_oauth_state");
  return { userId: parsed.userId, clientSessionId: parsed.clientSessionId };
}

export function getMetaHostedSignupRedirectUri() {
  const configured = process.env.META_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) throw new Error("META_OAUTH_REDIRECT_URI or NEXT_PUBLIC_APP_URL is required.");
  return new URL("/api/integrations/meta/oauth/callback", appUrl).toString();
}

export function buildMetaHostedSignupUrl(state: string) {
  const configured = process.env.META_WHATSAPP_HOSTED_SIGNUP_URL?.trim();
  const appId = process.env.META_APP_ID?.trim();
  const configId = process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID?.trim();
  if (!appId || !configId) throw new Error("META_APP_ID and NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID are required.");

  const url = configured
    ? new URL(configured)
    : new URL("https://business.facebook.com/messaging/whatsapp/onboard/");

  url.searchParams.set("app_id", appId);
  url.searchParams.set("config_id", configId);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", getMetaHostedSignupRedirectUri());

  if (!url.searchParams.has("extras")) {
    url.searchParams.set("extras", JSON.stringify({
      setup: {
        business: { id: null, phone: {}, address: {}, timezone: null },
        phone: { category: null, description: "" },
      },
      featureType: "whatsapp_business_app_onboarding",
      sessionInfoVersion: "3",
      version: "v4",
      features: [{ name: "app_only_install" }],
    }));
  }
  return url;
}
