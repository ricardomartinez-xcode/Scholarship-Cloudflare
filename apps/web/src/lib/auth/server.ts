import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

export function getNeonAuthBaseUrl() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
  if (baseUrl) return baseUrl;
  throw new Error(
    "NEON_AUTH_BASE_URL is required. Set it to the Neon Auth URL from Neon Console (https://...neon.tech/.../auth)."
  );
}

function getCookieSecret() {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEON_AUTH_COOKIE_SECRET is required in production.");
  }
  return "dev-cookie-secret-change-me-32-chars-min";
}

function toOrigin(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function getTrustedOrigins(request?: Request) {
  const origins = new Set<string>();

  const addOrigin = (value: string | null | undefined) => {
    const origin = toOrigin(value);
    if (origin) origins.add(origin);
  };

  addOrigin(process.env.NEXT_PUBLIC_BASE_URL);
  addOrigin("https://recalc.relead.com.mx");
  addOrigin("https://scholarship-ochre.vercel.app");
  addOrigin(request?.url);

  const requestUrl = request ? new URL(request.url) : null;
  const requestPort = requestUrl?.port || "3000";
  origins.add(`http://localhost:${requestPort}`);
  origins.add(`http://127.0.0.1:${requestPort}`);
  for (const port of ["3000", "3005", "3006", "3007"]) {
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);
  }

  return Array.from(origins);
}

function ensureTrustedOriginsEnv() {
  const existing = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const merged = new Set<string>(existing);
  for (const origin of getTrustedOrigins()) {
    merged.add(origin);
  }

  process.env.BETTER_AUTH_TRUSTED_ORIGINS = Array.from(merged).join(",");
}

let authInstance: ReturnType<typeof createNeonAuth> | null = null;

function getAuthInstance() {
  if (authInstance) return authInstance;
  ensureTrustedOriginsEnv();
  authInstance = createNeonAuth({
    baseUrl: getNeonAuthBaseUrl(),
    cookies: {
      secret: getCookieSecret(),
    },
  });
  return authInstance;
}

export const auth = new Proxy({} as ReturnType<typeof createNeonAuth>, {
  get(_target, property, receiver) {
    const instance = getAuthInstance();
    const value = Reflect.get(instance, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
