import { NextRequest, NextResponse } from "next/server";
import { createHmac, createPublicKey, timingSafeEqual, verify, type JsonWebKey } from "node:crypto";

import { recordNeonAuthEvent } from "@/lib/neon-auth-event-log";

export const runtime = "nodejs";

const DELIVERY_EVENTS = new Set(["send.otp", "send.magic_link"]);

function b64u(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64uDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "="), "base64");
}

function header(request: NextRequest, names: string[]) {
  for (const name of names) {
    const value = request.headers.get(name);
    if (value) return value;
  }
  return null;
}

function jwksUrl() {
  const explicit = process.env.NEON_AUTH_JWKS_URL?.trim();
  if (explicit) return explicit;
  const base = process.env.NEON_AUTH_BASE_URL?.trim().replace(/\/$/, "");
  return base ? `${base}/.well-known/jwks.json` : null;
}

function timestampSeconds(value: string | null) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric > 9_999_999_999 ? Math.floor(numeric / 1000) : Math.floor(numeric);
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

function webhookSecret() {
  return (
    process.env.NEON_AUTH_WEBHOOK_SECRET?.trim() ||
    process.env.NEON_AUTH_SVIX_WEBHOOK_SECRET?.trim() ||
    process.env.SVIX_WEBHOOK_SECRET?.trim() ||
    null
  );
}

function decodeSvixSecret(secret: string) {
  const encoded = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Buffer.from(encoded, "base64");
}

function verifySvixSignature(request: NextRequest, rawBody: string) {
  const id = header(request, ["svix-id", "webhook-id"]);
  const timestampHeader = header(request, ["svix-timestamp", "webhook-timestamp"]);
  const signatureHeader = header(request, ["svix-signature", "webhook-signature"]);

  if (!id && !timestampHeader && !signatureHeader) return false;
  if (!id || !timestampHeader || !signatureHeader) throw new Error("Missing Neon Auth Svix webhook signature headers.");

  const timestamp = timestampSeconds(timestampHeader);
  if (!timestamp) throw new Error("Invalid Neon Auth Svix webhook timestamp.");

  const maxSkew = Number(process.env.NEON_AUTH_WEBHOOK_MAX_SKEW_SECONDS ?? 300);
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > maxSkew) throw new Error("Expired Neon Auth Svix webhook timestamp.");

  const secret = webhookSecret();
  if (!secret) throw new Error("NEON_AUTH_WEBHOOK_SECRET is required for Svix-signed Neon Auth webhooks.");

  const expected = createHmac("sha256", decodeSvixSecret(secret)).update(`${id}.${timestampHeader}.${rawBody}`).digest();
  const valid = signatureHeader
    .split(/\s+/)
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter((part) => part && part !== "v1")
    .some((part) => {
      const actual = Buffer.from(part, "base64");
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    });

  if (!valid) throw new Error("Invalid Neon Auth Svix webhook signature.");
  return true;
}

async function verifyNeonSignature(request: NextRequest, rawBody: string) {
  if (process.env.NEON_AUTH_WEBHOOK_VERIFY_SIGNATURE === "false") return;
  if (verifySvixSignature(request, rawBody)) return;

  const signature = header(request, ["x-neon-signature", "neon-signature", "x-neon-auth-signature"]);
  if (!signature) throw new Error("Missing Neon Auth webhook signature.");

  const timestamp = timestampSeconds(header(request, ["x-neon-timestamp", "neon-timestamp", "x-neon-auth-timestamp"]));
  if (timestamp) {
    const maxSkew = Number(process.env.NEON_AUTH_WEBHOOK_MAX_SKEW_SECONDS ?? 300);
    const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
    if (age > maxSkew) throw new Error("Expired Neon webhook timestamp.");
  }

  const [protectedHeader, detachedPayload, encodedSignature] = signature.split(".");
  if (!protectedHeader || detachedPayload || !encodedSignature) throw new Error("Invalid Neon detached JWS signature.");

  const url = jwksUrl();
  if (!url) throw new Error("NEON_AUTH_BASE_URL or NEON_AUTH_JWKS_URL is required.");

  const { kid } = JSON.parse(b64uDecode(protectedHeader).toString("utf8")) as { kid?: string };
  const jwks = (await (await fetch(url, { cache: "no-store" })).json()) as { keys?: (Record<string, unknown> & { kid?: string })[] };
  const jwk = jwks.keys?.find((key) => !kid || key.kid === kid);
  if (!jwk) throw new Error("No matching Neon webhook JWKS key.");

  const key = createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });
  const valid = verify(null, Buffer.from(`${protectedHeader}.${b64u(rawBody)}`), key, b64uDecode(encodedSignature));
  if (!valid) throw new Error("Invalid Neon webhook signature.");
}

function eventName(payload: Record<string, unknown>) {
  const event = payload.event ?? payload.type;
  return typeof event === "string" && event.trim() ? event.trim() : "unknown";
}

async function forwardEvent(event: string, rawBody: string) {
  const url = process.env.NEON_AUTH_WEBHOOK_FORWARD_URL?.trim();
  if (!url) return false;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-recalc-integration": "neon-auth",
    "x-neon-auth-event": event,
  };
  const token = process.env.NEON_AUTH_WEBHOOK_FORWARD_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { method: "POST", headers, body: rawBody, cache: "no-store" });
  if (!response.ok) throw new Error(`Forward target failed with ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return true;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "neon-auth-webhook",
    verificationEnabled: process.env.NEON_AUTH_WEBHOOK_VERIFY_SIGNATURE !== "false",
    svixSecretConfigured: Boolean(webhookSecret()),
    jwksConfigured: Boolean(jwksUrl()),
    forwardConfigured: Boolean(process.env.NEON_AUTH_WEBHOOK_FORWARD_URL?.trim()),
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let payload: Record<string, unknown> = {};
  let event = "unknown";
  let forwarded = false;

  try {
    await verifyNeonSignature(request, rawBody);
    payload = JSON.parse(rawBody) as Record<string, unknown>;
    event = eventName(payload);
    forwarded = await forwardEvent(event, rawBody);

    if (DELIVERY_EVENTS.has(event) && !forwarded && process.env.NEON_AUTH_WEBHOOK_ALLOW_UNHANDLED_DELIVERY !== "true") {
      recordNeonAuthEvent({ event, payload, forwarded, ok: false, error: "delivery_handler_not_configured" });
      return NextResponse.json({ ok: false, error: "delivery_handler_not_configured" }, { status: 501 });
    }

    recordNeonAuthEvent({ event, payload, forwarded, ok: true });

    if (event === "user.before_create") {
      return NextResponse.json({ allowed: true });
    }

    console.info("Neon Auth webhook received:", { event, forwarded });
    return NextResponse.json({ ok: true, event, forwarded });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Neon Auth webhook request.";
    recordNeonAuthEvent({ event, payload, forwarded, ok: false, error: message });
    console.error("Neon Auth webhook rejected:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
