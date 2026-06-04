import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("extension session tokens", () => {
  beforeEach(() => {
    vi.useRealTimers();
    prismaMock.$executeRaw.mockReset();
    prismaMock.$queryRaw.mockReset();
    prismaMock.user.findUnique.mockReset();
  });

  it("caps issued token ttl to the production maximum", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T00:00:00.000Z"));
    prismaMock.$executeRaw.mockResolvedValue(1);
    const { issueExtensionSessionToken } = await import("@/lib/extension-session-tokens");

    const issued = await issueExtensionSessionToken({
      userId: "00000000-0000-0000-0000-000000000001",
      client: "chrome-sidepanel",
      scope: "extension:chrome-sidepanel",
      ttlMs: 1000 * 60 * 60 * 24 * 400,
    });

    expect(issued.expiresAt.toISOString()).toBe("2027-05-25T00:00:00.000Z");
  });

  it("resolves never-expiring extension token presets", async () => {
    const { resolveExtensionSessionExpiry } = await import("@/lib/extension-session-tokens");

    const expiry = resolveExtensionSessionExpiry({ ttlPreset: "never" });

    expect(expiry).toMatchObject({
      ttlMs: null,
      ttlPreset: "never",
    });
    expect(expiry.expiresAt.toISOString()).toBe("9999-12-31T23:59:59.000Z");
  });

  it("revokes active equivalent tokens before issuing a rotated token", async () => {
    prismaMock.$executeRaw.mockResolvedValue(1);
    const { issueExtensionSessionToken } = await import("@/lib/extension-session-tokens");

    await issueExtensionSessionToken({
      userId: "00000000-0000-0000-0000-000000000001",
      client: "chrome-sidepanel",
      scope: "extension:chrome-sidepanel",
    });

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("lists issued token summaries without exposing token hashes", async () => {
    const issuedAt = new Date("2026-06-03T10:00:00.000Z");
    prismaMock.$queryRaw.mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-000000000010",
        scope: "public-api:recalc",
        client: "gpt-actions",
        extensionVersion: null,
        userAgent: "vitest",
        expiresAt: new Date("2026-06-04T10:00:00.000Z"),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: issuedAt,
        updatedAt: issuedAt,
      },
    ]);
    const { listIssuedExtensionSessions } = await import("@/lib/extension-session-tokens");

    const rows = await listIssuedExtensionSessions({
      userId: "00000000-0000-0000-0000-000000000001",
      scope: "public-api:recalc",
      includeRevoked: true,
      take: 200,
    });

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "00000000-0000-0000-0000-000000000010",
      scope: "public-api:recalc",
      client: "gpt-actions",
    });
    expect(rows[0]).not.toHaveProperty("tokenHash");
  });

  it("revokes a scoped token by id for the issuing user", async () => {
    prismaMock.$executeRaw.mockResolvedValue(1);
    const { revokeIssuedExtensionSessionTokenById } = await import(
      "@/lib/extension-session-tokens"
    );

    const revoked = await revokeIssuedExtensionSessionTokenById({
      tokenId: "00000000-0000-0000-0000-000000000010",
      userId: "00000000-0000-0000-0000-000000000001",
      scope: "public-api:recalc",
    });

    expect(revoked).toBe(true);
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
