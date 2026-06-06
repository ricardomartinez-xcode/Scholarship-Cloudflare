import { describe, expect, it } from "vitest";

import { GET, POST } from "./route";

describe("Google OAuth callback route", () => {
  it("keeps external OAuth callbacks temporarily disabled", async () => {
    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      disabled: true,
      code: "oauth_integrations_temporarily_disabled",
    });
    expect(response.status).toBe(503);
  });

  it("uses the same disabled contract for POST", async () => {
    const response = await POST();

    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      disabled: true,
      code: "oauth_integrations_temporarily_disabled",
    });
    expect(response.status).toBe(503);
  });
});
