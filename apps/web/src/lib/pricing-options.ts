import {
  ENROLLMENT_TYPES,
  normalizeBusinessLine,
  normalizeCanonicalModality,
  type EnrollmentTypeValue,
} from "@/lib/pricing-normalize";

export type QuotePricingOption = {
  enrollmentType: EnrollmentTypeValue;
  businessLine: string;
  modality: string;
  plan: number;
};

type RuleSource = {
  businessLine: string;
  modality: string;
  plan: number;
};

type PriceOverrideSource = {
  targetKeys: unknown;
};

function targetRecord(targetKeys: unknown) {
  return targetKeys && typeof targetKeys === "object"
    ? (targetKeys as Record<string, unknown>)
    : {};
}

function normalizePlan(value: unknown) {
  const plan = Number(String(value ?? "").trim());
  return Number.isFinite(plan) && plan > 0 ? plan : null;
}

function optionKey(option: QuotePricingOption) {
  return [
    option.enrollmentType,
    option.businessLine,
    option.modality,
    option.plan,
  ].join("|");
}

function compareOptions(left: QuotePricingOption, right: QuotePricingOption) {
  return (
    left.enrollmentType.localeCompare(right.enrollmentType, "es-MX") ||
    left.businessLine.localeCompare(right.businessLine, "es-MX") ||
    left.modality.localeCompare(right.modality, "es-MX") ||
    left.plan - right.plan
  );
}

export function buildQuotePricingOptions(
  rules: RuleSource[],
  priceOverrides: PriceOverrideSource[] = [],
): QuotePricingOption[] {
  const options = new Map<string, QuotePricingOption>();

  function addForAllEnrollmentTypes(params: {
    businessLine: string;
    modality: string;
    plan: number;
  }) {
    for (const enrollmentType of ENROLLMENT_TYPES) {
      const option = {
        enrollmentType,
        businessLine: params.businessLine,
        modality: params.modality,
        plan: params.plan,
      };
      options.set(optionKey(option), option);
    }
  }

  for (const rule of rules) {
    const businessLine = normalizeBusinessLine(rule.businessLine);
    const modality = normalizeCanonicalModality(rule.modality);
    const plan = normalizePlan(rule.plan);

    if (!businessLine || !modality || plan === null) continue;

    addForAllEnrollmentTypes({
      businessLine,
      modality,
      plan,
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

    if (!businessLine || !modality || plan === null) continue;

    addForAllEnrollmentTypes({
      businessLine,
      modality,
      plan,
    });
  }

  return Array.from(options.values()).sort(compareOptions);
}
