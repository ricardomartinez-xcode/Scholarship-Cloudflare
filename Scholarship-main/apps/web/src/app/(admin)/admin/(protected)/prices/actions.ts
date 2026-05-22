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
import { loadCanonicalFlatRulesPayload } from "@/lib/canonical-pricing-readers";
import { getSql } from "@/lib/neon";
import { captureException, logStructured } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import {
  createComparisonSummary,
  logComparisonReport,
  type ComparisonMismatch,
} from "@/lib/runtime-comparison";
import { getPricingReadMode } from "@/lib/runtime-modes";

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
  origen: string | null;
};

const PRICES_WRITE_CAPABILITY = AdminCapability.manage_prices;

function buildRuleKey(rule: Omit<BecaRule, "id">) {
  return [
    rule.programa_key,
    rule.nivel_key,
    rule.modalidad_key,
    rule.plan,
    rule.tier ?? "",
    rule.rango_min ?? "",
    rule.rango_max ?? "",
  ].join("|");
}

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

export async function getBecaRules(): Promise<BecaRule[]> {
  try {
    await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);
    const pricingReadMode = getPricingReadMode();

    const legacyQuery = async () => {
      const sql = getSql();
      const rows = await sql`
        SELECT id, programa_key, nivel_key, modalidad_key, plan, tier,
               rango_min, rango_max, porcentaje, monto, origen
        FROM recalc_regla_beca
        ORDER BY programa_key, nivel_key, modalidad_key, plan, tier
      `;
      return rows.map((row) => ({
        id: String(row.id),
        programa_key: String(row.programa_key),
        nivel_key: String(row.nivel_key),
        modalidad_key: String(row.modalidad_key),
        plan: String(row.plan),
        tier: row.tier ? String(row.tier) : null,
        rango_min: row.rango_min === null ? null : Number(row.rango_min),
        rango_max: row.rango_max === null ? null : Number(row.rango_max),
        porcentaje: row.porcentaje === null ? null : Number(row.porcentaje),
        monto: row.monto === null ? null : Number(row.monto),
        origen: row.origen ? String(row.origen) : null,
      })) as BecaRule[];
    };

    const canonicalQuery = async () => {
      const rows = await prisma.scholarshipRule.findMany({
        where: {
          sourceVersion: "legacy",
          enrollmentType: { in: ["nuevo_ingreso", "reingreso"] },
        },
        orderBy: [
          { enrollmentType: "asc" },
          { businessLine: "asc" },
          { modality: "asc" },
          { plan: "asc" },
          { campusTier: "asc" },
          { minAverage: "asc" },
        ],
      });

      const payload = await loadCanonicalFlatRulesPayload();
      const payloadMap = new Map(
        payload.map((rule) => [
          buildRuleKey({
            programa_key: rule.programa,
            nivel_key: rule.nivel,
            modalidad_key: rule.modalidad,
            plan: String(rule.plan),
            tier: rule.tier,
            rango_min: rule.rango?.min ?? null,
            rango_max: rule.rango?.max ?? null,
            porcentaje: rule.porcentaje,
            monto: rule.monto,
            origen: rule.origen,
          }),
          rule,
        ]),
      );

      return rows.map((row) => {
        const payloadRow =
          payloadMap.get(
            buildRuleKey({
              programa_key:
                row.enrollmentType === "nuevo_ingreso"
                  ? "nuevo_ingreso"
                  : "reingreso",
              nivel_key:
                row.businessLine === "prepa"
                  ? "preparatoria"
                  : row.businessLine,
              modalidad_key: row.modality,
              plan: String(row.plan),
              tier: row.campusTier === "ANY" ? null : row.campusTier,
              rango_min: row.minAverage === null ? null : Number(row.minAverage),
              rango_max: row.maxAverage === null ? null : Number(row.maxAverage),
              porcentaje:
                row.scholarshipPercent === null
                  ? null
                  : Number(row.scholarshipPercent),
              monto:
                row.discountedPriceMxn === null
                  ? null
                  : Number(row.discountedPriceMxn),
              origen: row.origin,
            }),
          ) ?? null;

        return {
          id: row.id,
          programa_key:
            row.enrollmentType === "nuevo_ingreso"
              ? "nuevo_ingreso"
              : "reingreso",
          nivel_key:
            row.businessLine === "prepa" ? "preparatoria" : row.businessLine,
          modalidad_key: row.modality,
          plan: String(row.plan),
          tier: row.campusTier === "ANY" ? null : row.campusTier,
          rango_min: row.minAverage === null ? null : Number(row.minAverage),
          rango_max: row.maxAverage === null ? null : Number(row.maxAverage),
          porcentaje:
            row.scholarshipPercent === null
              ? null
              : Number(row.scholarshipPercent),
          monto: payloadRow?.monto ?? (row.discountedPriceMxn === null ? null : Number(row.discountedPriceMxn)),
          origen: row.origin,
        } satisfies BecaRule;
      });
    };

    if (pricingReadMode === "canonical") {
      return await canonicalQuery();
    }

    const legacy = await legacyQuery();
    if (pricingReadMode === "compare") {
      const canonical = await canonicalQuery();
      const canonicalMap = new Map(
        canonical.map((rule) => [buildRuleKey({ ...rule }), rule]),
      );
      const mismatches: ComparisonMismatch[] = [];
      for (const legacyRule of legacy) {
        const key = buildRuleKey({ ...legacyRule });
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
        if ((legacyRule.monto ?? null) !== (canonicalRule.monto ?? null)) {
          mismatches.push({
            key,
            field: "monto",
            legacy: legacyRule.monto,
            canonical: canonicalRule.monto,
          });
        }
      }

      logComparisonReport({
        channel: "admin-prices",
        mode: "compare",
        summary: createComparisonSummary({
          read: legacy.length,
          conflicted: mismatches.length,
        }),
        mismatches,
      });
    }

    return legacy;
  } catch {
    return [];
  }
}

export async function upsertMontoOverrideAction(formData: FormData) {
  try {
    const admin = await requireAdminCapabilityUser(PRICES_WRITE_CAPABILITY);

    const programa_key = String(formData.get("programa_key") ?? "").trim();
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
      return { ok: false, error: "Faltan claves de la regla a editar." };
    }

    void programa_key;
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
