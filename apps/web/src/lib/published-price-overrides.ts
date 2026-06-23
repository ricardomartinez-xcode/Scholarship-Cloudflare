import { AdminConfigModule } from "@prisma/client";

import {
  type PriceOverrideSnapshot,
  type PricesDraftSnapshot,
} from "@/lib/admin-config-snapshots";
import { prisma } from "@/lib/prisma";

type PriceOverrideClient = Pick<
  typeof prisma,
  "adminPriceOverride" | "adminPublishedConfig"
>;

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

async function listActiveDbPriceOverrides(
  scopes: string[],
  client: PriceOverrideClient,
) {
  const overrides = await client.adminPriceOverride.findMany({
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

async function listPublishedSnapshotPriceOverrides(
  scopes: string[],
  client: PriceOverrideClient,
) {
  const published = await client.adminPublishedConfig.findUnique({
    where: { module: AdminConfigModule.PRICES },
    select: {
      version: {
        select: { snapshot: true },
      },
    },
  });

  if (!published) return [];

  return (published.version.snapshot as PricesDraftSnapshot).overrides.filter(
    (override) => override.isActive && scopes.includes(override.scope),
  );
}

export function mergePriceOverrideLayers(
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

export async function listPriceOverrideLayers(
  scopes: string[] = ["base_price"],
  client: PriceOverrideClient = prisma,
) {
  const [publishedOverrides, liveOverrides] = await Promise.all([
    listPublishedSnapshotPriceOverrides(scopes, client),
    listActiveDbPriceOverrides(scopes, client),
  ]);

  return { publishedOverrides, liveOverrides };
}

export async function listActivePublishedPriceOverrides(
  scopes: string[] = ["base_price"],
  client: PriceOverrideClient = prisma,
): Promise<PriceOverrideSnapshot[]> {
  const { publishedOverrides, liveOverrides } = await listPriceOverrideLayers(
    scopes,
    client,
  );

  return mergePriceOverrideLayers(publishedOverrides, liveOverrides);
}
