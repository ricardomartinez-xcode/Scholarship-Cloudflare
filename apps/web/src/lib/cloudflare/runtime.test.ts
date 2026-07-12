import { afterEach, describe, expect, it, vi } from "vitest";

import { isCloudflareRuntime } from "./runtime";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("legacy PostgreSQL compatibility runtime", () => {
  it("never treats Vercel as a Cloudflare runtime", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "cloudflare");
    vi.stubEnv("CLOUDFLARE_BUILD", "1");
    vi.stubEnv("POSTGRES_COMPAT_RUNTIME", "1");

    expect(isCloudflareRuntime()).toBe(false);
  });

  it("can be enabled explicitly for local migration diagnostics", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("POSTGRES_COMPAT_RUNTIME", "1");

    expect(isCloudflareRuntime()).toBe(true);
  });

  it("uses the standard PostgreSQL path by default", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("POSTGRES_COMPAT_RUNTIME", "");

    expect(isCloudflareRuntime()).toBe(false);
  });
});
