import { describe, expect, it } from "vitest";

import { GET, POST } from "./route";

describe("Google OAuth callback disabled route", () => {
  it("returns the temporary disabled response for GET", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      disabled: true,
      code: "oauth_integrations_temporarily_disabled",
    });
  });

  it("returns the temporary disabled response for POST", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      disabled: true,
      code: "oauth_integrations_temporarily_disabled",
    });
  });
});
