import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { auditPricingCodeSnapshot } from "../../apps/web/src/lib/autopilot-core";

const rootDir = process.cwd();
const auditRunId = process.env.AUTO_AUDIT_RUN_ID || process.argv[2] || `local-${Date.now()}`;
const repairRunId = process.env.AUTO_REPAIR_RUN_ID || "local";
const requestedFindingIds = new Set(
  (process.env.AUTO_REPAIR_FINDING_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const outputDir =
  process.env.AUTO_REPAIR_OUTPUT_DIR ||
  path.join(rootDir, "artifacts", "autopilot", repairRunId);

const pricingFiles = [
  "apps/web/src/lib/pricing-options.ts",
  "apps/web/src/lib/scholarship-quote-service.ts",
  "apps/web/src/lib/published-price-overrides.ts",
  "apps/web/src/lib/base-price-overrides.ts",
];

async function readPricingRuntimeFiles() {
  const entries = await Promise.all(
    pricingFiles.map(async (filePath) => [
      filePath,
      await readFile(path.join(rootDir, filePath), "utf8"),
    ] as const),
  );
  return Object.fromEntries(entries);
}

function shouldHandleFinding(checkId: string) {
  return requestedFindingIds.size === 0 || requestedFindingIds.has(checkId);
}

function applyLegacyScopeRepair(source: string) {
  return source.replace(/scope\s*:\s*["']monto["']/g, 'scope: "base_price"');
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const before = await readPricingRuntimeFiles();
  const findings = auditPricingCodeSnapshot(before).filter((finding) =>
    shouldHandleFinding(finding.checkId),
  );

  const changedFiles: string[] = [];
  const unresolved: string[] = [];

  for (const finding of findings) {
    if (!finding.filePath) continue;
    const absolutePath = path.join(rootDir, finding.filePath);
    const source = before[finding.filePath];
    if (source === undefined) continue;

    if (finding.checkId === "pricing.base_price_scope_legacy") {
      const repaired = applyLegacyScopeRepair(source);
      if (repaired !== source) {
        await writeFile(absolutePath, repaired);
        changedFiles.push(finding.filePath);
      }
      continue;
    }

    unresolved.push(`${finding.checkId} (${finding.filePath})`);
  }

  const markdown = [
    `# Auto Repair ${repairRunId}`,
    "",
    `Audit: ${auditRunId}`,
    `Changed files: ${changedFiles.length}`,
    "",
    "## Changed files",
    "",
    ...(changedFiles.length ? changedFiles.map((file) => `- ${file}`) : ["No changes."]),
    "",
    "## Manual review required",
    "",
    ...(unresolved.length ? unresolved.map((item) => `- ${item}`) : ["None."]),
    "",
  ].join("\n");

  await writeFile(path.join(outputDir, "auto-repair-report.md"), markdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
