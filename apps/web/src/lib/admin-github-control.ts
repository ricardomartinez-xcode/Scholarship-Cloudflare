import { inflateRawSync } from "node:zlib";

type GitHubConfig =
  | { ok: true; token: string; owner: string; repo: string }
  | { ok: false; missing: string[] };

export class GitHubControlError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details ?? null;
  }
}

export function getGitHubConfig(env: Record<string, string | undefined> = process.env): GitHubConfig {
  const missing = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"].filter(
    (name) => !env[name]?.trim(),
  );
  if (missing.length) return { ok: false, missing };
  return {
    ok: true,
    token: env.GITHUB_TOKEN as string,
    owner: env.GITHUB_OWNER as string,
    repo: env.GITHUB_REPO as string,
  };
}

function githubUrl(config: Extract<GitHubConfig, { ok: true }>, path: string) {
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(
    config.repo,
  )}${path}`;
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "GITHUB_UNAUTHORIZED";
  if (status === 403) return "GITHUB_FORBIDDEN_OR_RATE_LIMITED";
  if (status === 404) return "GITHUB_NOT_FOUND";
  return "GITHUB_REQUEST_FAILED";
}

export async function githubRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const config = getGitHubConfig();
  if (!config.ok) {
    throw new GitHubControlError(
      503,
      "GITHUB_CONFIG_MISSING",
      "La integración de GitHub no está configurada.",
      { missing: config.missing },
    );
  }

  const response = await fetch(githubUrl(config, path), {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${config.token}`,
      "x-github-api-version": "2022-11-28",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const body = await parseJsonSafe(response);
  if (!response.ok) {
    const rateLimited =
      response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" ||
        String((body as { message?: unknown } | null)?.message ?? "")
          .toLowerCase()
          .includes("rate limit"));
    throw new GitHubControlError(
      response.status,
      rateLimited ? "GITHUB_RATE_LIMITED" : errorCodeForStatus(response.status),
      rateLimited
        ? "GitHub rate limit alcanzado."
        : "GitHub rechazó la solicitud.",
      {
        status: response.status,
        message: (body as { message?: unknown } | null)?.message ?? null,
      },
    );
  }

  return body as T;
}

async function githubBinaryRequest(path: string): Promise<Buffer> {
  const config = getGitHubConfig();
  if (!config.ok) {
    throw new GitHubControlError(
      503,
      "GITHUB_CONFIG_MISSING",
      "La integración de GitHub no está configurada.",
      { missing: config.missing },
    );
  }

  const response = await fetch(githubUrl(config, path), {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${config.token}`,
      "x-github-api-version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new GitHubControlError(
      response.status,
      errorCodeForStatus(response.status),
      "GitHub rechazó la descarga solicitada.",
      { status: response.status },
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function extractZipTextFile(buffer: Buffer, fileName: string) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) return null;

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) return null;

    const compressionMethod = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(centralOffset + 42);
    const entryName = buffer
      .subarray(centralOffset + 46, centralOffset + 46 + fileNameLength)
      .toString("utf8");

    if (entryName === fileName) {
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) return null;
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
      if (compressionMethod === 0) return compressed.toString("utf8");
      if (compressionMethod === 8) return inflateRawSync(compressed).toString("utf8");
      return null;
    }

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return null;
}

export async function getGitHubRepository() {
  const repo = await githubRequest<{
    name: string;
    owner: { login: string };
    default_branch: string;
    private: boolean;
    updated_at: string;
    html_url: string;
  }>("");

  return {
    name: repo.name,
    owner: repo.owner.login,
    defaultBranch: repo.default_branch,
    visibility: repo.private ? "private" : "public",
    updatedAt: repo.updated_at,
    url: repo.html_url,
  };
}

export async function listGitHubPulls() {
  const pulls = await githubRequest<
    Array<{
      number: number;
      title: string;
      user: { login: string } | null;
      head: { ref: string };
      state: string;
      created_at: string;
      updated_at: string;
      html_url: string;
    }>
  >("/pulls?state=open&per_page=50");

  return pulls.map((pull) => ({
    number: pull.number,
    title: pull.title,
    author: pull.user?.login ?? null,
    branch: pull.head.ref,
    state: pull.state,
    createdAt: pull.created_at,
    updatedAt: pull.updated_at,
    url: pull.html_url,
  }));
}

export async function listGitHubActionRuns() {
  const payload = await githubRequest<{
    workflow_runs: Array<{
      id: number;
      name: string | null;
      status: string | null;
      conclusion: string | null;
      head_branch: string | null;
      head_sha: string;
      created_at: string;
      updated_at: string;
      html_url: string;
    }>;
  }>("/actions/runs?per_page=30");

  return payload.workflow_runs.map((run) => ({
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    commit: run.head_sha,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    url: run.html_url,
  }));
}

export async function listGitHubWorkflowRuns(input: {
  workflowId: string;
  perPage?: number;
  branch?: string;
}) {
  const params = new URLSearchParams({
    per_page: String(Math.max(1, Math.min(input.perPage ?? 20, 50))),
    event: "workflow_dispatch",
  });
  if (input.branch) params.set("branch", input.branch);

  const payload = await githubRequest<{
    workflow_runs: Array<{
      id: number;
      name: string | null;
      status: string | null;
      conclusion: string | null;
      head_branch: string | null;
      head_sha: string;
      created_at: string;
      updated_at: string;
      html_url: string;
    }>;
  }>(
    `/actions/workflows/${encodeURIComponent(input.workflowId)}/runs?${params.toString()}`,
  );

  return payload.workflow_runs.map((run) => ({
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    commit: run.head_sha,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    url: run.html_url,
  }));
}

export async function listGitHubRunArtifacts(runId: string | number) {
  const payload = await githubRequest<{
    artifacts: Array<{
      id: number;
      name: string;
      size_in_bytes: number;
      expired: boolean;
      created_at: string;
      updated_at: string;
      archive_download_url: string;
      workflow_run?: { id: number; head_sha: string; head_branch: string | null };
    }>;
  }>(`/actions/runs/${encodeURIComponent(String(runId))}/artifacts?per_page=50`);

  return payload.artifacts.map((artifact) => ({
    id: artifact.id,
    name: artifact.name,
    sizeBytes: artifact.size_in_bytes,
    expired: artifact.expired,
    createdAt: artifact.created_at,
    updatedAt: artifact.updated_at,
    downloadUrl: artifact.archive_download_url,
    workflowRunId: artifact.workflow_run?.id ?? Number(runId),
    headSha: artifact.workflow_run?.head_sha ?? null,
    branch: artifact.workflow_run?.head_branch ?? null,
  }));
}

export async function findGitHubArtifactByName(input: {
  workflowId: string;
  artifactName: string;
  branch?: string;
  perPage?: number;
}) {
  const runs = await listGitHubWorkflowRuns({
    workflowId: input.workflowId,
    branch: input.branch,
    perPage: input.perPage ?? 20,
  });

  for (const run of runs) {
    const artifacts = await listGitHubRunArtifacts(run.id);
    const artifact = artifacts.find(
      (candidate) => candidate.name === input.artifactName && !candidate.expired,
    );
    if (artifact) return { artifact, run };
  }

  return null;
}

export async function downloadGitHubArtifactFile(input: {
  artifactId: string | number;
  fileName: string;
}) {
  const archive = await githubBinaryRequest(
    `/actions/artifacts/${encodeURIComponent(String(input.artifactId))}/zip`,
  );
  const content = extractZipTextFile(archive, input.fileName);
  if (content === null) {
    throw new GitHubControlError(
      404,
      "GITHUB_ARTIFACT_FILE_NOT_FOUND",
      "No se encontró el archivo solicitado dentro del artifact.",
      { artifactId: input.artifactId, fileName: input.fileName },
    );
  }
  return content;
}

export async function createGitHubIssue(input: {
  title: string;
  body?: string;
  labels?: string[];
}) {
  const issue = await githubRequest<{
    number: number;
    title: string;
    html_url: string;
    state: string;
    created_at: string;
  }>("/issues", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      body: input.body ?? "",
      labels: input.labels ?? [],
    }),
  });

  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    createdAt: issue.created_at,
  };
}

export async function dispatchGitHubWorkflow(input: {
  workflowId: string;
  ref: string;
  inputs?: Record<string, string | number | boolean>;
}) {
  await githubRequest(`/actions/workflows/${encodeURIComponent(input.workflowId)}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: input.ref,
      inputs: input.inputs ?? {},
    }),
  });

  return {
    workflowId: input.workflowId,
    ref: input.ref,
    dispatched: true,
  };
}

export async function getLatestGitHubCommit() {
  const repo = await getGitHubRepository();
  const commits = await githubRequest<
    Array<{
      sha: string;
      commit: {
        message: string;
        author: { name: string; date: string } | null;
      };
      html_url: string;
    }>
  >(`/commits?sha=${encodeURIComponent(repo.defaultBranch)}&per_page=1`);
  const commit = commits[0] ?? null;
  if (!commit) return null;

  return {
    sha: commit.sha,
    shortSha: commit.sha.slice(0, 7),
    message: commit.commit.message,
    author: commit.commit.author?.name ?? null,
    date: commit.commit.author?.date ?? null,
    url: commit.html_url,
  };
}
