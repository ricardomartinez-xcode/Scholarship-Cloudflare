import { describe, expect, it } from "vitest";

import {
  assertRepairBranchAllowed,
  assertRepairFileAllowed,
  getGitHubStatus,
} from "@/lib/agents/auditor/github";
import { sanitizeForAudit } from "@/lib/agents/auditor/repair-plans";

describe("auditor GitHub guardrails", () => {
  it("permite solo rutas en allowlist", () => {
    expect(assertRepairFileAllowed("docs/agent-repairs/finding.md")).toBe(
      "docs/agent-repairs/finding.md",
    );
    expect(assertRepairFileAllowed("apps/web/src/lib/agents/auditor/types.ts")).toBe(
      "apps/web/src/lib/agents/auditor/types.ts",
    );

    expect(() => assertRepairFileAllowed("packages/db/prisma/schema.prisma")).toThrow(
      /allowlist/,
    );
    expect(() => assertRepairFileAllowed("../.env")).toThrow(/no permitida/);
    expect(() => assertRepairFileAllowed("docs/../.env")).toThrow(/no permitida/);
    expect(() => assertRepairFileAllowed("C:/tmp/fix.md")).toThrow(/no permitida/);
  });

  it("rechaza main/master/default como ramas de reparacion", () => {
    expect(assertRepairBranchAllowed("auditor/fix-123", "main")).toBe("auditor/fix-123");
    expect(() => assertRepairBranchAllowed("main", "main")).toThrow(/main/);
    expect(() => assertRepairBranchAllowed("master", "main")).toThrow(/main/);
    expect(() => assertRepairBranchAllowed("production", "production")).toThrow(/default/);
  });

  it("reporta GitHub configurado sin exponer el token", () => {
    const status = getGitHubStatus({
      GITHUB_TOKEN: "ghp_secret_value",
      GITHUB_OWNER: "owner",
      GITHUB_REPO: "repo",
      GITHUB_DEFAULT_BRANCH: "trunk",
    });

    expect(status).toEqual({
      configured: true,
      owner: "owner",
      repo: "repo",
      defaultBranch: "trunk",
      missing: [],
    });
    expect(JSON.stringify(status)).not.toContain("ghp_secret_value");
  });

  it("redacta claves sensibles en evidencia", () => {
    expect(
      sanitizeForAudit({
        token: "secret",
        password: "secret",
        nested: { clientSecret: "secret", missing: ["GITHUB_TOKEN"] },
      }),
    ).toEqual({
      token: "<redacted>",
      password: "<redacted>",
      nested: { clientSecret: "<redacted>", missing: ["GITHUB_TOKEN"] },
    });
  });
});
