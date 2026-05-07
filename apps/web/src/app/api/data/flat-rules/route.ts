import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { loadCanonicalFlatRulesPayload } from "@/lib/canonical-pricing-readers";
import { loadLegacyPricingSnapshot } from "@/lib/legacy-pricing";
import {
  createComparisonSummary,
  logComparisonReport,
  type ComparisonMismatch,
} from "@/lib/runtime-comparison";
import { getPricingReadMode } from "@/lib/runtime-modes";

export const dynamic = "force-dynamic";

type FlatRulePayload = Awaited<
  ReturnType<typeof loadCanonicalFlatRulesPayload>
>[number];

function buildRuleKey(rule: FlatRulePayload) {
  return [
    rule.programa,
    rule.nivel,
    rule.modalidad,
    rule.plan,
    rule.tier ?? "",
    rule.rango?.min ?? "",
    rule.rango?.max ?? "",
  ].join("|");
}

function compareFlatRules(
  legacy: FlatRulePayload[],
  canonical: FlatRulePayload[],
) {
  const mismatches: ComparisonMismatch[] = [];
  const canonicalMap = new Map(canonical.map((rule) => [buildRuleKey(rule), rule]));
  const legacyKeys = new Set<string>();

  for (const legacyRule of legacy) {
    const key = buildRuleKey(legacyRule);
    legacyKeys.add(key);
    const canonicalRule = canonicalMap.get(key);
    if (!canonicalRule) {
      mismatches.push({
        key,
        field: "row",
        legacy: legacyRule,
        canonical: null,
        note: "missing_in_canonical",
      });
      continue;
    }

    const fields: Array<keyof FlatRulePayload> = ["porcentaje", "monto", "origen"];
    for (const field of fields) {
      const legacyValue = legacyRule[field];
      const canonicalValue = canonicalRule[field];
      const bothNumbers =
        typeof legacyValue === "number" && typeof canonicalValue === "number";
      const equal = bothNumbers
        ? Math.abs(legacyValue - canonicalValue) < 0.01
        : legacyValue === canonicalValue;
      if (!equal) {
        mismatches.push({
          key,
          field,
          legacy: legacyValue,
          canonical: canonicalValue,
        });
      }
    }
  }

  for (const canonicalRule of canonical) {
    const key = buildRuleKey(canonicalRule);
    if (legacyKeys.has(key)) continue;
    mismatches.push({
      key,
      field: "row",
      legacy: null,
      canonical: canonicalRule,
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
    const canonical = await loadCanonicalFlatRulesPayload();

    if (pricingReadMode === "canonical") {
      return NextResponse.json(canonical);
    }

    const legacySnapshot = await loadLegacyPricingSnapshot();
    const legacy = legacySnapshot.flatRules;

    if (pricingReadMode === "compare") {
      const mismatches = compareFlatRules(legacy, canonical);
      logComparisonReport({
        channel: "flat-rules",
        mode: "compare",
        summary: createComparisonSummary({
          read: legacy.length,
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
