import { d1All } from "@/lib/cloudflare/d1";
import { findD1CampusId } from "@/lib/cloudflare/public-data";

type D1BenefitRow = {
  id: string;
  applies_to_all: number;
  benefit_type: "percentage" | "first_payment" | "fixed_scholarship";
  enrollment_type: string | null;
  extra_percent: number;
  first_payment_amount: number;
  notes: string | null;
  business_line: string | null;
  modality: string | null;
  duration: string | null;
  updated_at: string | null;
  campus_match: number | null;
};

export type D1ResolvedAdditionalBenefit = {
  benefitType: D1BenefitRow["benefit_type"];
  enrollmentType: string | null;
  extraPercent: number;
  firstPaymentAmount: number;
  notes: string | null;
  appliesToAll: boolean;
  businessLine: string | null;
  modality: string | null;
  duration: string | null;
};

export type D1ResolvedAdditionalBenefits = {
  percentageBenefit: D1ResolvedAdditionalBenefit | null;
  firstPaymentBenefit: D1ResolvedAdditionalBenefit | null;
};

function isTrue(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function mapRow(row: D1BenefitRow): D1ResolvedAdditionalBenefit {
  return {
    benefitType: row.benefit_type,
    enrollmentType: row.enrollment_type,
    extraPercent: Number(row.extra_percent ?? 0),
    firstPaymentAmount: Number(row.first_payment_amount ?? 0),
    notes: row.notes,
    appliesToAll: isTrue(row.applies_to_all),
    businessLine: row.business_line,
    modality: row.modality,
    duration: row.duration,
  };
}

function matchesScope(
  row: D1BenefitRow,
  params: {
    businessLine: string | null;
    modality: string | null;
    enrollmentType: string | null;
    campusId: string | null;
  },
) {
  const campusMatches = isTrue(row.applies_to_all) || Boolean(params.campusId && Number(row.campus_match ?? 0) > 0);
  const businessLineMatches = params.businessLine
    ? row.business_line === null || row.business_line === params.businessLine
    : row.business_line === null;
  const modalityMatches = params.modality
    ? row.modality === null || row.modality === params.modality
    : row.modality === null;
  const enrollmentMatches = params.enrollmentType
    ? row.enrollment_type === null || row.enrollment_type === params.enrollmentType
    : row.enrollment_type === null;

  return campusMatches && businessLineMatches && modalityMatches && enrollmentMatches;
}

function specificity(row: D1BenefitRow) {
  return Number(Boolean(row.business_line)) + Number(Boolean(row.modality)) + Number(Boolean(row.enrollment_type));
}

function pick(rows: D1BenefitRow[], benefitType: D1BenefitRow["benefit_type"]) {
  return rows
    .filter((row) => row.benefit_type === benefitType)
    .sort((left, right) => {
      const score = specificity(right) - specificity(left);
      if (score !== 0) return score;
      return String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
    })[0] ?? null;
}

/** Read-only D1 resolver used by the Worker runtime. */
export async function resolveD1AdditionalBenefits(params: {
  campus?: string | null;
  businessLine?: string | null;
  modality?: string | null;
  enrollmentType?: string | null;
}): Promise<D1ResolvedAdditionalBenefits> {
  const campusId = params.campus ? await findD1CampusId(params.campus) : null;
  const rows = await d1All<D1BenefitRow>(
    `SELECT
       b.id, b.applies_to_all, b.benefit_type, b.enrollment_type,
       b.extra_percent, b.first_payment_amount, b.notes,
       b.business_line, b.modality, b.duration, b.updated_at,
       MAX(CASE WHEN l.campus_id = ? THEN 1 ELSE 0 END) AS campus_match
     FROM admin_additional_benefit b
     LEFT JOIN admin_additional_benefit_campus l ON l.benefit_id = b.id
     WHERE b.is_active = 1
     GROUP BY b.id`,
    [campusId ?? ""],
  );

  const matches = rows.filter((row) =>
    matchesScope(row, {
      businessLine: params.businessLine ?? null,
      modality: params.modality ?? null,
      enrollmentType: params.enrollmentType ?? null,
      campusId,
    }),
  );

  const percentage = pick(matches, "percentage");
  const firstPayment = pick(matches, "first_payment");

  return {
    percentageBenefit: percentage ? mapRow(percentage) : null,
    firstPaymentBenefit: firstPayment ? mapRow(firstPayment) : null,
  };
}
