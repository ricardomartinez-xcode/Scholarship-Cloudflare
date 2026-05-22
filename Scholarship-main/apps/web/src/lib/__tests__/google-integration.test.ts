import { describe, expect, it } from "vitest";

import {
  buildGoogleConnectUrl,
  buildGoogleServiceStates,
  parseGoogleState,
} from "@/lib/google-integration";

describe("google integration helpers", () => {
  it("construye una URL OAuth con state consistente", () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://example.com/api/integrations/google/callback";

    const url = new URL(
      buildGoogleConnectUrl({
        userId: "user-1",
        nextPath: "/unidep",
        service: "agenda",
        intent: "agenda_sync",
      }),
    );

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.com/api/integrations/google/callback",
    );
    expect(url.searchParams.get("scope")).toContain("calendar.events");

    const parsed = parseGoogleState(String(url.searchParams.get("state")));
    expect(parsed).toEqual({
      userId: "user-1",
      nextPath: "/unidep",
      intent: "agenda_sync",
      service: "agenda",
    });
  });

  it("deriva estados de scopes por servicio", () => {
    const states = buildGoogleServiceStates([
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.events",
    ]);

    expect(states.find((service) => service.key === "identity")?.connected).toBe(true);
    expect(states.find((service) => service.key === "calendar")?.connected).toBe(true);
    expect(states.find((service) => service.key === "tasks")?.connected).toBe(false);
  });
});
