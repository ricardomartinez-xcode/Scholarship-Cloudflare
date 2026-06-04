import "server-only";

import {
  createGitHubIssue,
  getGitHubConfig,
  getGitHubRepository,
  githubRequest,
} from "@/lib/admin-github-control";

import { buildRepairPrBody } from "./repair-plans";
import type {
  AuditorFinding,
  AuditorRepairFile,
  AuditorRepairPlan,
  GitHubIntegrationStatus,
  GitHubRepairPrResult,
} from "./types";

const REPAIR_ALLOWLIST_PREFIXES = [
  "docs/",
  "apps/web/src/lib/agents/",
  "apps/web/src/app/api/agents/",
] as const;

function encodeGitHubPath(filePath: string) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function safeBranchSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "repair";
}

export function getGitHubStatus(
  env: Record<string, string | undefined> = process.env,
): GitHubIntegrationStatus {
  const config = getGitHubConfig(env);
  const defaultBranch = env.GITHUB_DEFAULT_BRANCH?.trim() || "main";
  if (!config.ok) {
    return {
      configured: false,
      owner: env.GITHUB_OWNER?.trim() || null,
      repo: env.GITHUB_REPO?.trim() || null,
      defaultBranch,
      missing: config.missing,
    };
  }
  return {
    configured: true,
    owner: config.owner,
    repo: config.repo,
    defaultBranch,
    missing: [],
  };
}

export function assertRepairFileAllowed(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    normalized !== filePath ||
    normalized.includes("../") ||
    normalized.includes("/..") ||
    normalized.startsWith(".") ||
    /^[a-z]:/i.test(filePath)
  ) {
    throw new Error(`Ruta no permitida para reparacion: ${filePath}`);
  }

  const allowed = REPAIR_ALLOWLIST_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  if (!allowed) {
    throw new Error(`Ruta fuera de allowlist de reparacion: ${filePath}`);
  }
  return normalized;
}

export function assertRepairBranchAllowed(branch: string, defaultBranch = "main") {
  const normalized = branch.trim();
  if (!normalized || normalized === defaultBranch || normalized === "main" || normalized === "master") {
    throw new Error("La reparacion no puede usar main/master/default branch como destino.");
  }
  if (normalized.includes("..") || normalized.startsWith("/") || normalized.endsWith("/")) {
    throw new Error(`Nombre de rama invalido: ${branch}`);
  }
  return normalized;
}

export async function createGitHubIssueFromFinding(finding: AuditorFinding) {
  return createGitHubIssue({
    title: `[Auditor] ${finding.severity.toUpperCase()} ${finding.title}`,
    labels: ["auditor", `severity:${finding.severity}`, `module:${finding.module}`],
    body: [
      `## Hallazgo`,
      finding.summary,
      "",
      `## Evidencia`,
      "```json",
      JSON.stringify(finding.evidence ?? {}, null, 2),
      "```",
      "",
      `## Accion sugerida`,
      finding.suggestedAction ?? "Requiere triage operativo.",
    ].join("\n"),
  });
}

export async function createRepairBranch(params: {
  findingId: string;
  defaultBranch?: string;
}) {
  const repo = await getGitHubRepository();
  const defaultBranch = params.defaultBranch || repo.defaultBranch || "main";
  const branch = assertRepairBranchAllowed(
    `auditor/${safeBranchSegment(params.findingId)}-${Date.now().toString(36)}`,
    defaultBranch,
  );

  const ref = await githubRequest<{ object: { sha: string } }>(
    `/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
  );

  await githubRequest("/git/refs", {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: ref.object.sha,
    }),
  });

  return { branch, baseBranch: defaultBranch, baseSha: ref.object.sha };
}

export async function commitRepairFiles(params: {
  branch: string;
  files: AuditorRepairFile[];
  message: string;
}) {
  const branch = assertRepairBranchAllowed(params.branch);
  const committed: string[] = [];

  for (const file of params.files) {
    const safePath = assertRepairFileAllowed(file.path);
    await githubRequest(`/contents/${encodeGitHubPath(safePath)}`, {
      method: "PUT",
      body: JSON.stringify({
        message: params.message,
        content: Buffer.from(file.content, "utf8").toString("base64"),
        branch,
      }),
    });
    committed.push(safePath);
  }

  return committed;
}

export async function openRepairPullRequest(params: {
  branch: string;
  baseBranch: string;
  title: string;
  body: string;
}) {
  const branch = assertRepairBranchAllowed(params.branch, params.baseBranch);
  const pull = await githubRequest<{
    number: number;
    title: string;
    html_url: string;
    state: string;
  }>("/pulls", {
    method: "POST",
    body: JSON.stringify({
      title: params.title,
      head: branch,
      base: params.baseBranch,
      body: params.body,
      maintainer_can_modify: true,
      draft: true,
    }),
  });

  return {
    number: pull.number,
    title: pull.title,
    url: pull.html_url,
    state: pull.state,
  };
}

export async function createGitHubRepairPullRequest(params: {
  finding: AuditorFinding;
  plan: AuditorRepairPlan;
  files: AuditorRepairFile[];
}): Promise<GitHubRepairPrResult> {
  if (!params.finding.repairable || !params.plan.canCreatePr) {
    throw new Error("El hallazgo no esta marcado como reparable.");
  }

  const branch = await createRepairBranch({ findingId: params.finding.id });
  const files = await commitRepairFiles({
    branch: branch.branch,
    files: params.files,
    message: `[auditor] Document repair for ${params.finding.id}`,
  });
  const pullRequest = await openRepairPullRequest({
    branch: branch.branch,
    baseBranch: branch.baseBranch,
    title: `[Auditor] Reparacion propuesta: ${params.finding.title}`,
    body: buildRepairPrBody({
      finding: params.finding,
      plan: params.plan,
      files: params.files,
    }),
  });

  return {
    branch: branch.branch,
    files,
    pullRequest,
  };
}
