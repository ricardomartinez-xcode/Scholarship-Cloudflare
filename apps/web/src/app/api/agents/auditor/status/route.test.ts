import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminApiCapabilityMock, checkRateLimitMock } = vi.hoisted(() => ({
  requireAdminApiCapabilityMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminApiCapability: requireAdminApiCapabilityMock,
  getAdminApiUser: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
  getRateLimitStoreState: () => ({
    sharedStoreConfigured: true,
    missing: [],
    store: "upstash",
  }),
}));

describe("GET /api/agents/auditor/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_REPO;
    checkRateLimitMock.mockResolvedValue({ ok: true, remaining: 1 });
  });

  it("rechaza usuarios sin permiso admin", async () => {
    requireAdminApiCapabilityMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ ok: false }, { status: 403 }),
    });
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("aplica rate limit por usuario admin", async () => {
    requireAdminApiCapabilityMock.mockResolvedValue({
      ok: true,
      admin: { id: "user-1", email: "a@example.com", role: "owner", capabilities: [], isSystemOwner: true },
    });
    checkRateLimitMock.mockResolvedValue({ ok: false, retryAfterMs: 1000 });
    const { GET } = await import("./route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.errorCode).toBe("AUDITOR_RATE_LIMITED");
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      "auditor:status:user-1",
      expect.objectContaining({ limit: 12 }),
    );
  });

  it("responde status sin exponer GITHUB_TOKEN", async () => {
    process.env.GITHUB_TOKEN = "ghp_secret";
    process.env.GITHUB_OWNER = "owner";
    process.env.GITHUB_REPO = "repo";
    requireAdminApiCapabilityMock.mockResolvedValue({
      ok: true,
      admin: { id: "user-1", email: "a@example.com", role: "owner", capabilities: [], isSystemOwner: true },
    });
    const { GET } = await import("./route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status.github.configured).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("ghp_secret");
  });
});
