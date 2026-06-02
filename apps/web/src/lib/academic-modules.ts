export const ACADEMIC_MODULES = ["M1", "M2", "M3", "Longitudinal"] as const;

export type AcademicModule = (typeof ACADEMIC_MODULES)[number];

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeAcademicModule(value: unknown): AcademicModule | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized === "m3" || normalized.includes("modulo 3") || normalized.includes("modulo iii")) {
    return "M3";
  }
  if (normalized === "m2" || normalized.includes("modulo 2") || normalized.includes("modulo ii")) {
    return "M2";
  }
  if (normalized === "m1" || normalized.includes("modulo 1") || normalized.includes("modulo i")) {
    return "M1";
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

export function academicModuleOrDefault(value: unknown): AcademicModule {
  return normalizeAcademicModule(value) ?? "Longitudinal";
}

export function academicModuleMatches(
  configured: unknown,
  requested: unknown,
  options: { emptyMatchesAll?: boolean } = {},
) {
  const configuredModule = normalizeAcademicModule(configured);
  const requestedModule = normalizeAcademicModule(requested);

  if (!configuredModule) return options.emptyMatchesAll ?? true;
  if (!requestedModule) return configuredModule === "Longitudinal";
  return configuredModule === requestedModule;
}
