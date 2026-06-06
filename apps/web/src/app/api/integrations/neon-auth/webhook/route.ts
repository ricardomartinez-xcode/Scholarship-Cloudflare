import { NextRequest, NextResponse } from "next/server";

import { sendMail } from "@/lib/mailer";
import { recordNeonAuthEvent } from "@/lib/neon-auth-event-log";
import { getSmtpStatus } from "@/lib/smtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELIVERY_EVENTS = new Set(["send.otp", "send.magic_link"]);

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function findByKey(value: unknown, keys: Set<string>, depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 6) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findByKey(item, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (keys.has(key.replace(/[-_\s]/g, "").toLowerCase())) {
      const found = text(entry);
      if (found) return found;
    }
  }
  for (const entry of Object.values(value as Record<string, unknown>)) {
    const found = findByKey(entry, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

function eventName(payload: Record<string, unknown>) {
  return text(payload.event) ?? text(payload.type) ?? text(payload.event_type) ?? "unknown";
}

function publicBaseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? "https://recalc.relead.com.mx").replace(/\/+$/, "");
}

function normalizeLink(link: string) {
  if (/^https?:\/\//i.test(link)) return link;
  if (link.startsWith("/")) return `${publicBaseUrl()}${link}`;
  return link;
}

function extractEmail(payload: Record<string, unknown>) {
  return findByKey(payload, new Set(["email", "to", "recipientemail", "emailaddress"]));
}

function extractOtp(payload: Record<string, unknown>) {
  return findByKey(payload, new Set(["otp", "code", "verificationcode", "token"]));
}

function extractMagicLink(payload: Record<string, unknown>) {
  return findByKey(payload, new Set(["url", "link", "href", "magiclink", "verificationurl", "callbackurl"]));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailLayout(title: string, intro: string, body: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden"><tr><td style="background:#0f172a;color:#fff;padding:20px 28px;font-weight:700">ReCalc</td></tr><tr><td style="padding:28px"><h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1><p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 20px">${escapeHtml(intro)}</p>${body}</td></tr><tr><td style="background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6;padding:18px 28px">Si no solicitaste este correo, puedes ignorarlo.</td></tr></table></td></tr></table></body></html>`;
}

async function deliverAuthEmail(event: string, payload: Record<string, unknown>) {
  const smtp = getSmtpStatus();
  if (!smtp.ok) return false;

  const to = extractEmail(payload);
  if (!to) throw new Error("delivery_email_missing");

  if (event === "send.otp") {
    const otp = extractOtp(payload);
    if (!otp) throw new Error("delivery_otp_missing");
    await sendMail({
      to,
      subject: "Tu codigo de acceso a ReCalc",
      text: `Tu codigo de acceso es: ${otp}\n\nSi no solicitaste este codigo, ignora este correo.`,
      html: emailLayout(
        "Tu codigo de acceso a ReCalc",
        "Usa este codigo para continuar con tu autenticacion.",
        `<div style="display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px 22px;color:#065f46;font-size:28px;font-weight:800;letter-spacing:.18em">${escapeHtml(otp)}</div>`,
      ),
    });
    return true;
  }

  const link = extractMagicLink(payload);
  if (!link) throw new Error("delivery_magic_link_missing");
  const href = normalizeLink(link);
  await sendMail({
    to,
    subject: "Tu enlace de acceso a ReCalc",
    text: `Abre este enlace para continuar con tu autenticacion en ReCalc:\n${href}\n\nSi no solicitaste este enlace, ignora este correo.`,
    html: emailLayout(
      "Tu enlace de acceso a ReCalc",
      "Abre este enlace para continuar con tu autenticacion.",
      `<a href="${escapeHtml(href)}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:10px">Entrar a ReCalc</a><p style="margin-top:18px;color:#64748b;font-size:12px;line-height:1.6;word-break:break-all">${escapeHtml(href)}</p>`,
    ),
  });
  return true;
}

export async function GET() {
  const smtp = getSmtpStatus();
  return NextResponse.json({
    ok: true,
    service: "neon-auth-legacy-webhook",
    mode: "legacy_invitation_neon_auth_only",
    smtpDeliveryConfigured: smtp.ok,
    forwardingEnabled: false,
    jwksVerificationEnabled: false,
  });
}

export async function POST(request: NextRequest) {
  let payload: Record<string, unknown> = {};
  let event = "unknown";
  let delivered = false;

  try {
    payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    event = eventName(payload);

    if (event === "user.before_create") {
      recordNeonAuthEvent({ event, payload, forwarded: false, ok: true });
      return NextResponse.json({ allowed: true });
    }

    if (DELIVERY_EVENTS.has(event)) {
      delivered = await deliverAuthEmail(event, payload);
    }

    recordNeonAuthEvent({ event, payload, forwarded: false, ok: true });
    return NextResponse.json({ ok: true, event, delivered, mode: "legacy_invitation_neon_auth_only" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Neon Auth webhook request.";
    recordNeonAuthEvent({ event, payload, forwarded: false, ok: false, error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
