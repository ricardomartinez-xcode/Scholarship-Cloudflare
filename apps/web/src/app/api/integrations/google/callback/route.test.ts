import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@/lib/api-auth", () => ({
  getAdminAccessApiUser: vi.fn(async () => ({
    ok: true,
    admin: { id: "admin_1", email: "admin@example.test" },
  })),
}));

vi.mock("@/lib/google-cloudflare-oauth", () => ({
  getGoogleOAuthConfiguration: vi.fn(() => ({
    configured: false,
    missing: ["GOOGLE_CLIENT_ID"],
  })),
  cancelGoogleOAuth: vi.fn(),
  completeGoogleOAuth: vi.fn(),
  withGoogleOAuthStatus: vi.fn((returnTo: string, status: string) => `${returnTo}?google=${status}`),
}));

describe("Google OAuth callback route", () => {
  it("returns a 503 response when Google OAuth is not configured", async () => {
    const response = await GET(
      new Request("https://example.test/api/integrations/google/callback?state=state_1&code=code_1"),
    );

    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "google_oauth_not_configured",
      missing: ["GOOGLE_CLIENT_ID"],
    });
    expect(response.status).toBe(503);
  });
});
