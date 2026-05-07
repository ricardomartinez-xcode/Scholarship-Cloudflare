import "server-only";

import { createHmac } from "node:crypto";

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getRealtimeJwtSecret() {
  const secret = process.env.SUPABASE_REALTIME_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "SUPABASE_REALTIME_JWT_SECRET is required to use private Supabase Realtime channels.",
    );
  }

  return secret;
}

export function createRealtimeAccessToken(input: {
  sub: string;
  email: string;
  topics: string[];
  expiresInSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: "authenticated",
    role: "authenticated",
    sub: input.sub,
    email: input.email,
    realtime_topics: Array.from(new Set(input.topics)).sort(),
    iat: now,
    exp: now + (input.expiresInSeconds ?? 60 * 30),
  };

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", getRealtimeJwtSecret())
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}
