import "server-only";

import { prisma } from "@/lib/prisma";
import {
  ACADEMIC_OFFER_CYCLES,
  DEFAULT_ACADEMIC_OFFER_VISIBLE_CYCLES,
  normalizeAcademicOfferCycle,
  type AcademicOfferCycle,
} from "@/config/academicOffer";
import { getD1SidebarInfoValue } from "@/lib/cloudflare/public-data";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";

const ACADEMIC_OFFER_VISIBLE_CYCLES_KEY = "academic_offer.visible_cycles";

function sortAcademicOfferCycles(cycles: Iterable<AcademicOfferCycle>) {
  const order = new Map(ACADEMIC_OFFER_CYCLES.map((cycle, index) => [cycle, index]));
  return Array.from(new Set(cycles)).sort(
    (left, right) => (order.get(left) ?? 99) - (order.get(right) ?? 99),
  );
}

function parseAcademicOfferCycles(raw: string | null | undefined) {
  if (!raw) return [...DEFAULT_ACADEMIC_OFFER_VISIBLE_CYCLES];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_ACADEMIC_OFFER_VISIBLE_CYCLES];
    const cycles = parsed
      .map((entry) => normalizeAcademicOfferCycle(String(entry ?? "")))
      .filter((entry): entry is AcademicOfferCycle => entry !== null);
    return cycles.length
      ? sortAcademicOfferCycles(cycles)
      : [...DEFAULT_ACADEMIC_OFFER_VISIBLE_CYCLES];
  } catch {
    return [...DEFAULT_ACADEMIC_OFFER_VISIBLE_CYCLES];
  }
}

export function serializeAcademicOfferVisibleCycles(cycles: AcademicOfferCycle[]) {
  return JSON.stringify(sortAcademicOfferCycles(cycles));
}

export async function getAcademicOfferVisibleCycles() {
  if (isCloudflareRuntime()) {
    const row = await getD1SidebarInfoValue(ACADEMIC_OFFER_VISIBLE_CYCLES_KEY);
    if (!row?.is_active) return [...DEFAULT_ACADEMIC_OFFER_VISIBLE_CYCLES];
    return parseAcademicOfferCycles(row.value);
  }

  const row = await prisma.adminSidebarInfo.findUnique({
    where: { key: ACADEMIC_OFFER_VISIBLE_CYCLES_KEY },
    select: { value: true, isActive: true },
  });
  if (!row?.isActive) return [...DEFAULT_ACADEMIC_OFFER_VISIBLE_CYCLES];
  return parseAcademicOfferCycles(row.value);
}

export async function saveAcademicOfferVisibleCycles(
  cycles: AcademicOfferCycle[],
  updatedBy: string,
) {
  const normalized = sortAcademicOfferCycles(cycles);
  await prisma.adminSidebarInfo.upsert({
    where: { key: ACADEMIC_OFFER_VISIBLE_CYCLES_KEY },
    update: {
      value: serializeAcademicOfferVisibleCycles(normalized),
      isActive: true,
      updatedBy,
    },
    create: {
      key: ACADEMIC_OFFER_VISIBLE_CYCLES_KEY,
      value: serializeAcademicOfferVisibleCycles(normalized),
      isActive: true,
      updatedBy,
    },
  });
  return normalized;
}

export { ACADEMIC_OFFER_VISIBLE_CYCLES_KEY };
