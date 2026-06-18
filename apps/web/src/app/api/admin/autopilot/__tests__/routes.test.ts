import { AdminCapability } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiAuthMock = vi.hoisted(() => ({
  requireAdminApiCapability: vi.fn(),
}));

const auditLogMock = vi.hoisted(() => ({
  writeAdminAuditLog: vi.fn(),
}));

const githubMock = vi.hoisted(() => ({
  dispatchGitHubWorkflow: vi.fn(),
  getGitHubRepository: vi.fn(),
}));

const autopilotMock = vi.hoisted(() => ({
  INTERNAL_AUTO_AUDIT_WORKFLOW_ID: "internal-auto-audit.yml",
  INTERNAL_AUTO_REPAIR_WORKFLOW_ID: "internal-auto-repair.yml",
  createAutoAuditRun: vi.fn(),
  createAutoRepairRun: vi.fn(),
  getAutoAuditRun: vi.fn(),
  listAutoAuditRuns: vi.fn(),
  markAutoAuditRunFailed: vi.fn(),
  markAutoRepairRunFailed: vi.fn(),
  serializeAutoAuditRun: vi.fn(),
  serializeAutoRepairRun: vi.fn(),
  updateAutoAuditRunDispatch: vi.fn(),
  updateAutoRepairRunDispatch: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => apiAuthMock);
vi.mock("@/lib/admin-audit", () => auditLogMock);
vi.mock("@/lib/admin-github-control", () => githubMock);
vi.mock("@/lib/admin-autopilot", () => autopilotMock);

import { POST as postAudit } from "@/app/api/admin/autopilot/audits/route";
import { POST as postRepair } from "@/app/api/admin/autopilot/repairs/route";

describe("admin autopilot routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuthMock.requireAdminApiCapability.mockResolvedValue({
      ok: true,
      admin: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "admin@example.com",
      },
    });
    githubMock.getGitHubRepository.mockResolvedValue({
      defaultBranch: "main",
    });
    autopilotMock.serializeAutoAuditRun.mockImplementation((run) => run);
    autopilotMock.serializeAutoRepairRun.mockImplementation((run) => run);
  });

  it("dispatches an internal audit workflow from POST /audits", async () => {
    autopilotMock.createAutoAuditRun.mockResolvedValue({
      id: "audit-1",
      status: "queued",
      mode: "standard",
    });
    autopilotMock.updateAutoAuditRunDispatch.mockResolvedValue({
      id: "audit-1",
      status: "queued",
      mode: "standard",
      workflowRunUrl: "https://github.com/repo/actions",
    });
    githubMock.dispatchGitHubWorkflow.mockResolvedValue({ dispatched: true });

    const response = await postAudit(
      new Request("https://recalc.local/api/admin/autopilot/audits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "standard" }),
      }),
    );

    expect(response.status).toBe(202);
    expect(apiAuthMock.requireAdminApiCapability).toHaveBeenCalledWith(
      expect.any(String),
      AdminCapability.view_reports,
    );
    expect(githubMock.dispatchGitHubWorkflow).toHaveBeenCalledWith({
      workflowId: "internal-auto-audit.yml",
      ref: "main",
      inputs: {
        audit_run_id: "audit-1",
        mode: "standard",
      },
    });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      audit: { id: "audit-1" },
    });
  });

  it("dispatches a repair PR workflow from POST /repairs", async () => {
    autopilotMock.createAutoRepairRun.mockResolvedValue({
      id: "repair-1",
      auditRunId: "audit-1",
      status: "queued",
      branchName: "codex/autorepair/audit-1",
    });
    autopilotMock.getAutoAuditRun.mockResolvedValue({
      id: "audit-1",
      findings: [
        {
          id: "finding-1",
          checkId: "pricing.base_price_scope_legacy",
          repairable: true,
        },
        {
          id: "finding-2",
          checkId: "quote.base_price_legacy_fallback",
          repairable: true,
        },
      ],
    });
    autopilotMock.updateAutoRepairRunDispatch.mockResolvedValue({
      id: "repair-1",
      auditRunId: "audit-1",
      status: "queued",
      branchName: "codex/autorepair/audit-1",
    });
    githubMock.dispatchGitHubWorkflow.mockResolvedValue({ dispatched: true });

    const response = await postRepair(
      new Request("https://recalc.local/api/admin/autopilot/repairs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          auditRunId: "audit-1",
          findingIds: ["finding-1", "finding-2"],
        }),
      }),
    );

    expect(response.status).toBe(202);
    expect(apiAuthMock.requireAdminApiCapability).toHaveBeenCalledWith(
      expect.any(String),
      AdminCapability.publish_config,
    );
    expect(githubMock.dispatchGitHubWorkflow).toHaveBeenCalledWith({
      workflowId: "internal-auto-repair.yml",
      ref: "main",
      inputs: {
        audit_run_id: "audit-1",
        finding_ids: "pricing.base_price_scope_legacy,quote.base_price_legacy_fallback",
        repair_run_id: "repair-1",
      },
    });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      repair: { id: "repair-1" },
    });
  });
});
