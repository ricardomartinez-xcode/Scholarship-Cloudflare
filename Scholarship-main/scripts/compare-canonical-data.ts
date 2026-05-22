import path from "node:path";

import dotenv from "dotenv";

import { loadCanonicalFlatRulesPayload, loadCanonicalReturnSubjectPayload } from "@/lib/canonical-pricing-readers";
import { projectDirectoryContact } from "@/lib/directory-projection";
import {
  computeLegacyScholarshipQuote,
  loadLegacyPricingSnapshot,
} from "@/lib/legacy-pricing";
import {
  normalizeBusinessLine,
  normalizeCanonicalModality,
  normalizeTier,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
  type EnrollmentTypeValue,
} from "@/lib/pricing-normalize";
import { prisma } from "@/lib/prisma";
import { resolveScholarshipQuote } from "@/lib/scholarship-quote-service";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

function compareNumbers(
  field: string,
  legacy: number | null | undefined,
  canonical: number | null | undefined,
  key: string,
  mismatches: Array<Record<string, unknown>>,
) {
  const left = legacy ?? null;
  const right = canonical ?? null;
  if (left === null && right === null) return;
  if (typeof left === "number" && typeof right === "number") {
    if (Math.abs(left - right) < 0.01) return;
  } else if (left === right) {
    return;
  }
  mismatches.push({ key, field, legacy: left, canonical: right });
}

function buildRuleKey(rule: {
  programa: string;
  nivel: string;
  modalidad: string;
  plan: number | string;
  tier?: string | null;
  rango?: { min: number | null; max: number | null } | null;
}) {
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

function buildRepresentativeQuoteCases(snapshot: Awaited<ReturnType<typeof loadLegacyPricingSnapshot>>) {
  const cases: Array<{
    enrollmentType: EnrollmentTypeValue;
    businessLine: CanonicalBusinessLine;
    modality: CanonicalModalityValue;
    plan: number;
    campus: string | null;
    average: number;
    subjectCount?: number;
  }> = [];
  const seen = new Set<string>();

  for (const rule of snapshot.flatRules) {
    const businessLine = normalizeBusinessLine(rule.nivel);
    const modality = normalizeCanonicalModality(rule.modalidad);
    if (!businessLine || !modality) continue;
    const enrollmentType =
      rule.programa === "nuevo_ingreso" ? "nuevo_ingreso" : "reingreso";
    const tier = normalizeTier(rule.tier ?? null);
    const campus =
      modality === "online"
        ? null
        : snapshot.campuses.find((candidate) => normalizeTier(candidate.tier) === tier)?.name ??
          snapshot.campuses.find((candidate) => candidate.kind === "campus")?.name ??
          null;

    const key = `${enrollmentType}|${businessLine}|${modality}|${rule.plan}|${campus ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    cases.push({
      enrollmentType,
      businessLine,
      modality,
      plan: Number(rule.plan),
      campus,
      average: 8.5,
    });

    if (cases.length >= 12) break;
  }

  const regresoCampus =
    snapshot.campuses.find((campus) => campus.kind === "campus")?.name ?? null;
  if (regresoCampus) {
    cases.push({
      enrollmentType: "regreso",
      businessLine: "licenciatura",
      modality: "presencial",
      plan: 9,
      campus: regresoCampus,
      average: 8.5,
      subjectCount: 3,
    });
    cases.push({
      enrollmentType: "regreso",
      businessLine: "licenciatura",
      modality: "online",
      plan: 9,
      campus: "ONLINE",
      average: 8.5,
      subjectCount: 3,
    });
  }

  return cases;
}

async function main() {
  const legacySnapshot = await loadLegacyPricingSnapshot();
  const canonicalRules = await loadCanonicalFlatRulesPayload();
  const canonicalReturn = await loadCanonicalReturnSubjectPayload(legacySnapshot.campuses);
  const report = {
    generatedAt: new Date().toISOString(),
    rules: {
      read: 0,
      mismatches: [] as Array<Record<string, unknown>>,
    },
    returnSubjectPrices: {
      read: 0,
      mismatches: [] as Array<Record<string, unknown>>,
    },
    directory: {
      read: 0,
      mismatches: [] as Array<Record<string, unknown>>,
    },
    quotes: {
      read: 0,
      mismatches: [] as Array<Record<string, unknown>>,
    },
  };

  const canonicalRuleMap = new Map(
    canonicalRules.map((rule) => [buildRuleKey(rule), rule]),
  );
  for (const rule of legacySnapshot.flatRules) {
    report.rules.read += 1;
    const key = buildRuleKey(rule);
    const canonical = canonicalRuleMap.get(key);
    if (!canonical) {
      report.rules.mismatches.push({ key, reason: "missing_in_canonical" });
      continue;
    }
    compareNumbers("porcentaje", rule.porcentaje, canonical.porcentaje, key, report.rules.mismatches);
    compareNumbers("monto", rule.monto, canonical.monto, key, report.rules.mismatches);
    if ((rule.origen ?? null) !== (canonical.origen ?? null)) {
      report.rules.mismatches.push({
        key,
        field: "origen",
        legacy: rule.origen ?? null,
        canonical: canonical.origen ?? null,
      });
    }
  }

  const canonicalReturnMap = new Map<string, number>();
  for (const [campus, modalities] of Object.entries(canonicalReturn.materias)) {
    for (const [modality, subjects] of Object.entries(modalities)) {
      for (const [subjectCount, price] of Object.entries(subjects)) {
        canonicalReturnMap.set(`${campus}|${modality}|${subjectCount}`, price);
      }
    }
  }

  for (const [campus, modalities] of Object.entries(legacySnapshot.regreso.materias)) {
    for (const [modality, subjects] of Object.entries(modalities)) {
      for (const [subjectCount, price] of Object.entries(subjects)) {
        report.returnSubjectPrices.read += 1;
        compareNumbers(
          "price",
          price,
          canonicalReturnMap.get(`${campus}|${modality}|${subjectCount}`),
          `${campus}|${modality}|${subjectCount}`,
          report.returnSubjectPrices.mismatches,
        );
      }
    }
  }

  const directoryContacts = await prisma.directoryContact.findMany({
    orderBy: [{ campus: { name: "asc" } }, { role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      zone: true,
      role: true,
      name: true,
      email: true,
      phone: true,
      source: true,
      methods: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          type: true,
          value: true,
          normalizedValue: true,
          isPrimary: true,
          sortOrder: true,
        },
      },
      campus: {
        select: { id: true, code: true, metaKey: true, name: true, slug: true },
      },
    },
  });

  for (const contact of directoryContacts) {
    report.directory.read += 1;
    const legacy = projectDirectoryContact({ ...contact, methods: [] });
    const canonical = projectDirectoryContact(contact);
    if (legacy.contact !== canonical.contact) {
      report.directory.mismatches.push({
        key: contact.id,
        field: "contact",
        legacy: legacy.contact,
        canonical: canonical.contact,
      });
    }
  }

  const quoteCases = buildRepresentativeQuoteCases(legacySnapshot);
  for (const quoteCase of quoteCases) {
    report.quotes.read += 1;
    const legacy = await computeLegacyScholarshipQuote(quoteCase, legacySnapshot);
    const canonical = await resolveScholarshipQuote(quoteCase);
    const key = JSON.stringify(quoteCase);

    if (legacy.ok !== canonical.ok) {
      report.quotes.mismatches.push({
        key,
        field: "ok",
        legacy: legacy.ok,
        canonical: canonical.ok,
      });
      continue;
    }
    if (!legacy.ok || !canonical.ok) {
      if ((legacy.ok ? null : legacy.error) !== (canonical.ok ? null : canonical.error)) {
        report.quotes.mismatches.push({
          key,
          field: "error",
          legacy: legacy.ok ? null : legacy.error,
          canonical: canonical.ok ? null : canonical.error,
        });
      }
      continue;
    }

    compareNumbers("basePriceMxn", legacy.basePriceMxn, canonical.basePriceMxn, key, report.quotes.mismatches);
    compareNumbers("scholarshipPercent", legacy.scholarshipPercent, canonical.scholarshipPercent, key, report.quotes.mismatches);
    compareNumbers("additionalBenefitPercent", legacy.additionalBenefitPercent, canonical.additionalBenefitPercent, key, report.quotes.mismatches);
    compareNumbers("subtotalMxn", legacy.subtotalMxn, canonical.subtotalMxn, key, report.quotes.mismatches);
    compareNumbers("totalMxn", legacy.totalMxn, canonical.totalMxn, key, report.quotes.mismatches);
    if ((legacy.tier ?? null) !== (canonical.tier ?? null)) {
      report.quotes.mismatches.push({
        key,
        field: "tier",
        legacy: legacy.tier ?? null,
        canonical: canonical.tier ?? null,
      });
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
