/**
 * legacy-pricing.ts — Legacy scholarship quote calculation engine (v1 system).
 *
 * ⚠️  INTENTIONAL DUAL SYSTEM — do not remove without completing migration.
 *
 * This module implements the original SQL-based scholarship quote calculation
 * that reads flat rules directly from the `recalc_*` tables.
 * It is kept alongside `scholarship-quote-service.ts` (canonical v2 system) so
 * that `GET /api/data/quote` can run both engines in parallel and compare
 * their results as a validation safety net during the v1 → v2 migration.
 *
 * Migration status: `runtime-modes.ts` controls which engine is the primary
 * response and which is used only for comparison/logging.
 *
 * When to remove: once `scholarship-quote-service.ts` is validated as stable
 * in production and `runtime-modes.ts` no longer references "legacy" mode.
 */
import { getSql } from "@/lib/neon";
import { listActivePublishedPriceOverrides } from "@/lib/published-price-overrides";
import type { PriceOverrideSnapshot } from "@/lib/admin-config-snapshots";
import {
  buildLegacyDiscountedOverrideMap,
  findPublishedBasePriceOverride,
  legacyDiscountedOverrideKey,
} from "@/lib/base-price-overrides";
import {
  basePriceFromRule,
  basePriceFromRules,
  findNearestRule,
  findRuleForAverage,
  getRuleEnrollmentType,
  listRuleRanges,
  requiresCampusForQuote,
  toNumber,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
  type EnrollmentTypeValue,
} from "@/lib/pricing-normalize";
import { resolveAdditionalBenefits } from "@/lib/additional-benefits";
import {
  buildCampusAliases,
  listCampusCatalog,
  resolveCampusFromCatalog,
  type CampusIdentity,
} from "@/lib/campus-resolver";
import { normalizeKey } from "@/lib/text-normalize";

const MAX_REGRESO_SCHOLARSHIP = 25;

export type LegacyFlatRule = {
  programa: string;
  nivel: string;
  modalidad: string;
  plan: number;
  tier: string | null;
  rango: { min: number | null; max: number | null } | null;
  porcentaje: number | null;
  monto: number | null;
  origen: string | null;
};

type MetaPlantel = {
  tier?: string | null;
  oferta?: Record<string, Record<string, { neto?: number }>>;
};

export type LegacyMetaPayload = {
  version?: string | null;
  generated_at_utc?: string | null;
  fuentes?: Record<string, unknown>;
  rango_promedio_a_beca?: Record<string, unknown>;
  reglas_base?: Record<string, unknown>;
  reglas_excepciones_por_plantel?: Record<string, unknown>;
  disponibilidad?: Record<string, unknown>;
  planteles?: Record<string, MetaPlantel>;
  notas?: Record<string, unknown>;
};

export type LegacyRegresoPayload = {
  version?: string | null;
  materias: Record<string, Record<string, Record<string, number>>>;
};

export type LegacyPricingSnapshot = {
  flatRules: LegacyFlatRule[];
  meta: LegacyMetaPayload;
  regreso: LegacyRegresoPayload;
  campuses: CampusIdentity[];
  overrides: PriceOverrideSnapshot[];
};

export type LegacyScholarshipQuoteResult =
  | {
      ok: true;
      basePriceMxn: number;
      scholarshipPercent: number;
      scholarshipAmountMxn: number;
      additionalBenefitPercent: number;
      additionalBenefitNotes: string | null;
      additionalBenefitDuration: string | null;
      additionalBenefitAmountMxn: number;
      fixedScholarshipPercent: number;
      fixedScholarshipNotes: string | null;
      fixedScholarshipDuration: string | null;
      scholarshipSource: "average" | "fixed" | "none";
      firstPaymentAmountMxn: number;
      firstPaymentNotes: string | null;
      firstPaymentDuration: string | null;
      subtotalMxn: number;
      totalMxn: number;
      tier: string | null;
      source: "legacy";
      sinAccessToScholarship: boolean;
    }
  | {
      ok: false;
      error: string;
      hint?: string;
      missing?: string[];
      ranges?: string[];
      source: "legacy";
    };

function toLegacyBusinessLine(businessLine: CanonicalBusinessLine) {
  if (businessLine === "prepa") return "preparatoria";
  if (businessLine === "posgrado") return "maestria";
  return businessLine;
}

function getTierForPlantel(meta: LegacyMetaPayload, plantelKey: string) {
  if (!plantelKey) return null;
  return meta.planteles?.[plantelKey]?.tier ?? null;
}

function getOfertaNeto(
  meta: LegacyMetaPayload,
  plantelKey: string,
  nivel: string,
  plan: number,
) {
  const offer = meta.planteles?.[plantelKey]?.oferta?.[nivel]?.[String(plan)];
  return typeof offer?.neto === "number" ? offer.neto : null;
}

function findMetaPlantelKey(
  meta: LegacyMetaPayload,
  campuses: CampusIdentity[],
  rawCampus: string | null | undefined,
) {
  const metaKeys = Object.keys(meta.planteles ?? {});
  const normalized = normalizeKey(rawCampus ?? "");
  if (!normalized) return "";

  const exact = metaKeys.find((key) => normalizeKey(key) === normalized);
  if (exact) return exact;

  const campus = resolveCampusFromCatalog(campuses, rawCampus);
  if (!campus) return "";

  const aliases = buildCampusAliases(campus, rawCampus).map((alias) =>
    normalizeKey(alias),
  );

  return (
    metaKeys.find((key) => aliases.includes(normalizeKey(key))) ??
    campus.name ??
    ""
  );
}

function getMateriasPrecio(
  regreso: LegacyRegresoPayload,
  modality: CanonicalModalityValue,
  rawCampus: string | null | undefined,
  subjectCount: number,
) {
  const plantelEntries = regreso.materias ?? {};
  const normalizedCampus = normalizeKey(rawCampus ?? "");
  const plantelBucket =
    plantelEntries[String(rawCampus ?? "")] ??
    Object.entries(plantelEntries).find(
      ([key]) => normalizeKey(key) === normalizedCampus,
    )?.[1];

  if (!plantelBucket) return null;

  const modalidadKey = modality === "online" ? "online" : "presencial";
  const modalityBucket =
    plantelBucket[modalidadKey] ??
    Object.entries(plantelBucket).find(
      ([key]) => normalizeKey(key) === normalizeKey(modalidadKey),
    )?.[1];

  if (!modalityBucket) return null;
  return modalityBucket[String(subjectCount)] ?? null;
}

export async function loadLegacyPricingSnapshot(): Promise<LegacyPricingSnapshot> {
  const sql = getSql();
  const campuses = await listCampusCatalog();

  const [ruleRows, metaRows, regresoRows, overrides] = await Promise.all([
    sql`
      select
        id,
        programa_key as programa,
        nivel_key as nivel,
        modalidad_key as modalidad,
        plan,
        tier,
        rango_min as min,
        rango_max as max,
        porcentaje,
        monto,
        origen
      from recalc_regla_beca
      order by id
    `,
    sql`
      select *
      from recalc_meta
      order by id desc
      limit 1
    `,
    sql`
      select plantel, modalidad, materias_count, costo
      from recalc_regreso_materias
      order by plantel, modalidad, materias_count
    `,
    listActivePublishedPriceOverrides(),
  ]);

  const legacyDiscountedOverrideMap = buildLegacyDiscountedOverrideMap(overrides);

  const flatRules: LegacyFlatRule[] = ruleRows.map((row) => {
    const key = legacyDiscountedOverrideKey({
      enrollmentType: String(row.programa) as EnrollmentTypeValue,
      businessLine: String(row.nivel),
      modality: String(row.modalidad),
      plan: Number(row.plan),
      tier: row.tier ? String(row.tier) : null,
    });
    return {
      programa: String(row.programa),
      nivel: String(row.nivel),
      modalidad: String(row.modalidad),
      plan: Number(row.plan),
      tier: row.tier ? String(row.tier) : null,
      rango:
        row.min !== null || row.max !== null
          ? {
              min: row.min === null ? null : Number(row.min),
              max: row.max === null ? null : Number(row.max),
            }
          : null,
      porcentaje: row.porcentaje === null ? null : Number(row.porcentaje),
      monto:
        legacyDiscountedOverrideMap.get(key) ??
        (row.monto === null ? null : Number(row.monto)),
      origen: row.origen ? String(row.origen) : null,
    };
  });

  const latestMeta = metaRows[0];
  const meta: LegacyMetaPayload = latestMeta
    ? {
        version: latestMeta.version ?? null,
        generated_at_utc: latestMeta.generated_at_utc ?? null,
        fuentes: latestMeta.fuentes ?? {},
        rango_promedio_a_beca: latestMeta.rango_promedio_a_beca ?? {},
        reglas_base: latestMeta.reglas_base ?? {},
        reglas_excepciones_por_plantel:
          latestMeta.reglas_excepciones_por_plantel ?? {},
        disponibilidad: latestMeta.disponibilidad ?? {},
        planteles: latestMeta.planteles ?? {},
        notas: latestMeta.notas ?? {},
      }
    : {};

  const materias: LegacyRegresoPayload["materias"] = {};
  for (const row of regresoRows) {
    const rawPlantel = String(row.plantel);
    const modality = String(row.modalidad);
    const campus = resolveCampusFromCatalog(campuses, rawPlantel);
    const aliases = buildCampusAliases(campus, rawPlantel);

    for (const alias of aliases) {
      if (!materias[alias]) materias[alias] = {};
      if (!materias[alias][modality]) materias[alias][modality] = {};
      materias[alias][modality][String(row.materias_count)] = Number(row.costo);
    }
  }

  return {
    flatRules,
    meta,
    regreso: {
      version: latestMeta?.version ?? "db",
      materias,
    },
    campuses,
    overrides,
  };
}

export async function computeLegacyScholarshipQuote(
  input: {
    enrollmentType: EnrollmentTypeValue;
    businessLine: CanonicalBusinessLine;
    modality: CanonicalModalityValue;
    plan: number;
    campus?: string | null;
    average: number;
    subjectCount?: number | null;
    extraChargeAmount?: number;
  },
  snapshot?: LegacyPricingSnapshot,
): Promise<LegacyScholarshipQuoteResult> {
  const pricing = snapshot ?? (await loadLegacyPricingSnapshot());
  const ruleEnrollmentType = getRuleEnrollmentType(input.enrollmentType);
  const legacyBusinessLine = toLegacyBusinessLine(input.businessLine);
  const requiresCampus = requiresCampusForQuote(
    input.businessLine,
    input.modality,
  );

  if (requiresCampus && !String(input.campus ?? "").trim()) {
    return {
      ok: false,
      error: "Falta seleccionar un plantel.",
      hint: "Selecciona un plantel para continuar con el cálculo.",
      missing: ["campus"],
      source: "legacy",
    };
  }

  if (
    input.enrollmentType === "regreso" &&
    input.businessLine === "licenciatura" &&
    (!input.subjectCount || input.subjectCount <= 0)
  ) {
    return {
      ok: false,
      error: "Falta seleccionar materias.",
      hint: "Selecciona cuántas materias se van a inscribir.",
      missing: ["subjectCount"],
      source: "legacy",
    };
  }

  let candidateRules = pricing.flatRules.filter(
    (rule) =>
      rule.programa === ruleEnrollmentType &&
      rule.nivel === legacyBusinessLine &&
      rule.modalidad === input.modality &&
      Number(rule.plan) === Number(input.plan),
  );

  if (!candidateRules.length) {
    return {
      ok: false,
      error: "No hay reglas para esta combinación.",
      hint: "Intenta cambiar línea de negocio, modalidad o plan de estudios.",
      source: "legacy",
    };
  }

  const plantelKey =
    input.modality === "online"
      ? "ONLINE"
      : findMetaPlantelKey(pricing.meta, pricing.campuses, input.campus);
  const tier =
    input.modality === "online"
      ? "ANY"
      : getTierForPlantel(pricing.meta, plantelKey) ?? "ANY";

  const byTier = candidateRules.filter(
    (rule) => (rule.tier ?? "ANY") === tier,
  );
  if (byTier.length) {
    candidateRules = byTier;
  }

  const mappedRules = candidateRules.map((rule) => ({
    enrollmentType: rule.programa,
    businessLine: rule.nivel,
    modality: rule.modalidad,
    plan: rule.plan,
    campusTier: rule.tier,
    minAverage: rule.rango?.min ?? null,
    maxAverage: rule.rango?.max ?? null,
    scholarshipPercent: rule.porcentaje,
    discountedPriceMxn: rule.monto,
  }));

  const benefits = await resolveAdditionalBenefits({
    campus: input.campus ?? plantelKey,
    businessLine: input.businessLine,
    modality: input.modality,
    enrollmentType: ruleEnrollmentType,
  });

  const fixedScholarshipBenefit = benefits.fixedScholarshipBenefit;
  const fixedScholarshipPercent = fixedScholarshipBenefit?.extraPercent ?? 0;
  const usesFixedScholarship = fixedScholarshipPercent > 0;

  const average = Math.round(Number(input.average) * 10) / 10;
  const sinAccessToScholarship = average < 7 && !usesFixedScholarship;

  let matchedRule = sinAccessToScholarship || usesFixedScholarship
    ? null
    : findRuleForAverage(mappedRules, average);

  if (!sinAccessToScholarship && !usesFixedScholarship && !matchedRule) {
    const nearest = findNearestRule(mappedRules, average);
    if (nearest) {
      const min = toNumber(nearest.minAverage);
      const max = toNumber(nearest.maxAverage);
      if (
        min !== null &&
        max !== null &&
        average >= min - 0.05 &&
        average <= max + 0.05
      ) {
        matchedRule = nearest;
      }
    }
  }

  if (!sinAccessToScholarship && !usesFixedScholarship && !matchedRule) {
    return {
      ok: false,
      error: "No se encontró costo para ese promedio en esta combinación.",
      hint:
        "Revisa el promedio o elige otra combinación. Abajo se muestran rangos válidos.",
      ranges: listRuleRanges(mappedRules),
      source: "legacy",
    };
  }

  let scholarshipPercent = usesFixedScholarship
    ? fixedScholarshipPercent
    : matchedRule && "scholarshipPercent" in matchedRule
      ? (toNumber(matchedRule.scholarshipPercent) ?? 0)
      : 0;
  if (!usesFixedScholarship && input.enrollmentType !== "nuevo_ingreso") {
    scholarshipPercent = Math.min(
      scholarshipPercent,
      MAX_REGRESO_SCHOLARSHIP,
    );
  }

  const subjectPrice =
    input.enrollmentType === "regreso" &&
    input.businessLine === "licenciatura" &&
    input.subjectCount
      ? getMateriasPrecio(
          pricing.regreso,
          input.modality,
          input.campus ?? plantelKey,
          input.subjectCount,
        )
      : null;

  const offerNet =
    input.modality === "online"
      ? null
      : getOfertaNeto(pricing.meta, plantelKey, legacyBusinessLine, input.plan);

  const basePriceOverride = findPublishedBasePriceOverride(pricing.overrides, {
    businessLine: input.businessLine,
    modality: input.modality,
    plan: input.plan,
    tier: tier === "ANY" ? null : tier,
  });

  const basePriceMxn =
    subjectPrice ??
    basePriceOverride ??
    offerNet ??
    basePriceFromRules(mappedRules) ??
    basePriceFromRule(
      matchedRule && "discountedPriceMxn" in matchedRule
        ? matchedRule
        : null,
    );

  if (basePriceMxn === null) {
    return {
      ok: false,
      error: "No fue posible determinar el costo base de esta combinación.",
      source: "legacy",
    };
  }

  const percentageBenefit =
    input.enrollmentType === "regreso" ? null : benefits.percentageBenefit;
  const firstPaymentBenefit = benefits.firstPaymentBenefit;
  const additionalBenefitPercent = percentageBenefit?.extraPercent ?? 0;
  const effectiveScholarshipPercent = sinAccessToScholarship ? 0 : scholarshipPercent;
  const scholarshipAmountMxn = basePriceMxn * (effectiveScholarshipPercent / 100);
  const additionalBenefitAmountMxn =
    basePriceMxn * (additionalBenefitPercent / 100);
  const firstPaymentAmountMxn = firstPaymentBenefit?.firstPaymentAmount ?? 0;
  const subtotalMxn =
    basePriceMxn - scholarshipAmountMxn - additionalBenefitAmountMxn;
  const totalMxn = subtotalMxn + Number(input.extraChargeAmount ?? 0);

  return {
    ok: true,
    basePriceMxn,
    scholarshipPercent: effectiveScholarshipPercent,
    scholarshipAmountMxn,
    additionalBenefitPercent,
    additionalBenefitNotes: percentageBenefit?.notes ?? null,
    additionalBenefitDuration: percentageBenefit?.duration ?? null,
    additionalBenefitAmountMxn,
    fixedScholarshipPercent: usesFixedScholarship ? fixedScholarshipPercent : 0,
    fixedScholarshipNotes: fixedScholarshipBenefit?.notes ?? null,
    fixedScholarshipDuration: fixedScholarshipBenefit?.duration ?? null,
    scholarshipSource: sinAccessToScholarship
      ? "none"
      : usesFixedScholarship
        ? "fixed"
        : "average",
    firstPaymentAmountMxn,
    firstPaymentNotes: firstPaymentBenefit?.notes ?? null,
    firstPaymentDuration: firstPaymentBenefit?.duration ?? null,
    subtotalMxn,
    totalMxn,
    tier: tier === "ANY" ? null : tier,
    source: "legacy",
    sinAccessToScholarship,
  };
}
