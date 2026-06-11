import { ACADEMIC_MODULES, type AcademicModule } from "@/lib/academic-modules";
import { compareAdminPricingScope } from "@/lib/admin-pricing-display";

export type MontoOverride = {
  id: string;
  targetKeys: unknown;
  newPrice: unknown;
  isActive: boolean;
};

export type PriceRow = {
  id: string;
  region: string | null;
  plantel: string | null;
  programa_key: string | null;
  nivel_key: string;
  modalidad_key: string;
  plan: string;
  module: AcademicModule;
  tier: string | null;
  basePriceMxn: number | null;
  subjectPriceMxn: number | null;
  sourceOverrideId: string | null;
  source: "canonical" | "derived" | "missing";
};

function normalizeTierKey(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeScopeValue(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeModuleValue(value: unknown): AcademicModule {
  const normalized = String(value ?? "").trim();
  return ACADEMIC_MODULES.includes(normalized as AcademicModule)
    ? (normalized as AcademicModule)
    : "Longitudinal";
}

function targetKeysRecord(targetKeys: unknown) {
  return targetKeys && typeof targetKeys === "object"
    ? (targetKeys as Record<string, unknown>)
    : {};
}

function priceScopeKey(scope: {
  region?: unknown;
  plantel?: unknown;
  programa_key?: unknown;
  nivel_key: unknown;
  modalidad_key: unknown;
  plan: unknown;
  module?: unknown;
  tier?: unknown;
}) {
  return [
    normalizeScopeValue(scope.region) ?? "",
    normalizeScopeValue(scope.plantel) ?? "",
    normalizeScopeValue(scope.programa_key) ?? "",
    String(scope.nivel_key ?? "").trim(),
    String(scope.modalidad_key ?? "").trim(),
    String(scope.plan ?? "").trim(),
    normalizeModuleValue(scope.module),
    normalizeTierKey(scope.tier) ?? "",
  ].join("|");
}

function priceScopeKeyFromRecord(keys: Record<string, unknown>) {
  return priceScopeKey({
    region: keys.region,
    plantel: keys.plantel,
    programa_key:
      keys.programa_key ??
      keys.programaKey ??
      keys.program_key ??
      keys.programa ??
      keys.program,
    nivel_key: keys.nivel_key,
    modalidad_key: keys.modalidad_key,
    plan: keys.plan,
    module: keys.modulo ?? keys.module ?? keys.academicModule ?? "Longitudinal",
    tier: keys.tier,
  });
}

function toPriceNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function priceRowFromOverride(override: MontoOverride): PriceRow | null {
  const keys = targetKeysRecord(override.targetKeys);
  const nivel = normalizeScopeValue(keys.nivel_key);
  const modalidad = normalizeScopeValue(keys.modalidad_key);
  const plan = normalizeScopeValue(keys.plan);
  if (!nivel || !modalidad || !plan) return null;

  return {
    id: `price:${override.id}`,
    region: normalizeScopeValue(keys.region),
    plantel: normalizeScopeValue(keys.plantel),
    programa_key: normalizeScopeValue(
      keys.programa_key ??
        keys.programaKey ??
        keys.program_key ??
        keys.programa ??
        keys.program,
    ),
    nivel_key: nivel,
    modalidad_key: modalidad,
    plan,
    module: normalizeModuleValue(keys.modulo ?? keys.module ?? keys.academicModule),
    tier: normalizeTierKey(keys.tier),
    basePriceMxn: toPriceNumber(override.newPrice),
    subjectPriceMxn: toPriceNumber(
      keys.subject_price_mxn ??
        keys.precio_por_materia ??
        keys.precioPorMateria ??
        keys.price_per_subject ??
        keys.subjectPriceMxn,
    ),
    sourceOverrideId: override.id,
    source: "canonical",
  };
}

function comparePriceRows(left: PriceRow, right: PriceRow) {
  return (
    [
      left.nivel_key.localeCompare(right.nivel_key),
      compareAdminPricingScope(left, right),
      left.modalidad_key.localeCompare(right.modalidad_key),
      left.plan.localeCompare(right.plan, undefined, { numeric: true }),
      left.module.localeCompare(right.module, "es-MX"),
    ].find((result) => result !== 0) ?? 0
  );
}

export function buildAdminPriceRows({
  montoOverrides,
}: {
  montoOverrides: MontoOverride[];
}): PriceRow[] {
  return montoOverrides
    .map(priceRowFromOverride)
    .filter((row): row is PriceRow => row !== null)
    .sort(comparePriceRows);
}

export function findOverride(
  rule: PriceRow,
  overrides: MontoOverride[],
): MontoOverride | null {
  return (
    overrides.find((override) => {
      if (rule.sourceOverrideId && override.id === rule.sourceOverrideId) return true;
      const keys = targetKeysRecord(override.targetKeys);
      return priceScopeKeyFromRecord(keys) === priceScopeKey(rule);
    }) ?? null
  );
}
