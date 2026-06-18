import { Prisma } from "@prisma/client";

import {
  type AutoAuditMode,
  type AutoAuditReport,
  normalizeAutoAuditReport,
} from "@/lib/autopilot-core";
import {
  downloadGitHubArtifactFile,
  findGitHubArtifactByName,
  GitHubControlError,
} from "@/lib/admin-github-control";
import { prisma } from "@/lib/prisma";

export const INTERNAL_AUTO_AUDIT_WORKFLOW_ID = "internal-auto-audit.yml";
export const INTERNAL_AUTO_REPAIR_WORKFLOW_ID = "internal-auto-repair.yml";
export const AUTO_AUDIT_REPORT_FILE = "auto-audit-report.json";
export const AUTO_AUDIT_MARKDOWN_FILE = "auto-audit-report.md";

type ActorInput = {
  id?: string | null;
  email?: string | null;
};

const TERMINAL_STATUSES = new Set(["ready", "failed", "cancelled", "no_changes"]);

type AutoAuditRunRecord = Prisma.AutoAuditRunGetPayload<{
  include: { findings: true; repairs: true };
}>;

type AutoRepairRunRecord = Prisma.AutoRepairRunGetPayload<Record<string, never>>;

function toInputJson(value: unknown) {
  return value == null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function completedAtFor(status: string) {
  return TERMINAL_STATUSES.has(status) ? new Date() : null;
}

export function buildAutoAuditArtifactName(auditRunId: string) {
  return `auto-audit-report-${auditRunId}`;
}

export function buildAutoRepairBranchName(auditRunId: string) {
  const safeId = auditRunId.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `codex/autorepair/${safeId || "audit"}`;
}

export function serializeAutoAuditFinding(
  finding: AutoAuditRunRecord["findings"][number],
) {
  return {
    id: finding.id,
    auditRunId: finding.auditRunId,
    checkId: finding.checkId,
    severity: finding.severity,
    domain: finding.domain,
    title: finding.title,
    message: finding.message,
    filePath: finding.filePath,
    line: finding.line,
    suggestedAction: finding.suggestedAction,
    repairable: finding.repairable,
    raw: finding.raw,
    createdAt: finding.createdAt.toISOString(),
  };
}

export function serializeAutoRepairRun(repair: AutoRepairRunRecord) {
  return {
    id: repair.id,
    auditRunId: repair.auditRunId,
    status: repair.status,
    workflowRunId: repair.workflowRunId,
    workflowRunUrl: repair.workflowRunUrl,
    branchName: repair.branchName,
    commitSha: repair.commitSha,
    pullRequestNumber: repair.pullRequestNumber,
    pullRequestUrl: repair.pullRequestUrl,
    selectedFindingIds: repair.selectedFindingIds,
    error: repair.error,
    createdByUserId: repair.createdByUserId,
    createdByEmail: repair.createdByEmail,
    completedAt: repair.completedAt?.toISOString() ?? null,
    createdAt: repair.createdAt.toISOString(),
    updatedAt: repair.updatedAt.toISOString(),
  };
}

export function serializeAutoAuditRun(run: AutoAuditRunRecord) {
  return {
    id: run.id,
    status: run.status,
    mode: run.mode,
    trigger: run.trigger,
    ref: run.ref,
    headSha: run.headSha,
    workflowRunId: run.workflowRunId,
    workflowRunUrl: run.workflowRunUrl,
    artifactName: run.artifactName,
    reportSummary: run.reportSummary,
    reportMarkdown: run.reportMarkdown,
    error: run.error,
    createdByUserId: run.createdByUserId,
    createdByEmail: run.createdByEmail,
    completedAt: run.completedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    findings: run.findings.map(serializeAutoAuditFinding),
    repairs: run.repairs.map(serializeAutoRepairRun),
  };
}

export async function createAutoAuditRun(input: {
  mode: AutoAuditMode;
  ref: string;
  actor: ActorInput;
}) {
  return prisma.autoAuditRun.create({
    data: {
      mode: input.mode,
      ref: input.ref,
      status: "queued",
      trigger: "manual",
      artifactName: buildAutoAuditArtifactName("pending"),
      createdByUserId: input.actor.id ?? null,
      createdByEmail: input.actor.email ?? null,
    },
    include: { findings: true, repairs: true },
  });
}

export async function updateAutoAuditRunDispatch(input: {
  auditRunId: string;
  workflowRunUrl?: string | null;
}) {
  return prisma.autoAuditRun.update({
    where: { id: input.auditRunId },
    data: {
      status: "queued",
      artifactName: buildAutoAuditArtifactName(input.auditRunId),
      workflowRunUrl: input.workflowRunUrl ?? null,
    },
    include: { findings: true, repairs: true },
  });
}

export async function markAutoAuditRunFailed(input: {
  auditRunId: string;
  error: string;
}) {
  return prisma.autoAuditRun.update({
    where: { id: input.auditRunId },
    data: {
      status: "failed",
      error: input.error,
      completedAt: new Date(),
    },
    include: { findings: true, repairs: true },
  });
}

export async function listAutoAuditRuns(options?: { limit?: number }) {
  return prisma.autoAuditRun.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(options?.limit ?? 20, 50)),
    include: { findings: true, repairs: true },
  });
}

export async function getAutoAuditRun(auditRunId: string) {
  return prisma.autoAuditRun.findUnique({
    where: { id: auditRunId },
    include: { findings: true, repairs: true },
  });
}

export async function applyAutoAuditReport(input: {
  auditRunId: string;
  report: AutoAuditReport;
  workflowRunId?: string | number | null;
  workflowRunUrl?: string | null;
  reportMarkdown?: string | null;
}) {
  const completedAt = completedAtFor(input.report.status);
  return prisma.$transaction(async (tx) => {
    await tx.autoAuditFinding.deleteMany({
      where: { auditRunId: input.auditRunId },
    });

    if (input.report.findings.length) {
      await tx.autoAuditFinding.createMany({
        data: input.report.findings.map((finding) => ({
          auditRunId: input.auditRunId,
          checkId: finding.checkId,
          severity: finding.severity,
          domain: finding.domain,
          title: finding.title,
          message: finding.message,
          filePath: finding.filePath ?? null,
          line: finding.line ?? null,
          suggestedAction: finding.suggestedAction ?? null,
          repairable: finding.repairable ?? false,
          raw: toInputJson(finding.raw),
        })),
      });
    }

    return tx.autoAuditRun.update({
      where: { id: input.auditRunId },
      data: {
        status: input.report.status,
        mode: input.report.mode,
        headSha: input.report.headSha ?? undefined,
        ref: input.report.branch ?? undefined,
        workflowRunId: input.workflowRunId == null ? undefined : String(input.workflowRunId),
        workflowRunUrl: input.workflowRunUrl ?? undefined,
        artifactName: buildAutoAuditArtifactName(input.auditRunId),
        reportSummary: toInputJson(input.report.summary),
        reportMarkdown: input.reportMarkdown ?? undefined,
        error: input.report.error ?? null,
        completedAt,
      },
      include: { findings: true, repairs: true },
    });
  });
}

export async function syncAutoAuditRunFromGitHub(auditRunId: string) {
  const run = await getAutoAuditRun(auditRunId);
  if (!run) return null;

  const artifactName = run.artifactName ?? buildAutoAuditArtifactName(auditRunId);
  const match = await findGitHubArtifactByName({
    workflowId: INTERNAL_AUTO_AUDIT_WORKFLOW_ID,
    artifactName,
    branch: run.ref,
  });

  if (!match) {
    return {
      synced: false,
      audit: run,
      message: "El artifact de auditoria aun no esta disponible en GitHub Actions.",
    };
  }

  const reportText = await downloadGitHubArtifactFile({
    artifactId: match.artifact.id,
    fileName: AUTO_AUDIT_REPORT_FILE,
  });

  let markdown: string | null = null;
  try {
    markdown = await downloadGitHubArtifactFile({
      artifactId: match.artifact.id,
      fileName: AUTO_AUDIT_MARKDOWN_FILE,
    });
  } catch (error) {
    if (!(error instanceof GitHubControlError && error.status === 404)) throw error;
  }

  const report = normalizeAutoAuditReport(JSON.parse(reportText) as unknown);
  const updated = await applyAutoAuditReport({
    auditRunId,
    report,
    workflowRunId: match.run.id,
    workflowRunUrl: match.run.url,
    reportMarkdown: markdown,
  });

  return {
    synced: true,
    audit: updated,
    message: "Auditoria sincronizada desde GitHub Actions.",
  };
}

export async function createAutoRepairRun(input: {
  auditRunId: string;
  findingIds: string[];
  actor: ActorInput;
}) {
  return prisma.autoRepairRun.create({
    data: {
      auditRunId: input.auditRunId,
      status: "queued",
      branchName: buildAutoRepairBranchName(input.auditRunId),
      selectedFindingIds: input.findingIds,
      createdByUserId: input.actor.id ?? null,
      createdByEmail: input.actor.email ?? null,
    },
  });
}

export async function updateAutoRepairRunDispatch(input: {
  repairRunId: string;
  workflowRunUrl?: string | null;
}) {
  return prisma.autoRepairRun.update({
    where: { id: input.repairRunId },
    data: {
      status: "queued",
      workflowRunUrl: input.workflowRunUrl ?? null,
    },
  });
}

export async function markAutoRepairRunFailed(input: {
  repairRunId: string;
  error: string;
}) {
  return prisma.autoRepairRun.update({
    where: { id: input.repairRunId },
    data: {
      status: "failed",
      error: input.error,
      completedAt: new Date(),
    },
  });
}

export async function listAutoRepairRuns(options?: { limit?: number }) {
  return prisma.autoRepairRun.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(options?.limit ?? 20, 50)),
  });
}
