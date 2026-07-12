import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listUsersMock, userCountMock, userFindManyMock } = vi.hoisted(() => ({
  listUsersMock: vi.fn(),
  userCountMock: vi.fn(),
  userFindManyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      count: userCountMock,
      findMany: userFindManyMock,
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    auth: {
      admin: {
        listUsers: listUsersMock,
      },
    },
  }),
}));

import { getAuthSyncDiagnostics } from "@/services/authSyncService";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

function appUser(overrides: Partial<{
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  authUserId: string | null;
}> = {}) {
  return {
    id: "app-linked",
    email: "linked@example.com",
    role: Role.user,
    isActive: true,
    authUserId: "auth-linked",
    createdAt,
    updatedAt: createdAt,
    lastLoginAt: null,
    ...overrides,
  };
}

describe("getAuthSyncDiagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("compares domain users with Supabase Auth Admin API users", async () => {
    userCountMock.mockResolvedValue(3);
    userFindManyMock.mockResolvedValue([
      appUser(),
      appUser({
        id: "app-missing-link",
        email: "missing@example.com",
        authUserId: null,
      }),
      appUser({
        id: "app-broken-link",
        email: "repair@example.com",
        role: Role.admin_operativo,
        authUserId: "auth-stale",
      }),
    ]);
    listUsersMock.mockResolvedValue({
      data: {
        users: [
          {
            id: "auth-linked",
            email: "linked@example.com",
            created_at: createdAt.toISOString(),
            user_metadata: { name: "Linked User" },
          },
          {
            id: "auth-missing",
            email: "missing@example.com",
            created_at: createdAt.toISOString(),
            user_metadata: {},
          },
          {
            id: "auth-repair",
            email: "repair@example.com",
            created_at: createdAt.toISOString(),
            user_metadata: {},
          },
          {
            id: "auth-only",
            email: "only@example.com",
            created_at: createdAt.toISOString(),
            user_metadata: { display_name: "Only Auth" },
          },
        ],
        total: 4,
        nextPage: null,
      },
      error: null,
    });

    const diagnostics = await getAuthSyncDiagnostics({ analysisLimit: 200 });

    expect(listUsersMock).toHaveBeenCalledWith({ page: 1, perPage: 200 });
    expect(diagnostics.supabaseAuthAvailable).toBe(true);
    expect(diagnostics.missingAuthUserIdMatches).toEqual([
      expect.objectContaining({ supabaseId: "auth-missing" }),
    ]);
    expect(diagnostics.brokenAuthReferences).toEqual([
      expect.objectContaining({ suggestedSupabaseId: "auth-repair" }),
    ]);
    expect(diagnostics.privilegedOrphans).toHaveLength(1);
    expect(diagnostics.supabaseOnly.map((user) => user.id)).toEqual([
      "auth-missing",
      "auth-repair",
      "auth-only",
    ]);
  });

  it("reports an unavailable Admin API without inventing broken references", async () => {
    userCountMock.mockResolvedValue(1);
    userFindManyMock.mockResolvedValue([
      appUser({ authUserId: "auth-unverified" }),
    ]);
    listUsersMock.mockResolvedValue({
      data: { users: [], total: 0, nextPage: null },
      error: new Error("admin API unavailable"),
    });

    const diagnostics = await getAuthSyncDiagnostics();

    expect(diagnostics.supabaseAuthAvailable).toBe(false);
    expect(diagnostics.supabaseAuthWarning).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(diagnostics.brokenAuthReferences).toEqual([]);
    expect(diagnostics.appOrphans).toEqual([]);
  });
});
