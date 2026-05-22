/**
 * campus-resolver.ts — Business-logic layer for resolving campus identities.
 *
 * Provides smart lookups that can match a campus by code, metaKey, name, or slug
 * using normalized string comparison. Use this module whenever business logic
 * needs to find a specific campus from a raw/user-supplied value.
 *
 * For bulk queries, integrity checks, and administrative operations over the
 * full campus table, use `campus.ts` instead.
 */
import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeKey } from "@/lib/text-normalize";

export type CampusIdentity = {
  id: string;
  code: string;
  metaKey: string;
  name: string;
  slug: string;
  tier: string | null;
  kind: "campus" | "online";
};

type CampusClient = Pick<PrismaClient, "campus">;

export const campusIdentitySelect = {
  id: true,
  code: true,
  metaKey: true,
  name: true,
  slug: true,
  tier: true,
  kind: true,
} as const;

export async function listCampusCatalog(
  client: CampusClient = prisma,
): Promise<CampusIdentity[]> {
  const campuses = await client.campus.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: campusIdentitySelect,
  });

  return campuses as CampusIdentity[];
}

export function resolveCampusFromCatalog(
  campuses: CampusIdentity[],
  raw: string | null | undefined,
) {
  const normalized = normalizeKey(raw ?? "");
  if (!normalized) return null;

  return (
    campuses.find((campus) => {
      return (
        normalizeKey(campus.code) === normalized ||
        normalizeKey(campus.metaKey) === normalized ||
        normalizeKey(campus.name) === normalized ||
        normalizeKey(campus.slug) === normalized
      );
    }) ?? null
  );
}

export async function resolveCampus(
  raw: string | null | undefined,
  client: CampusClient = prisma,
) {
  const campuses = await listCampusCatalog(client);
  return resolveCampusFromCatalog(campuses, raw);
}

export function buildCampusAliases(
  campus: CampusIdentity | null,
  raw: string | null | undefined,
) {
  const aliases = new Set<string>();
  const push = (value: string | null | undefined) => {
    const normalized = String(value ?? "").trim();
    if (normalized) aliases.add(normalized);
  };

  push(raw);
  if (campus) {
    push(campus.code);
    push(campus.metaKey);
    push(campus.name);
    push(campus.slug);
  }

  return Array.from(aliases);
}
