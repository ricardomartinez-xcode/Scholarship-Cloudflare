export const ACADEMIC_MODULES = ["M1", "M2", "M3", "Longitudinal", "Modular"] as const;
export const ACADEMIC_MODULE_PARTS = ["M1", "M2", "M3"] as const;
export const DEFAULT_ACADEMIC_MODULE_CHOICES = ["M1", "M2", "M3", "Longitudinal"] as const;

export type AcademicModule = (typeof ACADEMIC_MODULES)[number];
export type AcademicModulePart = (typeof ACADEMIC_MODULE_PARTS)[number];
export type AcademicModuleSelection = AcademicModule | "";

/**
 * Visible options consumed by the quote UI. Keep it mutable on purpose:
 * pricing-option-display updates it from Prisma-backed pricingOptions so the
 * large quote component can keep consuming the same reference without showing
 * generic/static module choices.
 */
export const ACADEMIC_MODULE_CHOICES: AcademicModule[] = [...DEFAULT_ACADEMIC_MODULE_CHOICES];

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const MODULE_TOKEN_PATTERNS: Array<[AcademicModulePart, RegExp[]]> = [
  ["M1", [/\bm1\b/, /\b1\b/, /\bmodulo\s*1\b/, /\bmodulo\s*i\b/]],
  ["M2", [/\bm2\b/, /\b2\b/, /\bmodulo\s*2\b/, /\bmodulo\s*ii\b/]],
  ["M3", [/\bm3\b/, /\b3\b/, /\bmodulo\s*3\b/, /\bmodulo\s*iii\b/]],
];

function isExplicitModular(value: string) {
  return value === "modular" || value.startsWith("modular ") || value.includes(" modular");
}

function uniqueVisibleModules(modules: readonly unknown[]): AcademicModule[] {
  const next = modules
    .map((module) => normalizeAcademicModule(module))
    .filter((module): module is AcademicModule => Boolean(module))
    .flatMap((module) => (module === "Modular" ? ACADEMIC_MODULE_PARTS : [module]));

  return DEFAULT_ACADEMIC_MODULE_CHOICES.filter((module) => next.includes(module));
}

export function setVisibleAcademicModuleChoicesForQuote(modules: readonly unknown[]) {
  const next = uniqueVisibleModules(modules);
  ACADEMIC_MODULE_CHOICES.splice(
    0,
    ACADEMIC_MODULE_CHOICES.length,
    ...(next.length ? next : DEFAULT_ACADEMIC_MODULE_CHOICES),
  );
}

export function parseAcademicModuleTokens(value: unknown): AcademicModulePart[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  return MODULE_TOKEN_PATTERNS.flatMap(([module, patterns]) =>
    patterns.some((pattern) => pattern.test(normalized)) ? [module] : [],
  );
}

export function normalizeAcademicModule(value: unknown): AcademicModule | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const moduleParts = parseAcademicModuleTokens(value);
  if (isExplicitModular(normalized) || moduleParts.length > 1) {
    return "Modular";
  }

  if (moduleParts[0]) {
    return moduleParts[0];
  }

  if (
    normalized === "longitudinal" ||
    normalized.includes("longitudinal") ||
    normalized === "long"
  ) {
    return "Longitudinal";
  }

  return null;
}

export function normalizeAcademicModuleDisplay(value: unknown): string {
  const normalizedModule = normalizeAcademicModule(value);
  const moduleParts = parseAcademicModuleTokens(value);

  if (normalizedModule === "Modular") {
    return moduleParts.length ? `Modular ${moduleParts.join(", ")}` : "Modular";
  }

  if (normalizedModule) {
    return normalizedModule;
  }

  return String(value ?? "").trim() || "Longitudinal";
}

export function formatAcademicModuleLabel(value: unknown): string {
  if (!String(value ?? "").trim()) return "Sin módulo";
  const normalizedModule = normalizeAcademicModule(value);
  if (normalizedModule === "M1") return "1";
  if (normalizedModule === "M2") return "2";
  if (normalizedModule === "M3") return "3";
  return normalizeAcademicModuleDisplay(value);
}

export function academicModuleOrDefault(value: unknown): AcademicModule {
  return normalizeAcademicModule(value) ?? "Longitudinal";
}

export function academicModuleOrBlank(value: unknown): AcademicModuleSelection {
  return normalizeAcademicModule(value) ?? "";
}

export function academicModulesForConfiguredTrack(
  track: unknown,
  moduleCount?: number | null,
): AcademicModule[] {
  const normalizedModule = normalizeAcademicModule(track);

  if (normalizedModule === "Modular") {
    const parsedCount = Number(moduleCount);
    const safeCount = Number.isFinite(parsedCount)
      ? Math.max(1, Math.min(ACADEMIC_MODULE_PARTS.length, Math.trunc(parsedCount)))
      : ACADEMIC_MODULE_PARTS.length;

    return ACADEMIC_MODULE_PARTS.slice(0, safeCount);
  }

  return [normalizedModule ?? "Longitudinal"];
}

export function academicModuleMatches(
  configured: unknown,
  requested: unknown,
  options: { emptyMatchesAll?: boolean } = {},
) {
  const configuredModule = normalizeAcademicModule(configured);
  const requestedModule = normalizeAcademicModule(requested);

  if (!configuredModule) return options.emptyMatchesAll ?? true;
  if (!requestedModule) return configuredModule === "Longitudinal" || configuredModule === "Modular";
  if (configuredModule === requestedModule) return true;

  if (configuredModule === "Modular" || requestedModule === "Modular") {
    const configuredParts = parseAcademicModuleTokens(configured);
    const requestedParts = parseAcademicModuleTokens(requested);

    if (!configuredParts.length || !requestedParts.length) {
      return true;
    }

    return configuredParts.some((part) => requestedParts.includes(part));
  }

  return false;
}
