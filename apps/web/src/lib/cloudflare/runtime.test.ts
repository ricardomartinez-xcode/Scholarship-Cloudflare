import { afterEach, describe, expect, it } from "vitest";

import { isCloudflareRuntime } from "./runtime";

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  CLOUDFLARE_BUILD: process.env.CLOUDFLARE_BUILD,
  POSTGRES_COMPAT_RUNTIME: process.env.POSTGRES_COMPAT_RUNTIME,
};

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe("legacy PostgreSQL compatibility runtime", () => {
  it("never treats Vercel as a Cloudflare runtime", () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL = "1";
    process.env.NEXT_PUBLIC_APP_ENV = "cloudflare";
    process.env.CLOUDFLARE_BUILD = "1";
    process.env.POSTGRES_COMPAT_RUNTIME = "1";

    expect(isCloudflareRuntime()).toBe(false);
  });

  it("can be enabled explicitly for local migration diagnostics", () => {
    process.env.NODE_ENV = "test";
    process.env.POSTGRES_COMPAT_RUNTIME = "1";

    expect(isCloudflareRuntime()).toBe(true);
  });

  it("uses the standard PostgreSQL path by default", () => {
    process.env.NODE_ENV = "development";
    delete process.env.POSTGRES_COMPAT_RUNTIME;

    expect(isCloudflareRuntime()).toBe(false);
  });
});
