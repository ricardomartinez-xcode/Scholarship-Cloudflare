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
      ttlMs: 1000 * 60 * 60 * 24 * 30,
    });

    expect(issued.expiresAt.toISOString()).toBe("2026-05-26T00:00:00.000Z");
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
});
