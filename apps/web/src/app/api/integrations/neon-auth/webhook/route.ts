import { NextRequest, NextResponse } from "next/server";
import { createHmac, createPublicKey, timingSafeEqual, verify, type JsonWebKey } from "node:crypto";

import { sendMail } from "@/lib/mailer";
import { recordNeonAuthEvent } from "@/lib/neon-auth-event-log";
import { getSmtpStatus } from "@/lib/smtp";

export const runtime = "nodejs";

const DELIVERY_EVENTS = new Set(["send.otp", "send.magic_link"]);
type DeliveryEvent = "send.otp" | "send.magic_link";

const EMAIL_KEYS = new Set(["email", "to", "recipientemail", "emailaddress"]);
const OTP_KEYS = new Set(["otp", "code", "verificationcode", "token"]);
const MAGIC_LINK_KEYS = new Set([
  "url",
  "link",
  "href",
  "magiclink",
  "verificationurl",
  "callbackurl",
]);

function isDeliveryEvent(event: string): event is DeliveryEvent {
  return DELIVERY_EVENTS.has(event);
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function keyId(value: string) {
  return value.replace(/[-_\s]/g, "").toLowerCase();
}

function valueAtPath(payload: Record<string, unknown>, path: string[]) {
  let current: unknown = payload;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return textValue(current);
}

function firstPathValue(payload: Record<string, unknown>, paths: string[][]) {
  for (const path of paths) {
    const value = valueAtPath(payload, path);
    if (value) return value;
  }
  return null;
}

function findStringByKey(value: unknown, keys: Set<string>, depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 6) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findStringByKey(item, keys, depth + 1);
      if (match) return match;
    }
    return null;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (keys.has(keyId(key))) {
      const text = textValue(entry);
      if (text) return text;
    }
  }

  for (const entry of Object.values(value)) {
    const match = findStringByKey(entry, keys, depth + 1);
    if (match) return match;
  }
  return null;
}

function extractDeliveryEmail(payload: Record<string, unknown>) {
  return (
    firstPathValue(payload, [
      ["email"],
      ["to"],
      ["data", "email"],
      ["data", "user", "email"],
      ["payload", "email"],
      ["payload", "user", "email"],
      ["user", "email"],
    ]) ?? findStringByKey(payload, EMAIL_KEYS)
  );
}

function extractOtp(payload: Record<string, unknown>) {
  return (
    firstPathValue(payload, [
      ["otp"],
      ["code"],
      ["token"],
      ["data", "otp"],
      ["data", "code"],
      ["data", "token"],
      ["payload", "otp"],
      ["payload", "code"],
      ["payload", "token"],
    ]) ?? findStringByKey(payload, OTP_KEYS)
  );
}

function extractMagicLink(payload: Record<string, unknown>) {
  return (
    firstPathValue(payload, [
      ["url"],
      ["link"],
      ["magicLink"],
      ["magic_link"],
      ["data", "url"],
      ["data", "link"],
      ["data", "magicLink"],
      ["data", "magic_link"],
      ["payload", "url"],
      ["payload", "link"],
      ["payload", "magicLink"],
      ["payload", "magic_link"],
    ]) ?? findStringByKey(payload, MAGIC_LINK_KEYS)
  );
}

function extractPurpose(payload: Record<string, unknown>) {
  return firstPathValue(payload, [
    ["type"],
    ["purpose"],
    ["data", "type"],
    ["data", "purpose"],
    ["payload", "type"],
    ["payload", "purpose"],
  ]);
}

function publicBaseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? "https://recalc.relead.com.mx").replace(/\/+$/, "");
}

function normalizeLink(link: string) {
  if (/^https?:\/\//i.test(link)) return link;
  if (link.startsWith("/")) return `${publicBaseUrl()}${link}`;
  return link;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function authEmailLayout(params: {
  title: string;
  intro: string;
  actionHtml: string;
  fallbackText?: string;
}) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background-color:#0f172a;padding:20px 28px;color:#ffffff;font-weight:700;">ReCalc</td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 12px 0;color:#0f172a;font-size:20px;line-height:1.3;">${escapeHtml(params.title)}</h1>
              <p style="margin:0 0 20px 0;color:#475569;font-size:14px;line-height:1.65;">${escapeHtml(params.intro)}</p>
              ${params.actionHtml}
              ${params.fallbackText ? `<p style="margin:18px 0 0 0;color:#64748b;font-size:12px;line-height:1.6;">${params.fallbackText}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#f8fafc;color:#64748b;font-size:12px;line-height:1.6;">
              Si no solicitaste este correo, puedes ignorarlo.<br />
              © ${year} ReCalc · ReLead
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOtpEmail(otp: string, purpose: string | null) {
  const safeOtp = escapeHtml(otp);
  const purposeText = purpose ? ` para ${purpose}` : "";
  return {
    subject: "Tu codigo de acceso a ReCalc",
    text: `Tu codigo de acceso${purposeText} es: ${otp}

Si no solicitaste este codigo, puedes ignorar este correo.
`,
    html: authEmailLayout({
      title: "Tu codigo de acceso a ReCalc",
      intro: `Usa este codigo${purposeText} para continuar con tu autenticacion.`,
      actionHtml: `<div style="display:inline-block;background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px 22px;color:#065f46;font-size:28px;font-weight:800;letter-spacing:.18em;">${safeOtp}</div>`,
    }),
  };
}

function buildMagicLinkEmail(link: string) {
  const safeLink = escapeHtml(normalizeLink(link));
  return {
    subject: "Tu enlace de acceso a ReCalc",
    text: `Abre este enlace para continuar con tu autenticacion en ReCalc:
${normalizeLink(link)}

Si no solicitaste este enlace, puedes ignorar este correo.
`,
    html: authEmailLayout({
      title: "Tu enlace de acceso a ReCalc",
      intro: "Abre este enlace para continuar con tu autenticacion.",
      actionHtml: `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background-color:#059669;"><a href="${safeLink}" style="display:inline-block;background-color:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:10px;">Entrar a ReCalc</a></td></tr></table>`,
      fallbackText: `Si el boton no funciona, copia y pega este enlace en tu navegador:<br /><a href="${safeLink}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">${safeLink}</a>`,
    }),
  };
}

async function deliverAuthEmail(event: DeliveryEvent, payload: Record<string, unknown>) {
  if (!getSmtpStatus().ok) return false;

  const email = extractDeliveryEmail(payload);
  if (!email) throw new Error("delivery_email_missing");

  const emailPayload =
    event === "send.otp"
      ? (() => {
          const otp = extractOtp(payload);
          if (!otp) throw new Error("delivery_otp_missing");
          return buildOtpEmail(otp, extractPurpose(payload));
        })()
      : (() => {
          const link = extractMagicLink(payload);
          if (!link) throw new Error("delivery_magic_link_missing");
          return buildMagicLinkEmail(link);
        })();

  await sendMail({
    to: email,
    subject: emailPayload.subject,
    text: emailPayload.text,
    html: emailPayload.html,
  });

  return true;
}

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
    smtpDeliveryConfigured: getSmtpStatus().ok,
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let payload: Record<string, unknown> = {};
  let event = "unknown";
  let forwarded = false;
  let delivered = false;

  try {
    await verifyNeonSignature(request, rawBody);
    payload = JSON.parse(rawBody) as Record<string, unknown>;
    event = eventName(payload);
    forwarded = await forwardEvent(event, rawBody);

    if (isDeliveryEvent(event) && !forwarded) {
      delivered = await deliverAuthEmail(event, payload);
    }

    if (isDeliveryEvent(event) && !forwarded && !delivered && process.env.NEON_AUTH_WEBHOOK_ALLOW_UNHANDLED_DELIVERY !== "true") {
      recordNeonAuthEvent({ event, payload, forwarded, ok: false, error: "delivery_handler_not_configured" });
      return NextResponse.json({ ok: false, error: "delivery_handler_not_configured" }, { status: 501 });
    }

    recordNeonAuthEvent({ event, payload, forwarded, ok: true });

    if (event === "user.before_create") {
      return NextResponse.json({ allowed: true });
    }

    console.info("Neon Auth webhook received:", { event, forwarded, delivered });
    return NextResponse.json({ ok: true, event, forwarded, delivered });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Neon Auth webhook request.";
    recordNeonAuthEvent({ event, payload, forwarded, ok: false, error: message });
    console.error("Neon Auth webhook rejected:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
