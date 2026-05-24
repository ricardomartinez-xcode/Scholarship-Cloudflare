type BaseScholarshipRuleInput = {
  id: string;
  enrollmentType: string;
  businessLine: string;
  modality: string;
  plan: number;
  campusTier: string | null;
  minAverage: unknown;
  maxAverage: unknown;
  scholarshipPercent: unknown;
  discountedPriceMxn?: unknown;
  origin?: string | null;
};

export type BaseScholarshipRow = {
  id: string;
  enrollmentType: string;
  businessLine: string;
  modality: string;
  plan: number;
  campusTier: string;
  percentages: number[];
  ranges: string[];
  ruleCount: number;
  rules: BaseScholarshipRuleRow[];
};

export type BaseScholarshipRuleRow = {
  id: string;
  minAverage: number | null;
  maxAverage: number | null;
  scholarshipPercent: number | null;
  rangeLabel: string;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatRange(minAverage: unknown, maxAverage: unknown) {
  const min = toNumber(minAverage);
  const max = toNumber(maxAverage);
  if (min === null && max === null) return "Sin rango";
  if (min !== null && max !== null) {
    return `${formatNumber(min)} - ${formatNumber(max)}`;
  }
  if (min !== null) return `Desde ${formatNumber(min)}`;
  return `Hasta ${formatNumber(max!)}`;
}

export function serializeBaseScholarshipRows(
  rules: BaseScholarshipRuleInput[],
): BaseScholarshipRow[] {
  const rows = new Map<string, BaseScholarshipRow>();

  for (const rule of rules) {
    const campusTier = String(rule.campusTier ?? "ANY").trim() || "ANY";
    const key = [
      rule.enrollmentType,
      rule.businessLine,
      rule.modality,
      String(rule.plan),
      campusTier,
    ].join("|");
    const row =
      rows.get(key) ??
      {
        id: key,
        enrollmentType: rule.enrollmentType,
        businessLine: rule.businessLine,
        modality: rule.modality,
        plan: rule.plan,
        campusTier,
        percentages: [],
        ranges: [],
        ruleCount: 0,
        rules: [],
      };

    const percentage = toNumber(rule.scholarshipPercent);
    if (percentage !== null && !row.percentages.includes(percentage)) {
      row.percentages.push(percentage);
      row.percentages.sort((a, b) => a - b);
    }

    const range = formatRange(rule.minAverage, rule.maxAverage);
    if (!row.ranges.includes(range)) {
      row.ranges.push(range);
    }
    row.rules.push({
      id: rule.id,
      minAverage: toNumber(rule.minAverage),
      maxAverage: toNumber(rule.maxAverage),
      scholarshipPercent: percentage,
      rangeLabel: range,
    });
    row.rules.sort((a, b) => {
      const minA = a.minAverage ?? -1;
      const minB = b.minAverage ?? -1;
      if (minA !== minB) return minA - minB;
      return (a.maxAverage ?? -1) - (b.maxAverage ?? -1);
    });
    row.ruleCount += 1;
    rows.set(key, row);
  }

  return Array.from(rows.values());
}
