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

  it("defaults issued extension token ttl to 24 hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T00:00:00.000Z"));
    prismaMock.$executeRaw.mockResolvedValue(1);
    const { issueExtensionSessionToken } = await import("@/lib/extension-session-tokens");

    const issued = await issueExtensionSessionToken({
      userId: "00000000-0000-0000-0000-000000000001",
      client: "chrome-sidepanel",
      scope: "extension:chrome-sidepanel",
    });

    expect(issued.expiresAt.toISOString()).toBe("2026-05-26T00:00:00.000Z");
    expect(issued.ttlMs).toBe(1000 * 60 * 60 * 24);
    expect(issued.ttlPreset).toBe("24h");
  });

  it("caps custom token ttl to 24 hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T00:00:00.000Z"));
    prismaMock.$executeRaw.mockResolvedValue(1);
    const { issueExtensionSessionToken } = await import("@/lib/extension-session-tokens");

    const issued = await issueExtensionSessionToken({
      userId: "00000000-0000-0000-0000-000000000001",
      client: "chrome-sidepanel",
      scope: "extension:chrome-sidepanel",
      ttlMs: 1000 * 60 * 60 * 24 * 999,
    });

    expect(issued.expiresAt.toISOString()).toBe("2026-05-26T00:00:00.000Z");
    expect(issued.ttlMs).toBe(1000 * 60 * 60 * 24);
    expect(issued.ttlPreset).toBe("custom");
  });

  it("maps legacy long-lived token presets to the 24 hour maximum", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T00:00:00.000Z"));
    prismaMock.$executeRaw.mockResolvedValue(1);
    const { issueExtensionSessionToken } = await import("@/lib/extension-session-tokens");

    const yearly = await issueExtensionSessionToken({
      userId: "00000000-0000-0000-0000-000000000001",
      client: "chrome-sidepanel",
      scope: "extension:chrome-sidepanel",
      ttlPreset: "365d",
    });
    const never = await issueExtensionSessionToken({
      userId: "00000000-0000-0000-0000-000000000001",
      client: "chrome-sidepanel",
      scope: "extension:chrome-sidepanel",
      ttlPreset: "never",
    });

    expect(yearly.expiresAt.toISOString()).toBe("2026-05-26T00:00:00.000Z");
    expect(yearly.ttlMs).toBe(1000 * 60 * 60 * 24);
    expect(yearly.ttlPreset).toBe("24h");
    expect(never.expiresAt.toISOString()).toBe("2026-05-26T00:00:00.000Z");
    expect(never.ttlMs).toBe(1000 * 60 * 60 * 24);
    expect(never.ttlPreset).toBe("24h");
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
