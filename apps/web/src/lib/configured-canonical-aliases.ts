import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";

import type { CanonicalAliasRuntimeRow } from "./admin-canonical-aliases";

export const getActiveCanonicalAliasRows = cache(async (): Promise<CanonicalAliasRuntimeRow[]> => {
  const rows = await prisma.adminCanonicalAlias.findMany({
    where: { isActive: true },
    orderBy: [{ aliasType: "asc" }, { aliasNormalized: "asc" }],
    select: {
      aliasType: true,
      canonicalValue: true,
      canonicalNormalized: true,
      aliasValue: true,
      aliasNormalized: true,
      isActive: true,
    },
  });

  return rows.map((row) => ({
    aliasType: row.aliasType,
    canonicalValue: row.canonicalValue,
    canonicalNormalized: row.canonicalNormalized,
    aliasValue: row.aliasValue,
    aliasNormalized: row.aliasNormalized,
    isActive: row.isActive,
  }));
});
