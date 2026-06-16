import { normalizeAcademicOfferCycle } from "@/config/academicOffer";
import { resolveQuoteAcademicOffering } from "@/lib/quote-academic-offering";
import {
  normalizeBusinessLine,
  normalizeCanonicalModality,
  normalizeEnrollmentType,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
  type EnrollmentTypeValue,
} from "@/lib/pricing-normalize";
import { prisma } from "@/lib/prisma";
import { resolveCanonicalQuote } from "@relead/domain/calculator/quote-service";

export type AdminQuotePayload = {
  enrollmentType?: unknown;
  businessLine?: unknown;
  modality?: unknown;
  plan?: unknown;
  campus?: unknown;
  average?: unknown;
  subjectCount?: unknown;
  module?: unknown;
  extraCharge?: unknown;
  selectedProgramId?: unknown;
  selectedProgramName?: unknown;
  offeringId?: unknown;
  offerCycle?: unknown;
  clientSurface?: unknown;
};

export type NormalizedAdminQuotePayload = {
  enrollmentType: EnrollmentTypeValue | null;
  businessLine: CanonicalBusinessLine | null;
  modality: CanonicalModalityValue | null;
  plan: number | null;
  average: number | null;
  subjectCount: number | null;
  module: string | null;
  extraChargeAmount: number;
  campus: string | null;
  selectedProgramId: string | null;
  selectedProgramName: string | null;
  offeringId: string | null;
  offerCycle: string | null;
  clientSurface: string;
};

export type AdminQuotePayloadInspection = {
  ok: boolean;
  missing: string[];
  invalid: string[];
  normalized: NormalizedAdminQuotePayload;
};

function toOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "amount" in value) {
    return toOptionalNumber((value as { amount?: unknown }).amount);
  }
  return null;
}

export function inspectAdminQuotePayload(
  payload: AdminQuotePayload,
): AdminQuotePayloadInspection {
  const enrollmentType = normalizeEnrollmentType(toOptionalString(payload.enrollmentType));
  const businessLine = normalizeBusinessLine(toOptionalString(payload.businessLine));
  const modality = normalizeCanonicalModality(toOptionalString(payload.modality));
  const plan = toOptionalNumber(payload.plan);
  const average = toOptionalNumber(payload.average);
  const subjectCount = toOptionalNumber(payload.subjectCount);
  const extraChargeAmount = toOptionalNumber(payload.extraCharge) ?? 0;
  const academicModule = toOptionalString(payload.module);

  const normalized: NormalizedAdminQuotePayload = {
    enrollmentType,
    businessLine,
    modality,
    plan,
    average,
    subjectCount,
    module: academicModule,
    extraChargeAmount,
    campus: toOptionalString(payload.campus),
    selectedProgramId: toOptionalString(payload.selectedProgramId),
    selectedProgramName: toOptionalString(payload.selectedProgramName),
    offeringId: toOptionalString(payload.offeringId),
    offerCycle: normalizeAcademicOfferCycle(toOptionalString(payload.offerCycle)),
    clientSurface: toOptionalString(payload.clientSurface) ?? "admin_control",
  };

  const missing = [
    !normalized.enrollmentType ? "enrollmentType" : null,
    !normalized.businessLine ? "businessLine" : null,
    !normalized.modality ? "modality" : null,
    normalized.plan === null ? "plan" : null,
    normalized.average === null ? "average" : null,
  ].filter((value): value is string => Boolean(value));

  const invalid: string[] = [];
  if (plan !== null && (!Number.isInteger(plan) || plan <= 0)) invalid.push("plan");
  if (average !== null && (average < 0 || average > 10)) invalid.push("average");
  if (subjectCount !== null && (!Number.isInteger(subjectCount) || subjectCount <= 0)) {
    invalid.push("subjectCount");
  }
  if (extraChargeAmount < 0) invalid.push("extraCharge");

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    normalized,
  };
}

function toCanonicalQuoteRequest(input: NormalizedAdminQuotePayload) {
  if (
    !input.enrollmentType ||
    !input.businessLine ||
    !input.modality ||
    input.plan === null ||
    input.average === null
  ) {
    return null;
  }

  return {
    enrollmentType: input.enrollmentType,
    businessLine: input.businessLine,
    modality: input.modality,
    plan: input.plan,
    campus: input.campus,
    average: input.average,
    subjectCount: input.subjectCount,
    module: null,
    extraChargeAmount: input.extraChargeAmount,
    selectedProgramId: input.selectedProgramId,
    selectedProgramName: input.selectedProgramName,
    offeringId: input.offeringId,
    offerCycle: input.offerCycle,
  };
}

export async function runAdminQuoteSimulation(payload: AdminQuotePayload) {
  const diagnostics = inspectAdminQuotePayload(payload);
  const requestInput = toCanonicalQuoteRequest(diagnostics.normalized);

  if (!diagnostics.ok || !requestInput) {
    return {
      ok: false as const,
      status: 400,
      errorCode: diagnostics.missing.length ? "MISSING_FIELDS" : "INVALID_PAYLOAD",
      error: diagnostics.missing.length
        ? "Faltan campos obligatorios para simular la cotización."
        : "La solicitud contiene valores inválidos.",
      diagnostics,
    };
  }

  const offeringResolution = await resolveQuoteAcademicOffering({
    offeringId: requestInput.offeringId,
    selectedProgramId: requestInput.selectedProgramId,
    campus: requestInput.campus,
    businessLine: requestInput.businessLine,
    modality: requestInput.modality,
    plan: requestInput.plan,
    module: requestInput.module,
    cycle: requestInput.offerCycle,
  });

  if (!offeringResolution.ok) {
    return {
      ok: false as const,
      status: 422,
      errorCode: "INVALID_OFFERING",
      error: offeringResolution.error,
      hint: offeringResolution.hint,
      diagnostics: {
        ...diagnostics,
        offering: offeringResolution,
      },
    };
  }

  const resolvedInput = {
    ...requestInput,
    ...(offeringResolution.context
      ? {
          businessLine: offeringResolution.context.businessLine,
          modality: offeringResolution.context.modality,
          campus: offeringResolution.context.campusKey,
          selectedProgramId: offeringResolution.context.programId,
          selectedProgramName: offeringResolution.context.programName,
          offeringId: offeringResolution.context.offeringId,
          module: null,
        }
      : {}),
  };

  const result = await resolveCanonicalQuote(resolvedInput);
  return {
    ok: result.ok,
    status: result.ok ? 200 : 422,
    result,
    diagnostics: {
      ...diagnostics,
      offering: offeringResolution,
      resolvedInput,
    },
  };
}

async function inspectDataAvailability(input: NormalizedAdminQuotePayload) {
  const checks: Array<{
    key: string;
    ok: boolean;
    message: string;
    details?: Record<string, unknown>;
  }> = [];

  if (input.campus) {
    const campus = await prisma.campus.findFirst({
      where: {
        isActive: true,
        OR: [
          { code: { equals: input.campus, mode: "insensitive" } },
          { metaKey: { equals: input.campus, mode: "insensitive" } },
          { name: { equals: input.campus, mode: "insensitive" } },
          { slug: { equals: input.campus, mode: "insensitive" } },
        ],
      },
      select: { id: true, code: true, name: true, tier: true },
    });
    checks.push({
      key: "campus",
      ok: Boolean(campus),
      message: campus ? "Campus activo encontrado." : "No se encontró campus activo compatible.",
      details: campus ?? undefined,
    });
  }

  if (input.selectedProgramId || input.selectedProgramName) {
    const program = await prisma.program.findFirst({
      where: {
        OR: [
          ...(input.selectedProgramId ? [{ id: input.selectedProgramId }] : []),
          ...(input.selectedProgramName
            ? [{ name: { contains: input.selectedProgramName, mode: "insensitive" as const } }]
            : []),
        ],
      },
      select: { id: true, name: true, businessLine: true },
    });
    checks.push({
      key: "program",
      ok: Boolean(program),
      message: program ? "Programa encontrado." : "No se encontró programa compatible.",
      details: program ?? undefined,
    });
  }

  if (input.businessLine && input.modality && input.plan !== null) {
    const ruleCount = await prisma.scholarshipRule.count({
      where: {
        businessLine: input.businessLine,
        modality: input.modality,
        plan: input.plan,
        sourceVersion: "canonical",
      },
    });
    checks.push({
      key: "rules",
      ok: ruleCount > 0,
      message: ruleCount > 0 ? "Reglas de beca encontradas." : "No hay reglas para la combinación.",
      details: { count: ruleCount },
    });
  }

  if (input.offeringId) {
    const offering = await prisma.programOffering.findFirst({
      where: { id: input.offeringId, isActive: true, campus: { isActive: true } },
      select: { id: true, cycle: true, pricingPlans: true, track: true },
    });
    checks.push({
      key: "offering",
      ok: Boolean(offering),
      message: offering ? "Oferta académica activa encontrada." : "No se encontró oferta activa.",
      details: offering ?? undefined,
    });
  }

  return checks;
}

export async function diagnoseAdminQuote(payload: AdminQuotePayload) {
  const diagnostics = inspectAdminQuotePayload(payload);
  const dataChecks = await inspectDataAvailability(diagnostics.normalized);

  if (!diagnostics.ok) {
    return {
      ok: true as const,
      canQuote: false,
      diagnostics,
      checks: dataChecks,
      suggestions: [
        ...diagnostics.missing.map((field) => `Completa ${field}.`),
        ...diagnostics.invalid.map((field) => `Corrige ${field}.`),
      ],
    };
  }

  const simulation = await runAdminQuoteSimulation(payload);
  const resultError = simulation.ok ? null : "error" in simulation ? simulation.error : null;
  return {
    ok: true as const,
    canQuote: simulation.ok,
    diagnostics: simulation.diagnostics,
    checks: dataChecks,
    simulation: simulation.ok ? simulation.result : null,
    failure: simulation.ok
      ? null
      : {
          error: resultError,
          status: simulation.status,
          code: "errorCode" in simulation ? simulation.errorCode : "QUOTE_NOT_RESOLVED",
        },
    suggestions: simulation.ok
      ? []
      : [
          "Verifica ciclo, campus, modalidad, programa, plan y reglas de precio/beca publicadas.",
        ],
  };
}
