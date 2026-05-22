import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { listCampusCatalog } from "@/lib/campus-resolver";
import { loadCanonicalReturnSubjectPayload } from "@/lib/canonical-pricing-readers";
import { loadLegacyPricingSnapshot } from "@/lib/legacy-pricing";
import {
  createComparisonSummary,
  logComparisonReport,
  type ComparisonMismatch,
} from "@/lib/runtime-comparison";
import { getPricingReadMode } from "@/lib/runtime-modes";

export const dynamic = "force-dynamic";

type ReturnPayload = Awaited<ReturnType<typeof loadCanonicalReturnSubjectPayload>>;

function flattenReturnPayload(payload: ReturnPayload) {
  const entries: Array<{
    key: string;
    price: number;
  }> = [];

  for (const [campus, modalities] of Object.entries(payload.materias ?? {})) {
    for (const [modality, subjects] of Object.entries(modalities)) {
      for (const [subjectCount, price] of Object.entries(subjects)) {
        entries.push({
          key: `${campus}|${modality}|${subjectCount}`,
          price,
        });
      }
    }
  }

  return entries;
}

function compareReturnPayloads(legacy: ReturnPayload, canonical: ReturnPayload) {
  const mismatches: ComparisonMismatch[] = [];
  const canonicalMap = new Map(
    flattenReturnPayload(canonical).map((entry) => [entry.key, entry.price]),
  );
  const legacyKeys = new Set<string>();

  for (const entry of flattenReturnPayload(legacy)) {
    legacyKeys.add(entry.key);
    const canonicalValue = canonicalMap.get(entry.key);
    if (canonicalValue === undefined) {
      mismatches.push({
        key: entry.key,
        field: "row",
        legacy: entry.price,
        canonical: null,
        note: "missing_in_canonical",
      });
      continue;
    }

    if (Math.abs(entry.price - canonicalValue) >= 0.01) {
      mismatches.push({
        key: entry.key,
        field: "price",
        legacy: entry.price,
        canonical: canonicalValue,
      });
    }
  }

  for (const entry of flattenReturnPayload(canonical)) {
    if (legacyKeys.has(entry.key)) continue;
    mismatches.push({
      key: entry.key,
      field: "row",
      legacy: null,
      canonical: entry.price,
      note: "missing_in_legacy",
    });
  }

  return mismatches;
}

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
      const campuses = await listCampusCatalog();
      const canonical = await loadCanonicalReturnSubjectPayload(campuses);
      return NextResponse.json(canonical);
    }

    const legacySnapshot = await loadLegacyPricingSnapshot();
    const legacy: ReturnPayload = {
      version: legacySnapshot.regreso.version ?? "legacy",
      materias: legacySnapshot.regreso.materias,
    };

    if (pricingReadMode === "compare") {
      const campuses = await listCampusCatalog();
      const canonical = await loadCanonicalReturnSubjectPayload(campuses);
      const mismatches = compareReturnPayloads(legacy, canonical);
      logComparisonReport({
        channel: "regreso-materias",
        mode: "compare",
        summary: createComparisonSummary({
          read: flattenReturnPayload(legacy).length,
          conflicted: mismatches.length,
        }),
        mismatches,
      });
    }

    return NextResponse.json(legacy);
  } catch {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
