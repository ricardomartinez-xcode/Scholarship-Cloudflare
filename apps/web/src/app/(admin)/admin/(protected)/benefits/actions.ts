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
  AdminAdditionalBenefitType.fixed_scholarship,
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
      benefitType === AdminAdditionalBenefitType.percentage ||
      benefitType === AdminAdditionalBenefitType.fixed_scholarship
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
              benefitType === AdminAdditionalBenefitType.percentage ||
              benefitType === AdminAdditionalBenefitType.fixed_scholarship
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
              benefitType === AdminAdditionalBenefitType.percentage ||
              benefitType === AdminAdditionalBenefitType.fixed_scholarship
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
