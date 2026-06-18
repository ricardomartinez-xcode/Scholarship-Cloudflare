import { AdminConfigModule } from "@prisma/client";

import {
  getPublishedConfigSnapshot,
  type PriceOverrideSnapshot,
  type PricesDraftSnapshot,
} from "@/lib/admin-config-snapshots";
import { prisma } from "@/lib/prisma";

function normalizeOverride(override: {
  id: string;
  scope: string;
  targetKeys: unknown;
  newPrice: unknown;
  isActive: boolean;
  notes: string | null;
  updatedBy: string | null;
}): PriceOverrideSnapshot {
  return {
    id: override.id,
    scope: override.scope,
    targetKeys: JSON.parse(JSON.stringify(override.targetKeys ?? {})),
    newPrice: Number(override.newPrice),
    isActive: override.isActive,
    notes: override.notes,
    updatedBy: override.updatedBy,
  };
}

async function listActiveDbPriceOverrides(scopes: string[]) {
  const overrides = await prisma.adminPriceOverride.findMany({
    where: { isActive: true, scope: { in: scopes } },
    orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      scope: true,
      targetKeys: true,
      newPrice: true,
      isActive: true,
      notes: true,
      updatedBy: true,
    },
  });

  return overrides.map(normalizeOverride);
}

function mergePriceOverrides(
  publishedOverrides: PriceOverrideSnapshot[],
  dbOverrides: PriceOverrideSnapshot[],
) {
  const merged = new Map<string, PriceOverrideSnapshot>();

  for (const override of publishedOverrides) {
    if (override.isActive) merged.set(override.id, override);
  }

  // La DB es la fuente viva para correcciones manuales hechas desde admin/API.
  // Esto evita que un snapshot publicado deje congelado un precio anterior.
  for (const override of dbOverrides) {
    if (override.isActive) merged.set(override.id, override);
  }

  return Array.from(merged.values());
}

export async function listActivePublishedPriceOverrides(
  scopes: string[] = ["base_price"],
): Promise<PriceOverrideSnapshot[]> {
  const [published, dbOverrides] = await Promise.all([
    getPublishedConfigSnapshot(AdminConfigModule.PRICES),
    listActiveDbPriceOverrides(scopes),
  ]);

  const publishedOverrides = published
    ? (published.snapshot as PricesDraftSnapshot).overrides.filter(
        (override) => override.isActive && scopes.includes(override.scope),
      )
    : [];

  return mergePriceOverrides(publishedOverrides, dbOverrides);
}
