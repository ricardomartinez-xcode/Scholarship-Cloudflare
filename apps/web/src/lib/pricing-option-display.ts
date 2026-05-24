import type { CanonicalModalityValue } from "@/lib/pricing-normalize";

const MODALITY_ORDER: Record<string, number> = {
  presencial: 0,
  mixta: 1,
  online: 2,
};

export function visibleQuoteModalities(modalities: string[]): CanonicalModalityValue[] {
  const unique = Array.from(new Set(modalities.filter(Boolean)));
  const nonOnline = unique.filter((modality) => modality !== "online");
  const visible = nonOnline.length ? nonOnline : unique;
  return visible.sort(
    (left, right) => (MODALITY_ORDER[left] ?? 9) - (MODALITY_ORDER[right] ?? 9),
  ) as CanonicalModalityValue[];
}
