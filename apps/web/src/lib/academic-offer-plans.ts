export function normalizeAcademicPricingPlans(value: unknown): number[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .flatMap((item) => normalizeAcademicPricingPlans(item))
          .filter((plan) => Number.isInteger(plan) && plan > 0),
      ),
    ).sort((left, right) => left - right);
  }

  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? [value] : [];
  }

  const raw = String(value ?? "").trim();
  if (!raw) return [];

  const plans = raw
    .split(/[;,/|\s]+/g)
    .map((part) => Number(part.trim().replace(",", ".")))
    .filter((plan) => Number.isInteger(plan) && plan > 0);

  return Array.from(new Set(plans)).sort((left, right) => left - right);
}

export function formatAcademicPricingPlans(plans: unknown): string {
  return normalizeAcademicPricingPlans(plans).join(", ");
}

export function academicPlanIsAllowed(plans: unknown, requestedPlan: unknown): boolean {
  const normalizedPlans = normalizeAcademicPricingPlans(plans);
  if (!normalizedPlans.length) return true;

  const plan = Number(String(requestedPlan ?? "").trim());
  if (!Number.isInteger(plan) || plan <= 0) return false;

  return normalizedPlans.includes(plan);
}
