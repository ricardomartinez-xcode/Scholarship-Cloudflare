import type { CanonicalModalityValue } from "@/lib/pricing-normalize";

export type QuoteCampusOption = {
  value: string;
  label: string;
  businessLines?: string[];
  modalities?: string[];
  pricingOptions?: Array<{
    businessLine: string;
    modality: string;
    plan: number;
    programId?: string;
  }>;
};

export const ONLINE_QUOTE_CAMPUS = { value: "ONLINE", label: "Online" } as const;

const MODALITY_ORDER: Record<string, number> = {
  presencial: 0,
  mixta: 1,
  online: 2,
};

export function visibleQuoteModalities(
  modalities: string[],
  businessLine?: string,
): CanonicalModalityValue[] {
  const unique = Array.from(new Set(modalities.filter(Boolean)));
  if (businessLine === "licenciatura") {
    return unique.sort(
      (left, right) => (MODALITY_ORDER[left] ?? 9) - (MODALITY_ORDER[right] ?? 9),
    ) as CanonicalModalityValue[];
  }

  const nonOnline = unique.filter((modality) => modality !== "online");
  const visible = nonOnline.length ? nonOnline : unique;
  return visible.sort(
    (left, right) => (MODALITY_ORDER[left] ?? 9) - (MODALITY_ORDER[right] ?? 9),
  ) as CanonicalModalityValue[];
}

export function visibleQuoteCampuses(
  campuses: QuoteCampusOption[],
  modality?: string,
  businessLine?: string,
  plan?: number | null,
  programId?: string | null,
): QuoteCampusOption[] {
  if (modality === "online") {
    const onlineCampus: QuoteCampusOption =
      campuses.find((campus) => campus.value === ONLINE_QUOTE_CAMPUS.value) ??
      ONLINE_QUOTE_CAMPUS;
    if (!businessLine || !modality || !onlineCampus.pricingOptions?.length) {
      return [onlineCampus];
    }
    return onlineCampus.pricingOptions.some(
      (option) =>
        option.businessLine === businessLine &&
        option.modality === modality &&
        (!plan || option.plan === plan) &&
        (!programId || option.programId === programId),
    )
      ? [onlineCampus]
      : [];
  }

  return campuses
    .filter((campus) => campus.value && campus.value !== ONLINE_QUOTE_CAMPUS.value)
    .filter((campus) => {
      if (!businessLine || !campus.businessLines?.length) return true;
      return campus.businessLines.includes(businessLine);
    })
    .filter((campus) => {
      if (!modality || !campus.modalities?.length) return true;
      return campus.modalities.includes(modality);
    })
    .filter((campus) => {
      if (!businessLine || !modality || !campus.pricingOptions?.length) return true;
      return campus.pricingOptions.some(
        (option) =>
          option.businessLine === businessLine &&
          option.modality === modality &&
          (!plan || option.plan === plan) &&
          (!programId || option.programId === programId),
      );
    })
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
}
