import { beforeEach, describe, expect, it, vi } from "vitest";

const { d1AllMock, d1FirstMock, getAdminAccessStateMock, isCloudflareRuntimeMock } =
  vi.hoisted(() => ({
    d1AllMock: vi.fn(),
    d1FirstMock: vi.fn(),
    getAdminAccessStateMock: vi.fn(),
    isCloudflareRuntimeMock: vi.fn(),
  }));

vi.mock("@/lib/admin-session", () => ({
  getAdminAccessState: getAdminAccessStateMock,
}));

vi.mock("@/lib/cloudflare/d1", () => ({
  d1All: d1AllMock,
  d1First: d1FirstMock,
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  isCloudflareRuntime: isCloudflareRuntimeMock,
}));

import { GET } from "./route";

describe("GET /api/admin/d1-diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminAccessStateMock.mockResolvedValue({
      status: "ok",
      user: { capabilities: ["view_admin_operations"] },
    });
    isCloudflareRuntimeMock.mockReturnValue(true);
    d1FirstMock.mockResolvedValue({ ok: 1 });
  });

  it("reports missing Campaign Sender, extension runtime and file asset tables", async () => {
    d1AllMock.mockResolvedValue([
      { name: "campus" },
      { name: "program" },
      { name: "program_offering" },
      { name: "admin_additional_benefit" },
      { name: "admin_additional_benefit_campus" },
      { name: "quote_session" },
      { name: "quote_scenario" },
      { name: "conversation" },
      { name: "conversation_member" },
      { name: "conversation_message" },
      { name: "cloudflare_auth_user" },
    ]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(false);
    expect(payload.missingTables).toEqual(
      expect.arrayContaining([
        "academic_fee",
        "file_asset",
        "file_asset_usage",
        "business_event",
        "extension_campaign",
        "extension_campaign_recipient",
        "campaign_sender_profile",
        "campaign_sender_campaign",
        "campaign_sender_recipient",
        "campaign_sender_event",
      ]),
    );
  });
});
