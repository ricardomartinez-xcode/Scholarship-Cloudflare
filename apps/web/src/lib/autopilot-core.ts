export type AutoAuditStatus = "queued" | "running" | "ready" | "failed" | "cancelled";
export type AutoRepairStatus = AutoAuditStatus | "no_changes";
export type AutoAuditMode = "standard" | "deep";
export type AutoAuditFindingSeverity = "P0" | "P1" | "P2";

export type AutoAuditFindingInput = {
  checkId: string;
  severity: AutoAuditFindingSeverity;
  domain: string;
  title: string;
  message: string;
  filePath?: string | null;
  line?: number | null;
  suggestedAction?: string | null;
  repairable?: boolean;
  raw?: Record<string, unknown> | null;
};

export type AutoAuditCommandResult = {
  name: string;
  command: string;
  status: "passed" | "failed" | "skipped";
  exitCode?: number | null;
  durationMs?: number | null;
  summary?: string | null;
};

export type AutoAuditReport = {
  auditRunId: string;
  status: AutoAuditStatus;
  mode: AutoAuditMode;
  generatedAt: string;
  headSha?: string | null;
  branch?: string | null;
  summary: Record<string, unknown>;
  commandResults: AutoAuditCommandResult[];
  findings: AutoAuditFindingInput[];
  error?: string | null;
};

const AUTO_AUDIT_STATUSES = new Set<AutoAuditStatus>([
  "queued",
  "running",
  "ready",
  "failed",
  "cancelled",
]);

const AUTO_AUDIT_MODES = new Set<AutoAuditMode>(["standard", "deep"]);
const FINDING_SEVERITIES = new Set<AutoAuditFindingSeverity>(["P0", "P1", "P2"]);

const PRICING_RUNTIME_FILES = [
  "apps/web/src/lib/pricing-options.ts",
  "apps/web/src/lib/scholarship-quote-service.ts",
  "apps/web/src/lib/published-price-overrides.ts",
  "apps/web/src/lib/base-price-overrides.ts",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asPositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeStatus(value: unknown): AutoAuditStatus {
  return typeof value === "string" && AUTO_AUDIT_STATUSES.has(value as AutoAuditStatus)
    ? (value as AutoAuditStatus)
    : "failed";
}

function normalizeMode(value: unknown): AutoAuditMode {
  return typeof value === "string" && AUTO_AUDIT_MODES.has(value as AutoAuditMode)
    ? (value as AutoAuditMode)
    : "standard";
}

function normalizeSeverity(value: unknown): AutoAuditFindingSeverity {
  return typeof value === "string" && FINDING_SEVERITIES.has(value as AutoAuditFindingSeverity)
    ? (value as AutoAuditFindingSeverity)
    : "P2";
}

function normalizeCommandResult(value: unknown): AutoAuditCommandResult {
  const record = asRecord(value);
  const status = asString(record.status);
  return {
    name: asString(record.name, "unknown"),
    command: asString(record.command, ""),
    status: status === "passed" || status === "failed" || status === "skipped" ? status : "failed",
    exitCode: asPositiveInt(record.exitCode) ?? (record.exitCode === 0 ? 0 : null),
    durationMs: asPositiveInt(record.durationMs),
    summary: asNullableString(record.summary),
  };
}

function normalizeFinding(value: unknown): AutoAuditFindingInput {
  const record = asRecord(value);
  return {
    checkId: asString(record.checkId, "unknown.check"),
    severity: normalizeSeverity(record.severity),
    domain: asString(record.domain, "general"),
    title: asString(record.title, "Hallazgo sin titulo"),
    message: asString(record.message, "El reporte no incluyo detalle del hallazgo."),
    filePath: asNullableString(record.filePath),
    line: asPositiveInt(record.line),
    suggestedAction: asNullableString(record.suggestedAction),
    repairable: record.repairable === true,
    raw: asRecord(record.raw),
  };
}

export function normalizeAutoAuditReport(raw: unknown): AutoAuditReport {
  const record = asRecord(raw);
  const findings = Array.isArray(record.findings)
    ? record.findings.map(normalizeFinding)
    : [];
  const commandResults = Array.isArray(record.commandResults)
    ? record.commandResults.map(normalizeCommandResult)
    : [];

  return {
    auditRunId: asString(record.auditRunId, "unknown"),
    status: normalizeStatus(record.status),
    mode: normalizeMode(record.mode),
    generatedAt: asString(record.generatedAt, new Date().toISOString()),
    headSha: asNullableString(record.headSha),
    branch: asNullableString(record.branch),
    summary: asRecord(record.summary),
    commandResults,
    findings,
    error: asNullableString(record.error),
  };
}

function isRuntimePricingFile(filePath: string) {
  return PRICING_RUNTIME_FILES.some((file) => filePath.replace(/\\/g, "/").endsWith(file));
}

function lineForPattern(source: string, pattern: RegExp) {
  const match = pattern.exec(source);
  if (!match?.index) return match ? 1 : null;
  return source.slice(0, match.index).split(/\r?\n/).length;
}

export function auditPricingCodeSnapshot(files: Record<string, string>): AutoAuditFindingInput[] {
  const findings: AutoAuditFindingInput[] = [];
  const legacyScopePattern = /scope\s*:\s*["']monto["']/;
  const fallbackPattern = /\b(findStaticBasePrice|basePriceFromRules)\b/;

  for (const [filePath, source] of Object.entries(files)) {
    if (!isRuntimePricingFile(filePath)) continue;

    const legacyScopeLine = lineForPattern(source, legacyScopePattern);
    if (legacyScopeLine) {
      findings.push({
        checkId: "pricing.base_price_scope_legacy",
        severity: "P0",
        domain: "pricing",
        title: "Runtime pricing uses legacy monto scope",
        message:
          "El flujo runtime de precios debe consumir scope base_price publicado por admin, no el scope historico monto.",
        filePath,
        line: legacyScopeLine,
        suggestedAction: "Usar BASE_PRICE_OVERRIDE_SCOPE/base_price y fallar explicitamente si no hay precio publicado.",
        repairable: true,
        raw: { pattern: legacyScopePattern.source },
      });
    }

    const fallbackLine = lineForPattern(source, fallbackPattern);
    if (fallbackLine) {
      findings.push({
        checkId: "quote.base_price_legacy_fallback",
        severity: "P0",
        domain: "quote",
        title: "Quote engine can return legacy fallback prices",
        message:
          "El cotizador no debe inventar precios desde helpers estaticos o reglas legacy cuando falta precio publicado.",
        filePath,
        line: fallbackLine,
        suggestedAction: "Eliminar fallback y devolver error claro cuando no exista precio base publicado.",
        repairable: true,
        raw: { pattern: fallbackPattern.source },
      });
    }
  }

  return findings;
}
