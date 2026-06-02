import {
  ACADEMIC_OFFER_CYCLES,
  DEFAULT_ACADEMIC_OFFER_VISIBLE_CYCLES,
  normalizeAcademicOfferCycle,
  type AcademicOfferCycle,
} from "@/config/academicOffer";

export type OfferDraftSnapshotLike = {
  cycles?: unknown;
  visibleCycles?: unknown;
  campuses?: unknown;
  programs?: unknown;
  offerings?: Array<{
    id: string;
    campusId: string;
    programId: string;
    cycle: string;
    track: string | null;
    delivery: string;
    escolarizado: boolean;
    ejecutivo: boolean;
    escolarizadoSchedule: string | null;
    ejecutivoSchedule: string | null;
    lineOfBusiness: string | null;
    pricingPlans?: number[];
    subjectsByModule?: string | null;
    isActive: boolean;
    archivedReason: string | null;
    updatedBy: string | null;
  }>;
};

function sortOfferCycles(cycles: Iterable<AcademicOfferCycle>) {
  return Array.from(new Set(cycles)).sort(
    (left, right) => ACADEMIC_OFFER_CYCLES.indexOf(left) - ACADEMIC_OFFER_CYCLES.indexOf(right),
  );
}

function normalizeOfferCycleList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return sortOfferCycles(
    value
      .map((entry) => normalizeAcademicOfferCycle(String(entry ?? "")))
      .filter((entry): entry is AcademicOfferCycle => entry !== null),
  );
}

export function normalizeOfferDraftSnapshot<T extends OfferDraftSnapshotLike>(snapshot: T) {
  const offerings = Array.isArray(snapshot.offerings)
    ? snapshot.offerings.map((offering) => ({
        ...offering,
        track: offering.track?.trim() ? offering.track : "Longitudinal",
        subjectsByModule: offering.subjectsByModule ?? null,
      }))
    : [];
  const derivedCycles = sortOfferCycles(
    offerings
      .map((offering) => normalizeAcademicOfferCycle(offering.cycle))
      .filter((entry): entry is AcademicOfferCycle => entry !== null),
  );
  const normalizedCycles = normalizeOfferCycleList(snapshot.cycles);
  const cycles = normalizedCycles.length ? normalizedCycles : derivedCycles;
  const normalizedVisibleCycles = normalizeOfferCycleList(snapshot.visibleCycles);
  const visibleCycles = normalizedVisibleCycles.length
    ? normalizedVisibleCycles
    : cycles.length
      ? cycles
      : [...DEFAULT_ACADEMIC_OFFER_VISIBLE_CYCLES];

  return {
    ...snapshot,
    cycles,
    visibleCycles,
    campuses: Array.isArray(snapshot.campuses) ? snapshot.campuses : [],
    programs: Array.isArray(snapshot.programs) ? snapshot.programs : [],
    offerings,
  };
}
