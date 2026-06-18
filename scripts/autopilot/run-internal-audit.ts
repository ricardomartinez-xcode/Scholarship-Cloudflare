import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  auditPricingCodeSnapshot,
  type AutoAuditCommandResult,
  type AutoAuditFindingInput,
  type AutoAuditMode,
  type AutoAuditReport,
} from "../../apps/web/src/lib/autopilot-core";

const rootDir = process.cwd();
const auditRunId = process.env.AUTO_AUDIT_RUN_ID || process.argv[2] || `local-${Date.now()}`;
const mode = (process.env.AUTO_AUDIT_MODE === "deep" ? "deep" : "standard") as AutoAuditMode;
const outputDir =
  process.env.AUTO_AUDIT_OUTPUT_DIR ||
  path.join(rootDir, "artifacts", "autopilot", auditRunId);

type CommandSpec = {
  name: string;
  command: string;
  args: string[];
};

const baseCommands: CommandSpec[] = [
  { name: "typecheck", command: "npm", args: ["run", "typecheck"] },
  { name: "lint", command: "npm", args: ["run", "lint"] },
  { name: "unit-tests", command: "npm", args: ["test"] },
  { name: "build", command: "npm", args: ["run", "build"] },
];

const deepCommands: CommandSpec[] = [
  ...baseCommands,
  { name: "critical-e2e", command: "npm", args: ["run", "test:e2e:critical"] },
];

function shellCommand(spec: CommandSpec) {
  return [spec.command, ...spec.args].join(" ");
}

async function runCommand(spec: CommandSpec): Promise<AutoAuditCommandResult> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(spec.command, spec.args, {
      cwd: rootDir,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const output: string[] = [];
    child.stdout.on("data", (chunk) => output.push(String(chunk)));
    child.stderr.on("data", (chunk) => output.push(String(chunk)));
    child.on("close", (code) => {
      const text = output.join("").trim();
      resolve({
        name: spec.name,
        command: shellCommand(spec),
        status: code === 0 ? "passed" : "failed",
        exitCode: code,
        durationMs: Date.now() - startedAt,
        summary: text.split(/\r?\n/).slice(-8).join("\n"),
      });
    });
    child.on("error", (error) => {
      resolve({
        name: spec.name,
        command: shellCommand(spec),
        status: "failed",
        exitCode: null,
        durationMs: Date.now() - startedAt,
        summary: error.message,
      });
    });
  });
}

async function readPricingRuntimeFiles() {
  const files = [
    "apps/web/src/lib/pricing-options.ts",
    "apps/web/src/lib/scholarship-quote-service.ts",
    "apps/web/src/lib/published-price-overrides.ts",
    "apps/web/src/lib/base-price-overrides.ts",
  ];
  const entries = await Promise.all(
    files.map(async (filePath) => [
      filePath,
      await readFile(path.join(rootDir, filePath), "utf8"),
    ] as const),
  );
  return Object.fromEntries(entries);
}

function renderMarkdown(report: AutoAuditReport) {
  const lines = [
    `# Auto Audit ${report.auditRunId}`,
    "",
    `Status: ${report.status}`,
    `Mode: ${report.mode}`,
    `Generated: ${report.generatedAt}`,
    `Branch: ${report.branch ?? "unknown"}`,
    `Commit: ${report.headSha ?? "unknown"}`,
    "",
    "## Commands",
    "",
    ...report.commandResults.map(
      (result) =>
        `- ${result.status === "passed" ? "PASS" : "FAIL"} ${result.name} (${result.command})`,
    ),
    "",
    "## Findings",
    "",
  ];

  if (!report.findings.length) {
    lines.push("No findings.");
  } else {
    for (const finding of report.findings) {
      lines.push(
        `- ${finding.severity} ${finding.checkId}: ${finding.title}`,
        `  ${finding.filePath ?? "repo"}${finding.line ? `:${finding.line}` : ""}`,
        `  ${finding.message}`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const commandResults: AutoAuditCommandResult[] = [];
  for (const spec of mode === "deep" ? deepCommands : baseCommands) {
    commandResults.push(await runCommand(spec));
  }

  const findings: AutoAuditFindingInput[] = [
    ...auditPricingCodeSnapshot(await readPricingRuntimeFiles()),
  ];
  const failedCommands = commandResults.filter((result) => result.status === "failed");
  const p0Findings = findings.filter((finding) => finding.severity === "P0");
  const status = failedCommands.length || p0Findings.length ? "failed" : "ready";

  const report: AutoAuditReport = {
    auditRunId,
    status,
    mode,
    generatedAt: new Date().toISOString(),
    headSha: process.env.GITHUB_SHA ?? null,
    branch: process.env.GITHUB_REF_NAME ?? process.env.AUTO_AUDIT_REF ?? null,
    summary: {
      commandCount: commandResults.length,
      failedCommandCount: failedCommands.length,
      findingCount: findings.length,
      p0FindingCount: p0Findings.length,
    },
    commandResults,
    findings,
    error:
      status === "failed"
        ? "Auto audit found failing checks or P0 pricing/quote findings."
        : null,
  };

  await writeFile(
    path.join(outputDir, "auto-audit-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(path.join(outputDir, "auto-audit-report.md"), renderMarkdown(report));

  if (status === "failed") process.exitCode = 1;
}

await main();
