import {
  ENROLLMENT_TYPES,
  normalizeBusinessLine,
  normalizeCanonicalModality,
  type EnrollmentTypeValue,
} from "@/lib/pricing-normalize";
import { academicModuleOrDefault, type AcademicModule } from "@/lib/academic-modules";
import { normalizeKey } from "@/lib/text-normalize";

export type QuotePricingOption = {
  enrollmentType: EnrollmentTypeValue;
  businessLine: string;
  modality: string;
  plan: number;
  module: AcademicModule;
  programKey?: string | null;
  source?: "pricing" | "offering";
};

type RuleSource = {
  businessLine: string;
  modality: string;
  plan: number;
  programaKey?: string | null;
  programKey?: string | null;
};

type PriceOverrideSource = {
  targetKeys: unknown;
};

const LEGACY_PROGRAMA_KEYS = new Set([
  "canonical",
  "canonico",
  "nuevo ingreso",
  "nuevo_ingreso",
  "regreso",
  "reingreso",
  "todos",
  "todas",
  "general",
  "any",
]);

function targetRecord(targetKeys: unknown) {
  return targetKeys && typeof targetKeys === "object"
    ? (targetKeys as Record<string, unknown>)
    : {};
}

function normalizePlan(value: unknown) {
  const plan = Number(String(value ?? "").trim());
  return Number.isFinite(plan) && plan > 0 ? plan : null;
}

function normalizeProgramKey(value: unknown) {
  const normalized = normalizeKey(String(value ?? ""));
  if (!normalized || LEGACY_PROGRAMA_KEYS.has(normalized)) return null;
  return normalized;
}

function optionKey(option: QuotePricingOption) {
  return [
    option.enrollmentType,
    option.businessLine,
    option.modality,
    option.plan,
    option.module,
    option.programKey ?? "",
  ].join("|");
}

function compareOptions(left: QuotePricingOption, right: QuotePricingOption) {
  return (
    left.enrollmentType.localeCompare(right.enrollmentType, "es-MX") ||
    left.businessLine.localeCompare(right.businessLine, "es-MX") ||
    left.modality.localeCompare(right.modality, "es-MX") ||
    left.plan - right.plan ||
    left.module.localeCompare(right.module, "es-MX") ||
    String(left.programKey ?? "").localeCompare(String(right.programKey ?? ""), "es-MX")
  );
}

function replacementKey(option: {
  businessLine: string;
  modality: string;
  plan: number;
  programKey?: string | null;
}) {
  return [
    option.businessLine,
    option.modality,
    option.plan,
    option.programKey ?? "",
  ].join("|");
}

export function buildQuotePricingOptions(
  rules: RuleSource[],
  priceOverrides: PriceOverrideSource[] = [],
): QuotePricingOption[] {
  const options = new Map<string, QuotePricingOption>();
  const moduleSpecificReplacementKeys = new Set<string>();

  function addForAllEnrollmentTypes(params: {
    businessLine: string;
    modality: string;
    plan: number;
    module?: string | null;
    programKey?: string | null;
  }) {
    for (const enrollmentType of ENROLLMENT_TYPES) {
      const option = {
        enrollmentType,
        businessLine: params.businessLine,
        modality: params.modality,
        plan: params.plan,
        module: academicModuleOrDefault(params.module),
        ...(params.programKey ? { programKey: params.programKey } : {}),
      };
      options.set(optionKey(option), option);
    }
  }

  for (const override of priceOverrides) {
    const keys = targetRecord(override.targetKeys);
    const businessLine = normalizeBusinessLine(
      String(keys.nivel_key ?? keys.businessLine ?? keys.nivel ?? ""),
    );
    const modality = normalizeCanonicalModality(
      String(keys.modalidad_key ?? keys.modality ?? keys.modalidad ?? ""),
    );
    const plan = normalizePlan(keys.plan);
    const programKey = normalizeProgramKey(
      keys.programa_key ??
        keys.programaKey ??
        keys.program_key ??
        keys.programId ??
        keys.program_id ??
        keys.programa ??
        keys.program,
    );
    const academicModule = academicModuleOrDefault(
      keys.modulo ?? keys.module ?? keys.academicModule,
    );

    if (!businessLine || !modality || plan === null || academicModule === "Longitudinal") {
      continue;
    }

    moduleSpecificReplacementKeys.add(
      replacementKey({ businessLine, modality, plan, programKey }),
    );
  }

  for (const rule of rules) {
    const businessLine = normalizeBusinessLine(rule.businessLine);
    const modality = normalizeCanonicalModality(rule.modality);
    const plan = normalizePlan(rule.plan);
    const programKey = normalizeProgramKey(rule.programKey ?? rule.programaKey);

    if (!businessLine || !modality || plan === null) continue;
    if (
      moduleSpecificReplacementKeys.has(
        replacementKey({ businessLine, modality, plan, programKey }),
      )
    ) {
      continue;
    }

    addForAllEnrollmentTypes({
      businessLine,
      modality,
      plan,
      module: "Longitudinal",
      programKey,
    });
  }

  for (const override of priceOverrides) {
    const keys = targetRecord(override.targetKeys);
    const businessLine = normalizeBusinessLine(
      String(keys.nivel_key ?? keys.businessLine ?? keys.nivel ?? ""),
    );
    const modality = normalizeCanonicalModality(
      String(keys.modalidad_key ?? keys.modality ?? keys.modalidad ?? ""),
    );
    const plan = normalizePlan(keys.plan);
    const programKey = normalizeProgramKey(
      keys.programa_key ??
        keys.programaKey ??
        keys.program_key ??
        keys.programId ??
        keys.program_id ??
        keys.programa ??
        keys.program,
    );
    const academicModule = academicModuleOrDefault(
      keys.modulo ?? keys.module ?? keys.academicModule,
    );

    if (!businessLine || !modality || plan === null) continue;

    addForAllEnrollmentTypes({
      businessLine,
      modality,
      plan,
      module: academicModule,
      programKey,
    });
  }

  return Array.from(options.values()).sort(compareOptions);
}
