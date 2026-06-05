import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getQuoteEngineStatusMock, rateLimitStoreStateMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
  getQuoteEngineStatusMock: vi.fn(),
  rateLimitStoreStateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/admin-system-control", () => ({
  getQuoteEngineStatus: getQuoteEngineStatusMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitStoreState: rateLimitStoreStateMock,
}));

function sqlText(input: unknown) {
  if (Array.isArray(input)) return input.join(" ");
  return String(input);
}

describe("runAuditorDiagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitStoreStateMock.mockReturnValue({
      sharedStoreConfigured: false,
      missing: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      store: "memory",
    });
    getQuoteEngineStatusMock.mockResolvedValue({
      ok: true,
      status: "ready",
      offeringId: "offering-1",
      cycle: "2026-C1",
    });
    prismaMock.$queryRaw.mockImplementation((strings: unknown) => {
      const sql = sqlText(strings);
      if (sql.includes("extension_session_token")) {
        return Promise.resolve([{ active: 1, expired: 2, revoked: 3 }]);
      }
      if (sql.includes("user_google_connection")) {
        return Promise.resolve([{ total: 1, with_refresh_token: 1, with_access_token: 1 }]);
      }
      if (sql.includes("from recalc_admin.user")) {
        return Promise.resolve([{ without_auth_user_id: 0, inactive: 0 }]);
      }
      if (sql.includes("from recalc_admin.invite")) {
        return Promise.resolve([{ expired_open: 0, cancelled: 0, used: 0, open: 1 }]);
      }
      if (sql.includes("program_offering")) {
        return Promise.resolve([{ active_offerings: 10, active_cycles: 2, active_campuses: 4 }]);
      }
      return Promise.resolve([{ ok: 1 }]);
    });
  });

  it("devuelve hallazgos sin exponer valores de secretos", async () => {
    const { runAuditorDiagnostics } = await import("@/lib/agents/auditor/diagnostics");
    const diagnosis = await runAuditorDiagnostics({
      env: {
        DATABASE_URL: "postgres://secret-db",
        DIRECT_URL: "postgres://secret-direct",
        NEON_AUTH_BASE_URL: "https://auth.example",
        NEON_AUTH_COOKIE_SECRET: "cookie-secret",
        GITHUB_TOKEN: "ghp_super_secret",
        GITHUB_OWNER: "owner",
        GITHUB_REPO: "repo",
        GOOGLE_CLIENT_ID: "google-client",
        GOOGLE_CLIENT_SECRET: "google-secret",
        GOOGLE_REDIRECT_URI: "https://example.com/callback",
        OPENAI_API_KEY: "sk-secret",
        OPENAI_MODEL: "gpt-test",
        UPSTASH_REDIS_REST_URL: "https://redis.example",
        UPSTASH_REDIS_REST_TOKEN: "redis-secret",
      },
      now: new Date("2026-06-04T12:00:00.000Z"),
    });

    const serialized = JSON.stringify(diagnosis);
    expect(diagnosis.findings.length).toBeGreaterThan(0);
    expect(serialized).not.toContain("ghp_super_secret");
    expect(serialized).not.toContain("sk-secret");
    expect(serialized).not.toContain("google-secret");
    expect(serialized).not.toContain("redis-secret");
    expect(serialized).not.toContain("postgres://secret");

    const githubReadyFinding = diagnosis.findings.find((entry) => entry.id === "github.integration.ready");
    expect(githubReadyFinding?.severity).toBe("info");
    expect(githubReadyFinding?.suggestedAction).toBe("Sin accion requerida; hallazgo informativo.");
  });

  it("detecta GitHub env faltante con nombres de variables, no valores", async () => {
    const { runAuditorDiagnostics } = await import("@/lib/agents/auditor/diagnostics");
    const diagnosis = await runAuditorDiagnostics({
      env: {},
      now: new Date("2026-06-04T12:00:00.000Z"),
    });

    const finding = diagnosis.findings.find((entry) => entry.id === "github.integration.missing");
    expect(finding).toBeTruthy();
    expect(finding?.evidence).toMatchObject({
      configured: false,
      missing: ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"],
    });
  });
});
