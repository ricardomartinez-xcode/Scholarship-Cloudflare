"use server";

import { revalidatePath } from "next/cache";
import {
  AdminAdditionalBenefitType,
  AdminCapability,
  AdminAuditAction,
  AdminConfigModule,
  BenefitBusinessLine,
  BenefitDuration,
  BenefitModality,
  CanonicalModality,
  EnrollmentType,
  Prisma,
} from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { captureException, logStructured } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

const BUSINESS_LINES = new Set<BenefitBusinessLine>([
  BenefitBusinessLine.salud,
  BenefitBusinessLine.licenciatura,
  BenefitBusinessLine.prepa,
  BenefitBusinessLine.posgrado,
]);

const MODALITIES = new Set<BenefitModality>([
  BenefitModality.presencial,
  BenefitModality.mixta,
  BenefitModality.online,
]);

const DURATIONS = new Set<BenefitDuration>([
  BenefitDuration.primer_cuatrimestre,
  BenefitDuration.toda_la_carrera,
  BenefitDuration.pago_inicial,
]);

const BENEFIT_TYPES = new Set<AdminAdditionalBenefitType>([
  AdminAdditionalBenefitType.percentage,
  AdminAdditionalBenefitType.first_payment,
]);

const ENROLLMENT_TYPES = new Set<EnrollmentType>([
  EnrollmentType.nuevo_ingreso,
  EnrollmentType.regreso,
  EnrollmentType.reingreso,
]);

const BENEFITS_WRITE_CAPABILITY = AdminCapability.manage_benefits;

function parseCampusIds(raw: FormDataEntryValue | null): string[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) return arr.map(String);
  } catch {
    // ignore
  }
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseOptionalEnum<T extends string>(
  raw: FormDataEntryValue | null,
  allowed: Set<T>
) {
  const value = String(raw ?? "").trim();
  if (!value || value === "__ALL__") return { value: null, error: null };
  if (!allowed.has(value as T)) {
    return { value: null, error: "Valor inválido." };
  }
  return { value: value as T, error: null };
}



function normalizeProgramKey(raw: FormDataEntryValue | null) {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!value || value === "todos" || value === "todas" || value === "general" || value === "any") {
    return "";
  }
  return value.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeScopeText(raw: FormDataEntryValue | null) {
  return String(raw ?? "").trim();
}
async function loadBenefitAuditPayload(id: string) {
  const benefit = await prisma.adminAdditionalBenefit.findUnique({
    where: { id },
    select: {
      id: true,
      appliesToAll: true,
      benefitType: true,
      enrollmentType: true,
      extraPercent: true,
      firstPaymentAmount: true,
      isActive: true,
      notes: true,
      businessLine: true,
      modality: true,
      duration: true,
      updatedBy: true,
      campuses: {
        orderBy: [{ campusId: "asc" }],
        select: { campusId: true },
      },
    },
  });
  if (!benefit) return null;
  return {
    id: benefit.id,
    appliesToAll: benefit.appliesToAll,
    benefitType: benefit.benefitType,
    enrollmentType: benefit.enrollmentType,
    extraPercent: benefit.extraPercent,
    firstPaymentAmount: Number(benefit.firstPaymentAmount),
    isActive: benefit.isActive,
    notes: benefit.notes,
    businessLine: benefit.businessLine,
    modality: benefit.modality,
    duration: benefit.duration,
    updatedBy: benefit.updatedBy,
    campusIds: benefit.campuses.map((campus) => campus.campusId),
  };
}

export async function upsertBenefitAction(formData: FormData) {
  try {
    const admin = await requireAdminCapabilityUser(BENEFITS_WRITE_CAPABILITY);

    const id = String(formData.get("id") ?? "").trim();
    const campusIds = parseCampusIds(formData.get("campusIds"));
    const extraPercent = Number(formData.get("extraPercent") ?? 0);
    const firstPaymentAmount = Number(formData.get("firstPaymentAmount") ?? 0);
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const benefitTypeValue = String(formData.get("benefitType") ?? "").trim();
    const businessLineResult = parseOptionalEnum(
      formData.get("businessLine"),
      BUSINESS_LINES
    );
    const modalityResult = parseOptionalEnum(formData.get("modality"), MODALITIES);
    const durationResult = parseOptionalEnum(formData.get("duration"), DURATIONS);
    const enrollmentTypeResult = parseOptionalEnum(
      formData.get("enrollmentType"),
      ENROLLMENT_TYPES
    );

    if (
      !BENEFIT_TYPES.has(benefitTypeValue as AdminAdditionalBenefitType) ||
      businessLineResult.error ||
      modalityResult.error ||
      durationResult.error ||
      enrollmentTypeResult.error
    ) {
      return { ok: false, error: "Alcance inválido. Revisa los campos nuevos." };
    }

    const benefitType = benefitTypeValue as AdminAdditionalBenefitType;
    const businessLine = businessLineResult.value;
    const modality = modalityResult.value;
    const duration =
      benefitType === AdminAdditionalBenefitType.first_payment
        ? BenefitDuration.pago_inicial
        : durationResult.value;
    const enrollmentType = enrollmentTypeResult.value;
    const typedBusinessLine = businessLine as BenefitBusinessLine | null;
    const typedModality = modality as BenefitModality | null;
    const typedDuration = duration as BenefitDuration | null;
    const typedEnrollmentType = enrollmentType as EnrollmentType | null;

    if (
      benefitType === AdminAdditionalBenefitType.percentage
    ) {
      if (!Number.isFinite(extraPercent) || extraPercent <= 0) {
        return { ok: false, error: "El % debe ser un número mayor que 0." };
      }
      if (extraPercent % 5 !== 0) {
        return { ok: false, error: "El % debe ser múltiplo de 5." };
      }
      if (extraPercent > 100) {
        return { ok: false, error: "El % no puede ser mayor a 100." };
      }
    }
    if (benefitType === AdminAdditionalBenefitType.first_payment) {
      if (!Number.isFinite(firstPaymentAmount) || firstPaymentAmount <= 0) {
        return {
          ok: false,
          error: "El monto de Primer pago debe ser un número mayor que 0.",
        };
      }
    }
    if (!campusIds.length) {
      return { ok: false, error: "Selecciona al menos un plantel (o 'Todos')." };
    }

    const appliesToAll = campusIds.includes("__ALL__");
    const selectedCampusIds = appliesToAll
      ? []
      : Array.from(new Set(campusIds.filter((c) => c && c !== "__ALL__")));
    if (!appliesToAll && !selectedCampusIds.length) {
      return { ok: false, error: "Selecciona al menos un plantel válido." };
    }
    if (!appliesToAll) {
      const existingCampuses = await prisma.campus.findMany({
        where: {
          id: { in: selectedCampusIds },
          isActive: true,
        },
        select: { id: true },
      });
      if (existingCampuses.length !== selectedCampusIds.length) {
        return {
          ok: false,
          error: "Uno o más planteles ya no están activos. Recarga el catálogo e intenta de nuevo.",
        };
      }
    }
    const before = id ? await loadBenefitAuditPayload(id) : null;
    let savedBenefitId = id;

    await prisma.$transaction(async (tx) => {
      let benefitId = id;

      if (id) {
        await tx.adminAdditionalBenefit.update({
          where: { id },
          data: {
            appliesToAll,
            benefitType,
            enrollmentType: typedEnrollmentType,
            extraPercent:
              benefitType === AdminAdditionalBenefitType.percentage
                ? extraPercent
                : 0,
            firstPaymentAmount:
              benefitType === AdminAdditionalBenefitType.first_payment
                ? firstPaymentAmount
                : 0,
            isActive,
            notes,
            businessLine: typedBusinessLine,
            modality: typedModality,
            duration: typedDuration,
            updatedBy: admin.email,
          },
        });
      } else {
        const created = await tx.adminAdditionalBenefit.create({
          data: {
            appliesToAll,
            benefitType,
            enrollmentType: typedEnrollmentType,
            extraPercent:
              benefitType === AdminAdditionalBenefitType.percentage
                ? extraPercent
                : 0,
            firstPaymentAmount:
              benefitType === AdminAdditionalBenefitType.first_payment
                ? firstPaymentAmount
                : 0,
            isActive,
            notes,
            businessLine: typedBusinessLine,
            modality: typedModality,
            duration: typedDuration,
            updatedBy: admin.email,
          },
          select: { id: true },
        });
        benefitId = created.id;
      }

      savedBenefitId = benefitId;

      // Reset join rows and re-create.
      await tx.adminAdditionalBenefitCampus.deleteMany({
        where: { benefitId },
      });
      if (!appliesToAll && selectedCampusIds.length) {
        await tx.adminAdditionalBenefitCampus.createMany({
          data: selectedCampusIds.map((campusId) => ({ benefitId, campusId })),
        });
      }
    });

    if (savedBenefitId) {
      const after = await loadBenefitAuditPayload(savedBenefitId);
      if (after) {
        await writeAdminAuditLog({
          module: AdminConfigModule.BENEFITS,
          action: before ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
          actor: admin,
          entityType: "AdminAdditionalBenefit",
          entityId: after.id,
          before,
          after,
        });
        logStructured("info", "Benefit saved", {
          module: "admin-benefits",
          action: before ? "update" : "create",
          result: "success",
          actorUserId: admin.id,
          actorEmail: admin.email,
          subjectType: "AdminAdditionalBenefit",
          subjectId: after.id,
        });
      }
    }

    revalidatePath("/admin/benefits");
    revalidatePath("/");
    revalidatePath("/unidep");
    return { ok: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2004"
    ) {
      return {
        ok: false,
        error:
          "La configuración del beneficio no pasó una validación interna. Recarga la página e inténtalo de nuevo.",
      };
    }
    captureException(error, {
      module: "admin-benefits",
      action: "upsert",
      result: "failure",
    }, "Failed to save admin benefit");
    return { ok: false, error: "No fue posible guardar el beneficio." };
  }
}

export async function deleteBenefitAction(formData: FormData) {
  const admin = await requireAdminCapabilityUser(BENEFITS_WRITE_CAPABILITY);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const before = await loadBenefitAuditPayload(id);
  await prisma.adminAdditionalBenefit.delete({ where: { id } });

  if (before) {
    await writeAdminAuditLog({
      module: AdminConfigModule.BENEFITS,
      action: AdminAuditAction.DELETE,
      actor: admin,
      entityType: "AdminAdditionalBenefit",
      entityId: before.id,
      before,
      after: null,
    });
    logStructured("info", "Benefit deleted", {
      module: "admin-benefits",
      action: "delete",
      result: "success",
      actorUserId: admin.id,
      actorEmail: admin.email,
      subjectType: "AdminAdditionalBenefit",
      subjectId: before.id,
    });
  }

  revalidatePath("/admin/benefits");
  revalidatePath("/");
  revalidatePath("/unidep");
}

export async function upsertBaseScholarshipAction(formData: FormData) {
  try {
    const admin = await requireAdminCapabilityUser(BENEFITS_WRITE_CAPABILITY);

    const id = String(formData.get("id") ?? "").trim();
    const enrollmentType = String(formData.get("enrollmentType") ?? "").trim();
    const businessLine = String(formData.get("businessLine") ?? "").trim();
    const modality = String(formData.get("modality") ?? "").trim();
    const campusId = String(formData.get("campusId") ?? "__ALL__").trim();
    const submittedCampusTier = String(formData.get("campusTier") ?? "").trim();
    const region = normalizeScopeText(formData.get("region"));
    const submittedPlantel = normalizeScopeText(formData.get("plantel"));
    const programaKey = normalizeProgramKey(formData.get("programaKey"));
    const plan = Number(formData.get("plan") ?? "");
    const scholarshipPercent = Number(formData.get("scholarshipPercent") ?? "");
    const minAverage = Number(formData.get("minAverage") ?? "");
    const maxAverage = Number(formData.get("maxAverage") ?? "");

    if (!ENROLLMENT_TYPES.has(enrollmentType as EnrollmentType)) {
      return { ok: false, error: "Selecciona un tipo de inscripción válido." };
    }
    if (!BUSINESS_LINES.has(businessLine as BenefitBusinessLine)) {
      return { ok: false, error: "Selecciona una línea de negocio válida." };
    }
    if (!MODALITIES.has(modality as BenefitModality)) {
      return { ok: false, error: "Selecciona una modalidad válida." };
    }
    if (!Number.isInteger(plan) || plan <= 0) {
      return { ok: false, error: "El plan debe ser un número entero mayor que 0." };
    }
    if (
      !Number.isFinite(scholarshipPercent) ||
      scholarshipPercent < 0 ||
      scholarshipPercent > 100
    ) {
      return { ok: false, error: "El % de beca debe estar entre 0 y 100." };
    }
    if (
      !Number.isFinite(minAverage) ||
      !Number.isFinite(maxAverage) ||
      minAverage < 0 ||
      maxAverage > 10 ||
      minAverage > maxAverage
    ) {
      return {
        ok: false,
        error: "El promedio debe tener un rango válido entre 0 y 10.",
      };
    }

    let campusTier = submittedCampusTier || "ANY";
    let plantel = submittedPlantel;
    if (campusId && campusId !== "__ALL__") {
      const campus = await prisma.campus.findFirst({
        where: { id: campusId, isActive: true },
        select: { tier: true, name: true, metaKey: true },
      });
      if (!campus) {
        return { ok: false, error: "Selecciona un plantel activo." };
      }
      plantel = plantel || campus.metaKey || campus.name;
      if (!submittedCampusTier) {
        campusTier = String(campus.tier ?? "").trim();
        if (!campusTier) {
          if (modality === CanonicalModality.online || campus.name.toLowerCase() === "online") {
            campusTier = "ANY";
          } else {
            return {
              ok: false,
              error: "El plantel seleccionado no tiene tier configurado.",
            };
          }
        }
      }
    }

    const where = {
      enrollmentType: enrollmentType as EnrollmentType,
      businessLine: businessLine as BenefitBusinessLine,
      modality: modality as CanonicalModality,
      plan,
      campusTier,
      region,
      plantel,
      programaKey,
      minAverage,
      maxAverage,
      sourceVersion: "canonical",
    };

    const before = id
      ? await prisma.scholarshipRule.findUnique({ where: { id } })
      : await prisma.scholarshipRule.findFirst({ where });
    if (id && !before) {
      return { ok: false, error: "La regla ya no existe. Recarga la página." };
    }
    const saved = before
      ? await prisma.scholarshipRule.update({
          where: { id: before.id },
          data: {
            ...where,
            scholarshipPercent,
            origin: "admin-benefits",
          },
        })
      : await prisma.scholarshipRule.create({
          data: {
            ...where,
            scholarshipPercent,
            discountedPriceMxn: null,
            origin: "admin-benefits",
          },
        });

    await writeAdminAuditLog({
      module: AdminConfigModule.BENEFITS,
      action: before ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
      actor: admin,
      entityType: "ScholarshipRule",
      entityId: saved.id,
      before: before
        ? {
            id: before.id,
            scholarshipPercent: Number(before.scholarshipPercent),
            minAverage: Number(before.minAverage),
            maxAverage: Number(before.maxAverage),
          }
        : null,
      after: {
        id: saved.id,
        enrollmentType: saved.enrollmentType,
        businessLine: saved.businessLine,
        modality: saved.modality,
        plan: saved.plan,
        campusTier: saved.campusTier,
        region: saved.region,
        plantel: saved.plantel,
        programaKey: saved.programaKey,
        minAverage: Number(saved.minAverage),
        maxAverage: Number(saved.maxAverage),
        scholarshipPercent: Number(saved.scholarshipPercent),
        sourceVersion: saved.sourceVersion,
      },
    });

    revalidatePath("/admin/benefits");
    revalidatePath("/admin/prices");
    revalidatePath("/");
    revalidatePath("/unidep");
    return { ok: true };
  } catch (error) {
    captureException(error, {
      module: "admin-benefits",
      action: "upsert-base-scholarship",
      result: "failure",
    }, "Failed to save base scholarship rule");
    return { ok: false, error: "No fue posible guardar la beca por promedio." };
  }
}

export async function deleteBaseScholarshipAction(formData: FormData) {
  const admin = await requireAdminCapabilityUser(BENEFITS_WRITE_CAPABILITY);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const before = await prisma.scholarshipRule.findUnique({ where: { id } });
  if (!before) return;

  await prisma.scholarshipRule.delete({ where: { id } });

  await writeAdminAuditLog({
    module: AdminConfigModule.BENEFITS,
    action: AdminAuditAction.DELETE,
    actor: admin,
    entityType: "ScholarshipRule",
    entityId: before.id,
    before: {
      id: before.id,
      enrollmentType: before.enrollmentType,
      businessLine: before.businessLine,
      modality: before.modality,
      plan: before.plan,
      campusTier: before.campusTier,
      region: before.region,
      plantel: before.plantel,
      programaKey: before.programaKey,
      minAverage: before.minAverage === null ? null : Number(before.minAverage),
      maxAverage: before.maxAverage === null ? null : Number(before.maxAverage),
      scholarshipPercent:
        before.scholarshipPercent === null ? null : Number(before.scholarshipPercent),
      sourceVersion: before.sourceVersion,
    },
    after: null,
  });

  revalidatePath("/admin/benefits");
  revalidatePath("/admin/prices");
  revalidatePath("/");
  revalidatePath("/unidep");
}
