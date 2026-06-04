import type { AuditorFinding, AuditorRepairFile, AuditorRepairPlan } from "./types";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "finding";
}

export function sanitizeForAudit(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForAudit);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (/secret|password|token|private[_-]?key|authorization/i.test(key)) {
        return [key, "<redacted>"];
      }
      return [key, sanitizeForAudit(entry)];
    }),
  );
}

export function createRepairPlan(finding: AuditorFinding): AuditorRepairPlan {
  const impact = finding.severity === "critical" || finding.severity === "error" ? "high" : "medium";
  const risk = finding.module === "oauth" || finding.module === "users" ? "medium" : "low";

  return {
    findingId: finding.id,
    title: `Plan de reparacion: ${finding.title}`,
    impact,
    risk,
    requiresConfirmation: true,
    filesToTouch: [`docs/agent-repairs/${slugify(finding.id)}.md`],
    tests: [
      "npm run typecheck",
      "npm run lint",
      "npm test -- apps/web/src/lib/agents/auditor/__tests__/auditor-github.test.ts apps/web/src/lib/agents/auditor/__tests__/auditor-diagnostics.test.ts",
      "npm run build",
    ],
    rollback: "Cerrar el PR generado o revertir el commit de documentacion de reparacion.",
    summary:
      "MVP seguro: documenta el hallazgo y la correccion propuesta en allowlist para revision humana antes de tocar codigo productivo.",
    canCreatePr: finding.repairable,
  };
}

function markdownSection(title: string, body: string) {
  return `## ${title}\n\n${body.trim() || "Sin datos."}\n`;
}

export function createRepairFiles(params: {
  finding: AuditorFinding;
  plan: AuditorRepairPlan;
  generatedAt?: Date;
}): AuditorRepairFile[] {
  const generatedAt = params.generatedAt ?? new Date();
  const safeEvidence = sanitizeForAudit(params.finding.evidence ?? {});
  const slug = slugify(params.finding.id);
  const filePath = `docs/agent-repairs/${slug}-${generatedAt
    .toISOString()
    .slice(0, 10)}.md`;
  const content = [
    `# Reparacion propuesta: ${params.finding.title}`,
    "",
    `Generado: ${generatedAt.toISOString()}`,
    `Finding: \`${params.finding.id}\``,
    `Modulo: \`${params.finding.module}\``,
    `Severidad: \`${params.finding.severity}\``,
    "",
    markdownSection("Resumen", params.finding.summary),
    markdownSection("Accion sugerida", params.finding.suggestedAction ?? params.plan.summary),
    markdownSection("Impacto", params.plan.impact),
    markdownSection("Riesgo", params.plan.risk),
    markdownSection("Archivos permitidos", params.plan.filesToTouch.map((file) => `- \`${file}\``).join("\n")),
    markdownSection("Pruebas sugeridas", params.plan.tests.map((test) => `- \`${test}\``).join("\n")),
    markdownSection("Rollback", params.plan.rollback),
    markdownSection("Evidencia sanitizada", `\`\`\`json\n${JSON.stringify(safeEvidence, null, 2)}\n\`\`\``),
  ].join("\n");

  return [{ path: filePath, content }];
}

export function buildRepairPrBody(params: {
  finding: AuditorFinding;
  plan: AuditorRepairPlan;
  files: AuditorRepairFile[];
}) {
  return [
    `## Hallazgo`,
    `- ID: \`${params.finding.id}\``,
    `- Modulo: \`${params.finding.module}\``,
    `- Severidad: \`${params.finding.severity}\``,
    "",
    params.finding.summary,
    "",
    `## Causa probable`,
    params.finding.suggestedAction ?? "Requiere revision humana con la evidencia del diagnostico.",
    "",
    `## Archivos modificados`,
    ...params.files.map((file) => `- \`${file.path}\``),
    "",
    `## Pruebas`,
    ...params.plan.tests.map((test) => `- \`${test}\``),
    "",
    `## Rollback`,
    params.plan.rollback,
    "",
    `## Riesgos`,
    `Impacto ${params.plan.impact}; riesgo ${params.plan.risk}. No mergea automaticamente y no toca rutas fuera de allowlist.`,
  ].join("\n");
}
