import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  checkRateLimitMock,
  resolveScholarshipQuoteMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  resolveScholarshipQuoteMock: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/scholarship-quote-service", () => ({
  resolveScholarshipQuote: resolveScholarshipQuoteMock,
}));

import { POST } from "./route";

function buildRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/ext/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validPayload() {
  return {
    enrollmentType: "nuevo_ingreso",
    businessLine: "licenciatura",
    modality: "online",
    plan: 9,
    average: 8.7,
  };
}

describe("POST /api/ext/quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.QUOTE_MODE;
    getSessionUserMock.mockResolvedValue({
      status: "ok",
      user: { id: "user_1" },
    });
    checkRateLimitMock.mockReturnValue({ ok: true });
    resolveScholarshipQuoteMock.mockResolvedValue({
      ok: true,
      source: "canonical",
      totalMxn: 1234,
    });
  });

  it("uses canonical quote resolution by default and does not load legacy pricing", async () => {
    const response = await POST(buildRequest(validPayload()));
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.source).toBe("canonical");
    expect(data.modeUsed).toBe("canonical");
    expect(resolveScholarshipQuoteMock).toHaveBeenCalledTimes(1);
  });
});
