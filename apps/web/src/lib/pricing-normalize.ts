export const CANONICAL_BUSINESS_LINES = [
  "salud",
  "licenciatura",
  "prepa",
  "posgrado",
] as const;

export type CanonicalBusinessLine =
  (typeof CANONICAL_BUSINESS_LINES)[number];

export const CANONICAL_MODALITIES = [
  "presencial",
  "mixta",
  "online",
] as const;

export type CanonicalModalityValue = (typeof CANONICAL_MODALITIES)[number];

export const ENROLLMENT_TYPES = [
  "nuevo_ingreso",
  "regreso",
  "reingreso",
] as const;

export type EnrollmentTypeValue = (typeof ENROLLMENT_TYPES)[number];

export type QuoteRange = {
  min: number | null;
  max: number | null;
};

export type CanonicalScholarshipRuleLike = {
  enrollmentType: string;
  businessLine: string;
  modality: string;
  plan: number;
  campusTier: string | null;
  region?: string | null;
  plantel?: string | null;
  programaKey?: string | null;
  minAverage: number | null;
  maxAverage: number | null;
  scholarshipPercent: number | null;
  discountedPriceMxn: number | null;
};

const BUSINESS_LINE_ALIASES: Record<string, CanonicalBusinessLine> = {
  salud: "salud",
  licenciatura: "licenciatura",
  lic: "licenciatura",
  prepa: "prepa",
  preparatoria: "prepa",
  bachillerato: "prepa",
  bachiller: "prepa",
  posgrado: "posgrado",
  maestria: "posgrado",
  maestría: "posgrado",
  maestrias: "posgrado",
  maestrías: "posgrado",
  master: "posgrado",
  doctorado: "posgrado",
};

function normalizeAliasValue(raw: string | null | undefined) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeBusinessLine(
  raw: string | null | undefined,
): CanonicalBusinessLine | null {
  const value = normalizeAliasValue(raw);
  if (!value) return null;
  return BUSINESS_LINE_ALIASES[value] ?? null;
}

export function normalizeCanonicalModality(
  raw: string | null | undefined,
): CanonicalModalityValue | null {
  const value = normalizeAliasValue(raw);
  if (!value) return null;
  if (value.includes("online")) return "online";
  if (
    value === "mixta" ||
    value === "ejecutivo" ||
    value === "ejecutiva" ||
    value === "mixto" ||
    value === "mixto ejecutivo"
  ) {
    return "mixta";
  }
  if (value === "presencial" || value === "escolarizado") return "presencial";
  return null;
}

export function normalizeEnrollmentType(
  raw: string | null | undefined,
): EnrollmentTypeValue | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value === "nuevo_ingreso") return "nuevo_ingreso";
  if (value === "regreso") return "regreso";
  if (value === "reingreso") return "reingreso";
  return null;
}

export function requiresCampusForQuote(
  businessLine: string,
  modality: string,
) {
  if (!businessLine || !modality) return false;
  return (
    (businessLine === "licenciatura" ||
      businessLine === "salud" ||
      businessLine === "prepa") &&
    modality !== "online"
  );
}

export function normalizeTier(raw: string | null | undefined) {
  const value = String(raw ?? "").trim().toUpperCase();
  return value || "ANY";
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    const result = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(result) ? result : null;
  }
  return null;
}

export function ruleRange(rule: CanonicalScholarshipRuleLike): QuoteRange {
  return {
    min: toNumber(rule.minAverage),
    max: toNumber(rule.maxAverage),
  };
}

export function findRuleForAverage<T extends CanonicalScholarshipRuleLike>(
  rules: T[],
  average: number,
) {
  return (
    rules.find((rule) => {
      const range = ruleRange(rule);
      if (range.min === null || range.max === null) return false;
      const min = range.min - 1e-6;
      const max = range.max + 1e-6;
      return average >= min && average <= max;
    }) ?? null
  );
}

export function findNearestRule<T extends CanonicalScholarshipRuleLike>(
  rules: T[],
  average: number,
) {
  let best: { rule: T; distance: number } | null = null;
  for (const rule of rules) {
    const range = ruleRange(rule);
    if (range.min === null || range.max === null) continue;
    const distance =
      average < range.min
        ? range.min - average
        : average > range.max
          ? average - range.max
          : 0;
    if (!best || distance < best.distance) {
      best = { rule, distance };
    }
  }
  return best?.rule ?? null;
}

export function listRuleRanges(rules: CanonicalScholarshipRuleLike[]) {
  return Array.from(
    new Set(
      rules
        .map((rule) => {
          const range = ruleRange(rule);
          if (range.min === null || range.max === null) return null;
          return `${range.min.toFixed(1)}-${range.max.toFixed(1)}`;
        })
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function basePriceFromRule(rule: CanonicalScholarshipRuleLike | null) {
  if (!rule) return null;
  const discountedPriceMxn = toNumber(rule.discountedPriceMxn);
  const scholarshipPercent = toNumber(rule.scholarshipPercent);
  if (
    discountedPriceMxn === null ||
    scholarshipPercent === null ||
    scholarshipPercent >= 100
  ) {
    return null;
  }
  return discountedPriceMxn / (1 - scholarshipPercent / 100);
}

export function basePriceFromRules(rules: CanonicalScholarshipRuleLike[]) {
  const basePrices = rules
    .map(basePriceFromRule)
    .filter((value): value is number => value !== null)
    .map((value) => Math.round(value * 100) / 100);

  if (!basePrices.length) return null;

  return Math.max(...basePrices);
}
