/**
 * campus.ts — Generic database access layer for campus data.
 *
 * Provides bulk queries and integrity checks over the campus table.
 * Use this module for administrative operations, health checks, and
 * scenarios that need all campus rows (e.g. integrity validation).
 *
 * For business-logic lookups (resolve a campus by code / metaKey / name / slug),
 * use `campus-resolver.ts` instead.
 */
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS,
  PUBLIC_ROUTE_CACHE_TAGS,
} from "@/lib/public-route-cache";

export type CampusRow = {
  id: string;
  code: string;
  metaKey: string;
  name: string;
  slug: string;
  tier: string | null;
  kind: "campus" | "online";
  isActive: boolean;
  sortOrder: number;
};

export type PublicCampusRow = CampusRow & {
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
};

export const EXPECTED_ACTIVE_CAMPUS_COUNT = 24;
export const EXPECTED_ACTIVE_ONLINE_COUNT = 1;

export type CampusIntegrity = {
  available: boolean;
  ok: boolean;
  total: number;
  active: number;
  activeCampus: number;
  activeOnline: number;
  expectedCampus: number;
  expectedOnline: number;
};

export async function getActiveCampuses(): Promise<CampusRow[]> {
  const rows = await prisma.campus.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      metaKey: true,
      name: true,
      slug: true,
      tier: true,
      kind: true,
      isActive: true,
      sortOrder: true,
    },
  });
  return rows as CampusRow[];
}

export async function getCampusIntegrity(): Promise<CampusIntegrity> {
  try {
    const total = await prisma.campus.count();
    const active = await prisma.campus.count({ where: { isActive: true } });
    const activeCampus = await prisma.campus.count({
      where: { isActive: true, kind: "campus" },
    });
    const activeOnline = await prisma.campus.count({
      where: { isActive: true, kind: "online" },
    });

    const ok =
      activeCampus === EXPECTED_ACTIVE_CAMPUS_COUNT &&
      activeOnline === EXPECTED_ACTIVE_ONLINE_COUNT &&
      active >= EXPECTED_ACTIVE_CAMPUS_COUNT + EXPECTED_ACTIVE_ONLINE_COUNT;
    return {
      available: true,
      ok,
      total,
      active,
      activeCampus,
      activeOnline,
      expectedCampus: EXPECTED_ACTIVE_CAMPUS_COUNT,
      expectedOnline: EXPECTED_ACTIVE_ONLINE_COUNT,
    };
  } catch {
    return {
      available: false,
      ok: false,
      total: 0,
      active: 0,
      activeCampus: 0,
      activeOnline: 0,
      expectedCampus: EXPECTED_ACTIVE_CAMPUS_COUNT,
      expectedOnline: EXPECTED_ACTIVE_ONLINE_COUNT,
    };
  }
}

const loadPublicCampusSnapshot = unstable_cache(
  async () => {
    const [integrity, campuses] = await Promise.all([
      getCampusIntegrity(),
      prisma.campus.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          code: true,
          metaKey: true,
          name: true,
          slug: true,
          tier: true,
          kind: true,
          isActive: true,
          sortOrder: true,
          address: true,
          phone: true,
          whatsapp: true,
        },
      }),
    ]);

    return {
      campuses: campuses as PublicCampusRow[],
      integrity,
    };
  },
  ["public-campus-snapshot"],
  {
    revalidate: PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS,
    tags: [PUBLIC_ROUTE_CACHE_TAGS.campuses],
  },
);

export function getCachedPublicCampusSnapshot() {
  return loadPublicCampusSnapshot();
}
