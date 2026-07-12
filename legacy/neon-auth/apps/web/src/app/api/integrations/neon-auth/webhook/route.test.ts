import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NextRequest } from "next/server";

const sendMailMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mailer", () => ({
  sendMail: sendMailMock,
}));

import { GET, POST } from "./route";

const ORIGINAL_ENV = { ...process.env };

function buildWebhookRequest(rawBody: string) {
  return new Request("https://recalc.relead.com.mx/api/integrations/neon-auth/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: rawBody,
  }) as NextRequest;
}

describe("Neon Auth webhook route", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("1970-01-01T00:00:01Z"));
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEON_AUTH_WEBHOOK_SECRET;
    delete process.env.NEON_AUTH_WEBHOOK_FORWARD_URL;
    delete process.env.NEON_AUTH_WEBHOOK_VERIFY_SIGNATURE;
    delete process.env.NEON_AUTH_BASE_URL;
    delete process.env.NEON_AUTH_JWKS_URL;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    sendMailMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("allows Neon Auth account creation events in legacy mode", async () => {
    const rawBody = JSON.stringify({ event: "user.before_create" });

    const response = await POST(buildWebhookRequest(rawBody));

    await expect(response.json()).resolves.toEqual({ allowed: true });
    expect(response.status).toBe(200);
  });

  it("recognizes Neon Auth event_type account creation hooks", async () => {
    const rawBody = JSON.stringify({
      event_type: "user.before_create",
      user: { email: "new-user@unidep.edu.mx" },
    });

    const response = await POST(buildWebhookRequest(rawBody));

    await expect(response.json()).resolves.toEqual({ allowed: true });
    expect(response.status).toBe(200);
  });

  it("records non-delivery events without forwarding in legacy mode", async () => {
    const rawBody = JSON.stringify({ event: "user.created" });

    const response = await POST(buildWebhookRequest(rawBody));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      event: "user.created",
      delivered: false,
      mode: "legacy_invitation_neon_auth_only",
    });
    expect(response.status).toBe(200);
  });

  it("reports legacy Neon Auth webhook mode", async () => {
    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "neon-auth-legacy-webhook",
      mode: "legacy_invitation_neon_auth_only",
      smtpDeliveryConfigured: false,
      forwardingEnabled: false,
      jwksVerificationEnabled: false,
    });
  });

  it("accepts delivery events without SMTP but marks them as not delivered", async () => {
    const rawBody = JSON.stringify({ event_type: "send.magic_link", email: "test@unidep.edu.mx" });

    const response = await POST(buildWebhookRequest(rawBody));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      event: "send.magic_link",
      delivered: false,
      mode: "legacy_invitation_neon_auth_only",
    });
    expect(response.status).toBe(200);
  });

  it("delivers magic link events with the local SMTP handler", async () => {
    process.env.SMTP_HOST = "smtp.recalc.test";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "mailer";
    process.env.SMTP_PASS = "secret";
    process.env.SMTP_FROM = "ReCalc <no-reply@recalc.test>";

    const rawBody = JSON.stringify({
      event: "send.magic_link",
      data: {
        email: "test@unidep.edu.mx",
        url: "https://recalc.relead.com.mx/auth/magic?token=abc",
      },
    });

    const response = await POST(buildWebhookRequest(rawBody));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      event: "send.magic_link",
      delivered: true,
      mode: "legacy_invitation_neon_auth_only",
    });
    expect(response.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@unidep.edu.mx",
        subject: "Tu enlace de acceso a ReCalc",
        html: expect.stringContaining("https://recalc.relead.com.mx/auth/magic?token=abc"),
      }),
    );
  });

  it("delivers OTP events with the local SMTP handler", async () => {
    process.env.SMTP_HOST = "smtp.recalc.test";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "mailer";
    process.env.SMTP_PASS = "secret";
    process.env.SMTP_FROM = "ReCalc <no-reply@recalc.test>";

    const rawBody = JSON.stringify({
      event: "send.otp",
      data: {
        email: "test@unidep.edu.mx",
        otp: "123456",
        type: "sign-in",
      },
    });

    const response = await POST(buildWebhookRequest(rawBody));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      event: "send.otp",
      delivered: true,
      mode: "legacy_invitation_neon_auth_only",
    });
    expect(response.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@unidep.edu.mx",
        subject: "Tu codigo de acceso a ReCalc",
        text: expect.stringContaining("123456"),
      }),
    );
  });

  it("keeps forwarding disabled even when a legacy forward URL is present", async () => {
    process.env.NEON_AUTH_WEBHOOK_FORWARD_URL = "https://hooks.recalc.test/neon-auth";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const rawBody = JSON.stringify({ event: "send.otp", email: "test@unidep.edu.mx" });

    const response = await POST(buildWebhookRequest(rawBody));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      event: "send.otp",
      delivered: false,
      mode: "legacy_invitation_neon_auth_only",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
