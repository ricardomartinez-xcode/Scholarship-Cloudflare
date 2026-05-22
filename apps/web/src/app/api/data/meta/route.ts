import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { listCampusCatalog } from "@/lib/campus-resolver";
import { getSql } from "@/lib/neon";
import {
  createComparisonSummary,
  logComparisonReport,
  type ComparisonMismatch,
} from "@/lib/runtime-comparison";
import { getPricingReadMode } from "@/lib/runtime-modes";
import { normalizeKey } from "@/lib/text-normalize";
import staticPricingMeta from "../../../../../public/data/costos_2026_meta.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getSessionUser();
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (auth.status === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (auth.status === "inactive") {
    return NextResponse.json({ error: "inactive" }, { status: 403 });
  }

  try {
    const pricingReadMode = getPricingReadMode();

    if (pricingReadMode === "canonical") {
      return NextResponse.json(staticPricingMeta);
    }

    // Nota: este endpoint no tiene implementación canónica en Prisma. En modo
    // canónico usa el JSON versionado del repo para no transferir recalc_meta.
    // Solo los modos legacy/compare leen Neon.
    const sql = getSql();
    const rows = await sql`
      select *
      from recalc_meta
      order by id desc
      limit 1
    `;
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (pricingReadMode === "compare") {
      const campuses = await listCampusCatalog();
      const mismatches: ComparisonMismatch[] = [];
      const metaPlanteles = row.planteles ?? {};

      for (const campus of campuses) {
        const metaMatch = Object.entries(metaPlanteles as Record<string, { tier?: string | null }>).find(
          ([key]) => normalizeKey(key) === normalizeKey(campus.name),
        );
        if (!metaMatch) continue;

        const metaTier = metaMatch[1]?.tier ?? null;
        const campusTier = campus.tier ?? null;
        if ((metaTier ?? null) !== (campusTier ?? null)) {
          mismatches.push({
            key: campus.code,
            field: "tier",
            legacy: metaTier,
            canonical: campusTier,
          });
        }
      }

      logComparisonReport({
        channel: "meta-campus-tier",
        mode: "compare",
        summary: createComparisonSummary({
          read: campuses.length,
          conflicted: mismatches.length,
        }),
        mismatches,
      });
    }

    return NextResponse.json({
      version: row.version,
      generated_at_utc: row.generated_at_utc,
      fuentes: row.fuentes ?? {},
      rango_promedio_a_beca: row.rango_promedio_a_beca ?? {},
      reglas_base: row.reglas_base ?? {},
      reglas_excepciones_por_plantel: row.reglas_excepciones_por_plantel ?? {},
      disponibilidad: row.disponibilidad ?? {},
      planteles: row.planteles ?? {},
      notas: row.notas ?? {},
    });
  } catch {
    return NextResponse.json(
      { error: "neon_query_failed" },
      { status: 500 },
    );
  }
}
