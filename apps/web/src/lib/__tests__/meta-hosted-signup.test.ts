import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildMetaHostedSignupUrl,
  createMetaHostedSignupState,
  getMetaHostedSignupRedirectUri,
  verifyMetaHostedSignupState,
} from "@/lib/meta-hosted-signup";

afterEach(() => vi.unstubAllEnvs());

describe("Meta Hosted Embedded Signup", () => {
  it("signs and validates state bound to the user and client session", () => {
    vi.stubEnv("META_INTEGRATION_SECRET", "test-integration-secret");
    const state = createMetaHostedSignupState({ userId: "user-1", clientSessionId: "session-1" });
    expect(verifyMetaHostedSignupState(state)).toEqual({ userId: "user-1", clientSessionId: "session-1" });
    expect(() => verifyMetaHostedSignupState(`${state}tampered`)).toThrow();
  });

  it("builds the hosted v4 onboarding URL with callback and state", () => {
    vi.stubEnv("META_INTEGRATION_SECRET", "test-integration-secret");
    vi.stubEnv("META_APP_ID", "920977560769210");
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID", "1761545308632610");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://recalc.relead.com.mx");
    const url = buildMetaHostedSignupUrl("signed-state");
    expect(url.origin).toBe("https://business.facebook.com");
    expect(url.searchParams.get("app_id")).toBe("920977560769210");
    expect(url.searchParams.get("config_id")).toBe("1761545308632610");
    expect(url.searchParams.get("state")).toBe("signed-state");
    expect(url.searchParams.get("redirect_uri")).toBe(getMetaHostedSignupRedirectUri());
    expect(JSON.parse(url.searchParams.get("extras") ?? "{}")).toMatchObject({
      featureType: "whatsapp_business_app_onboarding",
      version: "v4",
      features: [{ name: "app_only_install" }],
    });
  });
});
