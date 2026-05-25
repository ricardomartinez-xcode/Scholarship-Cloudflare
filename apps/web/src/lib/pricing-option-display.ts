import type { CanonicalModalityValue } from "@/lib/pricing-normalize";

export type QuoteCampusOption = {
  value: string;
  label: string;
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
): QuoteCampusOption[] {
  if (modality === "online") {
    return [
      campuses.find((campus) => campus.value === ONLINE_QUOTE_CAMPUS.value) ??
        ONLINE_QUOTE_CAMPUS,
    ];
  }

  return campuses
    .filter((campus) => campus.value && campus.value !== ONLINE_QUOTE_CAMPUS.value)
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
}
