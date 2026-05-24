"use server";

import {
  AdminCapability,
  AdminAuditAction,
  AdminConfigModule,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { captureException, logStructured } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

export type BecaRule = {
  id: string;
  programa_key: string;
  nivel_key: string;
  modalidad_key: string;
  plan: string;
  tier: string | null;
  rango_min: number | null;
  rango_max: number | null;
  porcentaje: number | null;
  monto: number | null;
  basePriceMxn: number | null;
  origen: string | null;
};

const PRICES_WRITE_CAPABILITY = AdminCapability.manage_prices;

function serializePriceOverride(record: {
  id: string;
  scope: string;
  targetKeys: Prisma.JsonValue;
  newPrice: Prisma.Decimal | number;
  isActive: boolean;
  notes: string | null;
  updatedBy: string | null;
}) {
  return {
    id: record.id,
    scope: record.scope,
    targetKeys: JSON.parse(JSON.stringify(record.targetKeys)),
    newPrice: Number(record.newPrice),
    isActive: record.isActive,
    notes: record.notes,
    updatedBy: record.updatedBy,
  };
}

function inferBasePriceMxn(params: {
  monto: number | null;
  porcentaje: number | null;
}) {
  if (
    params.monto === null ||
    params.porcentaje === null ||
    params.porcentaje >= 100
  ) {
    return params.monto;
  }
  return Math.round((params.monto / (1 - params.porcentaje / 100)) * 100) / 100;
}

export async function getBecaRules(): Promise<BecaRule[]> {
  try {
    await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);
    const rows = await prisma.scholarshipRule.findMany({
      orderBy: [
        { businessLine: "asc" },
        { modality: "asc" },
        { plan: "asc" },
        { campusTier: "asc" },
        { enrollmentType: "asc" },
        { minAverage: "asc" },
      ],
    });

    return rows.map((row) => {
      const monto =
        row.discountedPriceMxn === null
          ? null
          : Number(row.discountedPriceMxn);
      const porcentaje =
        row.scholarshipPercent === null
          ? null
          : Number(row.scholarshipPercent);
      return {
        id: row.id,
        programa_key: "canonical",
        nivel_key:
          row.businessLine === "prepa" ? "preparatoria" : row.businessLine,
        modalidad_key: row.modality,
        plan: String(row.plan),
        tier: row.campusTier === "ANY" ? null : row.campusTier,
        rango_min: row.minAverage === null ? null : Number(row.minAverage),
        rango_max: row.maxAverage === null ? null : Number(row.maxAverage),
        porcentaje,
        monto,
        basePriceMxn: inferBasePriceMxn({ monto, porcentaje }),
        origen: row.origin,
      } satisfies BecaRule;
    });
  } catch {
    return [];
  }
}

export async function upsertMontoOverrideAction(formData: FormData) {
  try {
    const admin = await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);

    const nivel_key = String(formData.get("nivel_key") ?? "").trim();
    const modalidad_key = String(formData.get("modalidad_key") ?? "").trim();
    const plan = String(formData.get("plan") ?? "").trim();
    const tier = String(formData.get("tier") ?? "").trim();
    const newPrice = String(formData.get("newPrice") ?? "").trim();
    const existingId = String(formData.get("existingId") ?? "").trim();

    if (!newPrice || Number.isNaN(Number(newPrice))) {
      return { ok: false, error: "El precio debe ser numérico." };
    }
    if (Number(newPrice) < 0) {
      return { ok: false, error: "El precio no puede ser negativo." };
    }
    if (!nivel_key || !modalidad_key || !plan) {
      return { ok: false, error: "Faltan claves de precio a editar." };
    }

    const targetKeys: Prisma.InputJsonValue = { nivel_key, modalidad_key, plan, tier };
    const before = existingId
      ? await prisma.adminPriceOverride.findUnique({
          where: { id: existingId },
          select: {
            id: true,
            scope: true,
            targetKeys: true,
            newPrice: true,
            isActive: true,
            notes: true,
            updatedBy: true,
          },
        })
      : null;
    let saved:
      | {
          id: string;
          scope: string;
          targetKeys: Prisma.JsonValue;
          newPrice: Prisma.Decimal;
          isActive: boolean;
          notes: string | null;
          updatedBy: string | null;
        }
      | null = null;

    if (existingId) {
      saved = await prisma.adminPriceOverride.update({
        where: { id: existingId },
        data: { newPrice, isActive: true, updatedBy: admin.email },
        select: {
          id: true,
          scope: true,
          targetKeys: true,
          newPrice: true,
          isActive: true,
          notes: true,
          updatedBy: true,
        },
      });
    } else {
      saved = await prisma.adminPriceOverride.create({
          data: {
          scope: "base_price",
          targetKeys,
          newPrice,
          isActive: true,
          updatedBy: admin.email,
        },
        select: {
          id: true,
          scope: true,
          targetKeys: true,
          newPrice: true,
          isActive: true,
          notes: true,
          updatedBy: true,
        },
      });
    }

    if (saved) {
      await writeAdminAuditLog({
        module: AdminConfigModule.PRICES,
        action: before ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
        actor: admin,
        entityType: "AdminPriceOverride",
        entityId: saved.id,
        before: before ? serializePriceOverride(before) : null,
        after: serializePriceOverride(saved),
      });
      logStructured("info", "Price override saved", {
        module: "admin-prices",
        action: before ? "update" : "create",
        result: "success",
        actorUserId: admin.id,
        actorEmail: admin.email,
        subjectType: "AdminPriceOverride",
        subjectId: saved.id,
      });
    }

    revalidatePath("/admin/prices");
    revalidatePath("/unidep");
    return { ok: true };
  } catch (error) {
    captureException(error, {
      module: "admin-prices",
      action: "upsertMontoOverride",
      result: "failure",
    }, "Failed to save price override");
    return { ok: false, error: "No fue posible guardar el ajuste." };
  }
}

function parseJson(raw: FormDataEntryValue | null): Prisma.InputJsonValue | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as Prisma.InputJsonValue;
  } catch {
    return null;
  }
}

export async function upsertPriceOverrideAction(formData: FormData) {
  try {
    const admin = await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);

    const id = String(formData.get("id") ?? "").trim();
    const scope = String(formData.get("scope") ?? "").trim();
    const targetKeys = parseJson(formData.get("targetKeys"));
    const newPrice = String(formData.get("newPrice") ?? "").trim();
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!scope) return { ok: false, error: "Scope es requerido." };
    if (targetKeys === null) {
      return { ok: false, error: "targetKeys debe ser JSON válido." };
    }
    if (!newPrice || Number.isNaN(Number(newPrice))) {
      return { ok: false, error: "newPrice debe ser numérico." };
    }
    if (Number(newPrice) < 0) {
      return { ok: false, error: "newPrice no puede ser negativo." };
    }

    const before = id
      ? await prisma.adminPriceOverride.findUnique({
          where: { id },
          select: {
            id: true,
            scope: true,
            targetKeys: true,
            newPrice: true,
            isActive: true,
            notes: true,
            updatedBy: true,
          },
        })
      : null;
    let saved:
      | {
          id: string;
          scope: string;
          targetKeys: Prisma.JsonValue;
          newPrice: Prisma.Decimal;
          isActive: boolean;
          notes: string | null;
          updatedBy: string | null;
        }
      | null = null;

    if (id) {
      saved = await prisma.adminPriceOverride.update({
        where: { id },
        data: { scope, targetKeys, newPrice, isActive, notes, updatedBy: admin.email },
        select: {
          id: true,
          scope: true,
          targetKeys: true,
          newPrice: true,
          isActive: true,
          notes: true,
          updatedBy: true,
        },
      });
    } else {
      saved = await prisma.adminPriceOverride.create({
        data: { scope, targetKeys, newPrice, isActive, notes, updatedBy: admin.email },
        select: {
          id: true,
          scope: true,
          targetKeys: true,
          newPrice: true,
          isActive: true,
          notes: true,
          updatedBy: true,
        },
      });
    }

    if (saved) {
      await writeAdminAuditLog({
        module: AdminConfigModule.PRICES,
        action: before ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
        actor: admin,
        entityType: "AdminPriceOverride",
        entityId: saved.id,
        before: before ? serializePriceOverride(before) : null,
        after: serializePriceOverride(saved),
      });
      logStructured("info", "Generic price override saved", {
        module: "admin-prices",
        action: before ? "update-generic" : "create-generic",
        result: "success",
        actorUserId: admin.id,
        actorEmail: admin.email,
        subjectType: "AdminPriceOverride",
        subjectId: saved.id,
      });
    }

    revalidatePath("/admin/prices");
    revalidatePath("/");
    revalidatePath("/unidep");
    return { ok: true };
  } catch (error) {
    captureException(error, {
      module: "admin-prices",
      action: "upsertPriceOverride",
      result: "failure",
    }, "Failed to save generic price override");
    return { ok: false, error: "No fue posible guardar el ajuste." };
  }
}

export async function deletePriceOverrideAction(formData: FormData) {
  const admin = await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const before = await prisma.adminPriceOverride.findUnique({
    where: { id },
    select: {
      id: true,
      scope: true,
      targetKeys: true,
      newPrice: true,
      isActive: true,
      notes: true,
      updatedBy: true,
    },
  });
  await prisma.adminPriceOverride.delete({ where: { id } });

  if (before) {
    await writeAdminAuditLog({
      module: AdminConfigModule.PRICES,
      action: AdminAuditAction.DELETE,
      actor: admin,
      entityType: "AdminPriceOverride",
      entityId: before.id,
      before: serializePriceOverride(before),
      after: null,
    });
    logStructured("info", "Price override deleted", {
      module: "admin-prices",
      action: "delete",
      result: "success",
      actorUserId: admin.id,
      actorEmail: admin.email,
      subjectType: "AdminPriceOverride",
      subjectId: before.id,
    });
  }

  revalidatePath("/admin/prices");
  revalidatePath("/");
  revalidatePath("/unidep");
}
