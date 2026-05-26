import {
  normalizeBusinessLine,
  normalizeCanonicalModality,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
} from "@/lib/pricing-normalize";

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

const MODALITY_ORDER: Record<CanonicalModalityValue, number> = {
  presencial: 0,
  mixta: 1,
  online: 2,
};

const VISIBLE_MODALITIES_BY_BUSINESS_LINE: Record<
  CanonicalBusinessLine,
  CanonicalModalityValue[]
> = {
  licenciatura: ["presencial", "mixta", "online"],
  prepa: ["presencial", "online"],
  salud: ["presencial"],
  posgrado: ["online"],
};

function sortModalities<T extends string>(modalities: T[]) {
  return [...modalities].sort(
    (left, right) =>
      (MODALITY_ORDER[left as CanonicalModalityValue] ?? 9) -
      (MODALITY_ORDER[right as CanonicalModalityValue] ?? 9),
  );
}

export function visibleQuoteModalities(
  modalities: string[],
  businessLine?: string,
): CanonicalModalityValue[] {
  const normalizedBusinessLine = normalizeBusinessLine(businessLine);

  if (normalizedBusinessLine) {
    return VISIBLE_MODALITIES_BY_BUSINESS_LINE[normalizedBusinessLine];
  }

  const available = modalities
    .map((modality) => normalizeCanonicalModality(modality))
    .filter((modality): modality is CanonicalModalityValue => Boolean(modality));

  return sortModalities(Array.from(new Set(available)));
}

export function visibleQuoteCampuses(
  campuses: QuoteCampusOption[],
  modality?: string,
  businessLine?: string,
  plan?: number | null,
  programId?: string | null,
): QuoteCampusOption[] {
  const normalizedBusinessLine = normalizeBusinessLine(businessLine);
  const normalizedModality = normalizeCanonicalModality(modality);
  const selectedBusinessLine = normalizedBusinessLine ?? businessLine;
  const selectedModality = normalizedModality ?? modality;

  if (selectedModality === "online") {
    const sourceOnlineCampus: QuoteCampusOption =
      campuses.find((campus) => campus.value.toUpperCase() === ONLINE_QUOTE_CAMPUS.value) ??
      ONLINE_QUOTE_CAMPUS;
    const onlineCampus: QuoteCampusOption = {
      ...sourceOnlineCampus,
      value: ONLINE_QUOTE_CAMPUS.value,
      label: sourceOnlineCampus.label || ONLINE_QUOTE_CAMPUS.label,
    };

    if (!selectedBusinessLine || !selectedModality || !sourceOnlineCampus.pricingOptions?.length) {
      return [onlineCampus];
    }

    return sourceOnlineCampus.pricingOptions.some(
      (option) =>
        option.businessLine === selectedBusinessLine &&
        option.modality === selectedModality &&
        (!plan || option.plan === plan) &&
        (!programId || option.programId === programId),
    )
      ? [onlineCampus]
      : [];
  }

  return campuses
    .filter((campus) => campus.value && campus.value.toUpperCase() !== ONLINE_QUOTE_CAMPUS.value)
    .filter((campus) => {
      if (!selectedBusinessLine || !campus.businessLines?.length) return true;
      return campus.businessLines.includes(selectedBusinessLine);
    })
    .filter((campus) => {
      if (!selectedModality || !campus.modalities?.length) return true;
      return campus.modalities.includes(selectedModality);
    })
    .filter((campus) => {
      if (!selectedBusinessLine || !selectedModality) return true;
      if (!campus.pricingOptions?.length) return false;
      return campus.pricingOptions.some(
        (option) =>
          option.businessLine === selectedBusinessLine &&
          option.modality === selectedModality &&
          (!plan || option.plan === plan) &&
          (!programId || option.programId === programId),
      );
    })
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
}
