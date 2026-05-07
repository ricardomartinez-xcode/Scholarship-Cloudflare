export const ACADEMIC_OFFER_CYCLES = ["C1", "C2", "C3"] as const;

export type AcademicOfferCycle = (typeof ACADEMIC_OFFER_CYCLES)[number];

export const DEFAULT_ACADEMIC_OFFER_VISIBLE_CYCLES: AcademicOfferCycle[] = ["C1"];

export function isAcademicOfferCycle(value: string): value is AcademicOfferCycle {
  return ACADEMIC_OFFER_CYCLES.includes(value as AcademicOfferCycle);
}

export function normalizeAcademicOfferCycle(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return isAcademicOfferCycle(normalized) ? normalized : null;
}

export const EXCEL_SHEETS_OMIT = [
  "Oferta General",
  "Becas académicas",
  "Modalidad 21 vs 24",
];

