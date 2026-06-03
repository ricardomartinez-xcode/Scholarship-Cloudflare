import { revalidatePath } from "next/cache";
import {
  AdminAuditAction,
  AdminCapability,
  AdminConfigModule,
  BenefitBusinessLine,
  CanonicalModality,
  EnrollmentType,
} from "@prisma/client";

import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { requireRecalcPublicApiCapability } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BaseScholarshipPayload = {
  id?: unknown;
  enrollmentType?: unknown;
  businessLine?: unknown;
  modality?: unknown;
  plan?: unknown;
  campusTier?: unknown;
  region?: unknown;
  plantel?: unknown;
  programaKey?: unknown;
  minAverage?: unknown;
  maxAverage?: unknown;
  scholarshipPercent?: unknown;
};

const ENROLLMENT_TYPES = new Set(Object.values(EnrollmentType));
const BUSINESS_LINES = new Set(Object.values(BenefitBusinessLine));
const MODALITIES = new Set(Object.values(CanonicalModality));

function normalizeProgramKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function serializeScholarshipRule(rule: {
  id: string;
  enrollmentType: EnrollmentType;
  businessLine: BenefitBusinessLine;
  modality: CanonicalModality;
  plan: number;
  campusTier: string;
  region: string;
  plantel: string;
  programaKey: string;
  minAverage: unknown;
  maxAverage: unknown;
  scholarshipPercent: unknown;
  sourceVersion: string;
}) {
  return {
    id: rule.id,
    enrollmentType: rule.enrollmentType,
    businessLine: rule.businessLine,
    modality: rule.modality,
    plan: rule.plan,
    campusTier: rule.campusTier,
    region: rule.region,
    plantel: rule.plantel,
    programaKey: rule.programaKey,
    minAverage: rule.minAverage === null ? null : Number(rule.minAverage),
    maxAverage: rule.maxAverage === null ? null : Number(rule.maxAverage),
    scholarshipPercent:
      rule.scholarshipPercent === null ? null : Number(rule.scholarshipPercent),
    sourceVersion: rule.sourceVersion,
  };
}

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("public_recalc_base_scholarship");
  const auth = await requireRecalcPublicApiCapability(
    request,
    requestId,
    AdminCapability.manage_benefits,
  );
  if (!auth.ok) return auth.response;

  const payload = (await request.json().catch(() => null)) as BaseScholarshipPayload | null;
  if (!payload) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_JSON",
      error: "El cuerpo JSON no es valido.",
      recoverable: true,
    });
  }

  const id = text(payload.id);
  const enrollmentType = text(payload.enrollmentType);
  const businessLine = text(payload.businessLine);
  const modality = text(payload.modality);
  const plan = Number(payload.plan);
  const minAverage = Number(payload.minAverage);
  const maxAverage = Number(payload.maxAverage);
  const scholarshipPercent = Number(payload.scholarshipPercent);

  if (!ENROLLMENT_TYPES.has(enrollmentType as EnrollmentType)) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_ENROLLMENT_TYPE",
      error: "enrollmentType no es valido.",
      recoverable: true,
    });
  }
  if (!BUSINESS_LINES.has(businessLine as BenefitBusinessLine)) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_BUSINESS_LINE",
      error: "businessLine no es valido.",
      recoverable: true,
    });
  }
  if (!MODALITIES.has(modality as CanonicalModality)) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_MODALITY",
      error: "modality no es valida.",
      recoverable: true,
    });
  }
  if (!Number.isInteger(plan) || plan <= 0) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_PLAN",
      error: "plan debe ser entero mayor a 0.",
      recoverable: true,
    });
  }
  if (
    !Number.isFinite(minAverage) ||
    !Number.isFinite(maxAverage) ||
    minAverage < 0 ||
    maxAverage > 10 ||
    minAverage > maxAverage
  ) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_AVERAGE_RANGE",
      error: "El rango de promedio debe estar entre 0 y 10.",
      recoverable: true,
    });
  }
  if (
    !Number.isFinite(scholarshipPercent) ||
    scholarshipPercent < 0 ||
    scholarshipPercent > 100
  ) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_SCHOLARSHIP_PERCENT",
      error: "scholarshipPercent debe estar entre 0 y 100.",
      recoverable: true,
    });
  }

  const where = {
    enrollmentType: enrollmentType as EnrollmentType,
    businessLine: businessLine as BenefitBusinessLine,
    modality: modality as CanonicalModality,
    plan,
    campusTier: text(payload.campusTier) || "ANY",
    region: text(payload.region),
    plantel: text(payload.plantel),
    programaKey: normalizeProgramKey(payload.programaKey),
    minAverage,
    maxAverage,
    sourceVersion: "canonical",
  };

  const before = id
    ? await prisma.scholarshipRule.findUnique({ where: { id } })
    : await prisma.scholarshipRule.findFirst({ where });
  if (id && !before) {
    return adminApiError({
      requestId,
      status: 404,
      errorCode: "SCHOLARSHIP_RULE_NOT_FOUND",
      error: "La regla de beca no existe.",
      recoverable: true,
    });
  }

  const saved = before
    ? await prisma.scholarshipRule.update({
        where: { id: before.id },
        data: { ...where, scholarshipPercent, origin: "public-recalc-api" },
      })
    : await prisma.scholarshipRule.create({
        data: {
          ...where,
          scholarshipPercent,
          discountedPriceMxn: null,
          origin: "public-recalc-api",
        },
      });

  await writeAdminAuditLog({
    module: AdminConfigModule.BENEFITS,
    action: before ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
    actor: auth.actor,
    entityType: "ScholarshipRule",
    entityId: saved.id,
    requestId,
    before: before ? serializeScholarshipRule(before) : null,
    after: serializeScholarshipRule(saved),
    message: "Regla de beca base actualizada desde API publica Recalc.",
  });

  revalidatePath("/admin/benefits");
  revalidatePath("/admin/prices");
  revalidatePath("/");
  revalidatePath("/unidep");

  return adminApiSuccess(requestId, { scholarshipRule: serializeScholarshipRule(saved) });
}
