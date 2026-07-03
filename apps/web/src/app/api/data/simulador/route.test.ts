import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  isCloudflareRuntimeMock,
  postQuoteHistoryMock,
  saveD1QuoteScenarioForUserMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  isCloudflareRuntimeMock: vi.fn(),
  postQuoteHistoryMock: vi.fn(),
  saveD1QuoteScenarioForUserMock: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  isCloudflareRuntime: isCloudflareRuntimeMock,
}));

vi.mock("@/lib/cloudflare/quote-history", () => ({
  listD1RecentQuoteSessions: vi.fn(),
  saveD1QuoteScenarioForUser: saveD1QuoteScenarioForUserMock,
}));

vi.mock("@/app/api/data/quote-history/route", () => ({
  GET: vi.fn(),
  POST: postQuoteHistoryMock,
}));

import { POST } from "./route";

describe("POST /api/data/simulador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCloudflareRuntimeMock.mockReturnValue(true);
    getSessionUserMock.mockResolvedValue({
      status: "ok",
      user: { id: "user-1" },
    });
    postQuoteHistoryMock.mockResolvedValue(Response.json({ legacy: true }));
  });

  it("does not delegate Cloudflare saves to the Prisma quote-history route", async () => {
    const response = await POST(
      new Request("https://recalc.test/api/data/simulador", {
        method: "POST",
        body: JSON.stringify({ mode: "autosave" }),
      }),
    );

    expect(postQuoteHistoryMock).not.toHaveBeenCalled();
    expect(response.status).not.toBe(200);
  });
});
