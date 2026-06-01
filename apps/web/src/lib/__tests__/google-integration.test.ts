import { describe, expect, it } from "vitest";

import {
  buildGoogleConnectUrl,
  buildGoogleServiceStates,
  parseGoogleCallbackState,
  parseGoogleState,
} from "@/lib/google-integration";

describe("google integration helpers", () => {
  it("construye una URL OAuth con state consistente", () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://example.com/api/integrations/google/callback";
    process.env.GOOGLE_INTEGRATION_SECRET = "state-secret";

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

    const callbackState = parseGoogleCallbackState(String(url.searchParams.get("state")));
    expect(callbackState.signed).toBe(true);
    expect(callbackState.validSignature).toBe(true);
    expect(callbackState.expired).toBe(false);
  });

  it("marca inválido un state firmado si se modifica", () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://example.com/api/integrations/google/callback";
    process.env.GOOGLE_INTEGRATION_SECRET = "state-secret";

    const url = new URL(
      buildGoogleConnectUrl({
        userId: "user-1",
        nextPath: "/unidep",
      }),
    );
    const payload = JSON.parse(
      Buffer.from(String(url.searchParams.get("state")), "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    payload.userId = "user-2";
    const tamperedState = Buffer.from(JSON.stringify(payload)).toString("base64url");

    const parsed = parseGoogleCallbackState(tamperedState);

    expect(parsed.signed).toBe(true);
    expect(parsed.validSignature).toBe(false);
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

  it("solicita Sheets al conectar contactos para crear la hoja del usuario", () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://example.com/api/integrations/google/callback";
    process.env.GOOGLE_INTEGRATION_SECRET = "state-secret";

    const url = new URL(
      buildGoogleConnectUrl({
        userId: "user-1",
        nextPath: "/unidep/contactos",
        service: "contacts",
        intent: "contacts_sync",
      }),
    );
    const scope = url.searchParams.get("scope") ?? "";

    expect(scope).toContain("https://www.googleapis.com/auth/spreadsheets");
    expect(scope).toContain("https://www.googleapis.com/auth/contacts.readonly");
  });
});
