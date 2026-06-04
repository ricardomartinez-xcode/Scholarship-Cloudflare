import { afterEach, describe, expect, it } from "vitest";

import {
  extractConfiguredNeonAuthOAuthProviders,
  getVerifiedNeonAuthOAuthProviders,
  parseManualNeonAuthOAuthProviders,
  toOAuthProviderOptions,
} from "@/lib/neon-auth-oauth";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Neon Auth OAuth provider helpers", () => {
  it("extracts only supported configured providers from Neon API payloads", () => {
    const providers = extractConfiguredNeonAuthOAuthProviders({
      oauth_providers: [
        { id: "google", client_id: "google-client" },
        { id: "github", enabled: false, client_id: "github-client" },
        { id: "facebook", client_id: "facebook-client" },
        { provider_id: "vercel", configured: true },
      ],
    });

    expect(providers).toEqual(["google", "vercel"]);
  });

  it("parses the manual UI provider allow-list defensively", () => {
    expect(parseManualNeonAuthOAuthProviders("google,github,google,facebook,vercel")).toEqual([
      "google",
      "github",
      "vercel",
    ]);
  });

  it("turns provider IDs into UI options", () => {
    expect(toOAuthProviderOptions(["google", "github", "vercel"])).toEqual([
      { id: "google", label: "Google" },
      { id: "github", label: "GitHub" },
      { id: "vercel", label: "Vercel" },
    ]);
  });

  it("uses the manual provider allow-list before the Neon API", async () => {
    process.env.NEON_AUTH_OAUTH_UI_PROVIDERS = "github,google";
    process.env.NEON_AUTH_ENABLED_OAUTH_PROVIDERS = "";

    const providers = await getVerifiedNeonAuthOAuthProviders(async () => {
      throw new Error("fetch should not run when manual providers are configured");
    });

    expect(providers).toEqual(["google", "github"]);
  });

  it("falls back to the secondary manual allow-list when the primary has no supported providers", async () => {
    process.env.NEON_AUTH_OAUTH_UI_PROVIDERS = "facebook";
    process.env.NEON_AUTH_ENABLED_OAUTH_PROVIDERS = "vercel";

    const providers = await getVerifiedNeonAuthOAuthProviders(async () => {
      throw new Error("fetch should not run when fallback manual providers are configured");
    });

    expect(providers).toEqual(["vercel"]);
  });

  it("hides OAuth providers when Neon Auth or Neon API credentials are unavailable", async () => {
    delete process.env.NEON_AUTH_OAUTH_UI_PROVIDERS;
    delete process.env.NEON_AUTH_ENABLED_OAUTH_PROVIDERS;
    delete process.env.NEON_AUTH_BASE_URL;
    delete process.env.NEON_API_KEY;

    const providers = await getVerifiedNeonAuthOAuthProviders(async () => {
      throw new Error("fetch should not run without Neon credentials");
    });

    expect(providers).toEqual([]);
  });
});
