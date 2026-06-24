import { describe, expect, it } from "vitest";

import {
  classifyNeonAuthSignInFailure,
  createNeonAuthSessionMissingFailure,
  createNeonAuthUnreachableFailure,
} from "@/lib/extension-auth-errors";

describe("classifyNeonAuthSignInFailure", () => {
  it("keeps invalid credentials as a 401", () => {
    expect(classifyNeonAuthSignInFailure(401)).toMatchObject({
      status: 401,
      code: "invalid_credentials",
    });
  });

  it("preserves a provider authorization rejection as a 403", () => {
    expect(classifyNeonAuthSignInFailure(403)).toMatchObject({
      status: 403,
      code: "auth_request_forbidden",
    });
  });

  it("preserves provider rate limits as a 429", () => {
    expect(classifyNeonAuthSignInFailure(429)).toMatchObject({
      status: 429,
      code: "auth_rate_limited",
    });
  });

  it("marks provider timeouts as retryable service failures", () => {
    expect(classifyNeonAuthSignInFailure(504)).toMatchObject({
      status: 503,
      code: "auth_provider_timeout",
    });
  });

  it("maps upstream 5xx responses to a gateway failure", () => {
    expect(classifyNeonAuthSignInFailure(500)).toMatchObject({
      status: 502,
      code: "auth_provider_unavailable",
    });
  });

  it("does not mislabel malformed upstream requests as invalid credentials", () => {
    expect(classifyNeonAuthSignInFailure(404)).toMatchObject({
      status: 502,
      code: "auth_provider_request_failed",
    });
  });
});

describe("Neon Auth extension transport failures", () => {
  it("marks an unreachable provider as retryable", () => {
    expect(createNeonAuthUnreachableFailure()).toMatchObject({
      status: 503,
      code: "auth_provider_unreachable",
    });
  });

  it("marks missing session cookies as a provider response failure", () => {
    expect(createNeonAuthSessionMissingFailure()).toMatchObject({
      status: 502,
      code: "auth_session_missing",
    });
  });
});
