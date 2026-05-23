import { AdminConfigModule } from "@prisma/client";

import {
  getPublishedConfigSnapshot,
  type PriceOverrideSnapshot,
  type PricesDraftSnapshot,
} from "@/lib/admin-config-snapshots";
import { prisma } from "@/lib/prisma";

export async function listActivePublishedPriceOverrides(
  scopes: string[] = ["monto"],
): Promise<PriceOverrideSnapshot[]> {
  const published = await getPublishedConfigSnapshot(AdminConfigModule.PRICES);
  if (published) {
    return (published.snapshot as PricesDraftSnapshot).overrides.filter(
      (override) => override.isActive && scopes.includes(override.scope),
    );
  }

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

  return overrides.map((override) => ({
    id: override.id,
    scope: override.scope,
    targetKeys: JSON.parse(JSON.stringify(override.targetKeys)),
    newPrice: Number(override.newPrice),
    isActive: override.isActive,
    notes: override.notes,
    updatedBy: override.updatedBy,
  }));
}
