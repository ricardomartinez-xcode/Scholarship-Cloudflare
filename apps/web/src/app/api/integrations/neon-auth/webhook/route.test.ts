import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NextRequest } from "next/server";

import { GET, POST } from "./route";

const ORIGINAL_ENV = { ...process.env };
const SECRET = "whsec_" + Buffer.from("test-neon-auth-svix-secret").toString("base64");

function signSvixPayload({ id, timestamp, rawBody }: { id: string; timestamp: string; rawBody: string }) {
  const digest = createHmac("sha256", Buffer.from(SECRET.slice("whsec_".length), "base64"))
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");

  return `v1,${digest}`;
}

function buildSvixRequest(rawBody: string, signature = signSvixPayload({ id: "msg_123", timestamp: "1", rawBody })) {
  return new Request("https://recalc.relead.com.mx/api/integrations/neon-auth/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": "msg_123",
      "svix-timestamp": "1",
      "svix-signature": signature,
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
    process.env.NEON_AUTH_WEBHOOK_SECRET = SECRET;
    delete process.env.NEON_AUTH_WEBHOOK_FORWARD_URL;
    delete process.env.NEON_AUTH_WEBHOOK_VERIFY_SIGNATURE;
    delete process.env.NEON_AUTH_BASE_URL;
    delete process.env.NEON_AUTH_JWKS_URL;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it("accepts valid Svix-signed Neon Auth deliveries", async () => {
    const rawBody = JSON.stringify({ event: "user.created" });

    const response = await POST(buildSvixRequest(rawBody));

    await expect(response.json()).resolves.toEqual({ ok: true, event: "user.created", forwarded: false });
    expect(response.status).toBe(200);
  });

  it("rejects Svix-signed deliveries when the signature does not match", async () => {
    const rawBody = JSON.stringify({ event: "user.created" });

    const response = await POST(buildSvixRequest(rawBody, "v1,invalid"));

    await expect(response.json()).resolves.toEqual({ ok: false, error: "Invalid Neon Auth Svix webhook signature." });
    expect(response.status).toBe(400);
  });

  it("reports when the Svix webhook secret is configured", async () => {
    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      verificationEnabled: true,
      svixSecretConfigured: true,
      jwksConfigured: false,
    });
  });
});
