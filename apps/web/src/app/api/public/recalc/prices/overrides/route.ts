import { revalidatePath } from "next/cache";
import { AdminAuditAction, AdminCapability, AdminConfigModule, Prisma } from "@prisma/client";

import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import {
  canAccessAdminPanel,
  hasAnyAdminCapability,
  resolveAdminCapabilities,
} from "@/lib/admin-capabilities";
import { getSessionUser, getSessionUserFromExtensionToken } from "@/lib/authz";
import { d1All, d1First, d1Run } from "@/lib/cloudflare/d1";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import { prisma } from "@/lib/prisma";
import {
  readRecalcPublicApiBearerToken,
  requireRecalcPublicApiCapability,
} from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PriceOverridePayload = {
  id?: unknown;
  scope?: unknown;
  targetKeys?: unknown;
  newPrice?: unknown;
  isActive?: unknown;
  notes?: unknown;
};

function serializePriceOverride(record: {
  id: string;
  scope: string;
  targetKeys: Prisma.JsonValue;
  newPrice: Prisma.Decimal | number;
  isActive: boolean;
  notes: string | null;
  updatedBy: string | null;
}): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify({
    id: record.id,
    scope: record.scope,
    targetKeys: record.targetKeys,
    newPrice: Number(record.newPrice),
    isActive: record.isActive,
    notes: record.notes,
    updatedBy: record.updatedBy,
  })) as Prisma.InputJsonValue;
}

function normalizeTargetKeys(value: unknown): Prisma.InputJsonValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function ensureD1PriceOverrideSchema() {
  await d1Run(
    `CREATE TABLE IF NOT EXISTS admin_price_override (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL DEFAULT 'base_price',
      target_keys TEXT NOT NULL DEFAULT '{}',
      new_price REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  );
  await d1Run(
    "CREATE INDEX IF NOT EXISTS admin_price_override_scope_active_idx ON admin_price_override(scope, is_active)",
  );
}

function serializeD1PriceOverride(record: {
  id: string;
  scope: string;
  targetKeys: Prisma.InputJsonValue;
  newPrice: number;
  isActive: boolean;
  notes: string | null;
  updatedBy: string | null;
}) {
  return JSON.parse(JSON.stringify(record)) as Prisma.InputJsonValue;
}

async function requireD1PriceOverrideCapability(request: Request, requestId: string) {
  const bearer = readRecalcPublicApiBearerToken(request);
  const session = bearer
    ? await getSessionUserFromExtensionToken(bearer)
    : await getSessionUser();

  if (session.status !== "ok") {
    return {
      ok: false as const,
      response: adminApiError({
        requestId,
        status: session.status === "unauthenticated" ? 401 : 403,
        errorCode: "PUBLIC_API_TOKEN_INVALID",
        error: "No fue posible validar la sesion para administrar precios.",
        recoverable: true,
      }),
    };
  }

  const capabilities = resolveAdminCapabilities(session.user.role, []);
  if (
    !canAccessAdminPanel(session.user.role, capabilities) ||
    !hasAnyAdminCapability(capabilities, [AdminCapability.manage_prices])
  ) {
    return {
      ok: false as const,
      response: adminApiError({
        requestId,
        status: 403,
        errorCode: "PUBLIC_API_CAPABILITY_REQUIRED",
        error: "La cuenta no tiene permisos para administrar precios.",
        recoverable: false,
      }),
    };
  }

  return {
    ok: true as const,
    actor: {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    },
  };
}

function parseD1Payload(requestId: string, payload: PriceOverridePayload | null) {
  if (!payload) {
    return {
      ok: false as const,
      response: adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_JSON",
        error: "El cuerpo JSON no es valido.",
        recoverable: true,
      }),
    };
  }

  const id = String(payload.id ?? "").trim() || crypto.randomUUID();
  const scope = String(payload.scope ?? "base_price").trim();
  const targetKeys = normalizeTargetKeys(payload.targetKeys);
  const newPrice = Number(payload.newPrice);
  const isActive = payload.isActive === undefined ? true : payload.isActive === true;
  const notes = String(payload.notes ?? "").trim() || null;

  if (!scope) {
    return {
      ok: false as const,
      response: adminApiError({
        requestId,
        status: 400,
        errorCode: "PRICE_SCOPE_REQUIRED",
        error: "scope es requerido.",
        recoverable: true,
      }),
    };
  }
  if (!targetKeys) {
    return {
      ok: false as const,
      response: adminApiError({
        requestId,
        status: 400,
        errorCode: "TARGET_KEYS_REQUIRED",
        error: "targetKeys debe ser un objeto JSON.",
        recoverable: true,
      }),
    };
  }
  if (!Number.isFinite(newPrice) || newPrice < 0) {
    return {
      ok: false as const,
      response: adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_NEW_PRICE",
        error: "newPrice debe ser numerico y no negativo.",
        recoverable: true,
      }),
    };
  }

  return {
    ok: true as const,
    values: { id, scope, targetKeys, newPrice, isActive, notes },
  };
}

export async function GET(request: Request) {
  const requestId = buildAdminRequestId("public_recalc_price_override_list");

  if (!isCloudflareRuntime()) {
    return adminApiError({
      requestId,
      status: 405,
      errorCode: "METHOD_NOT_ALLOWED",
      error: "Metodo no permitido.",
      recoverable: false,
    });
  }

  const auth = await requireD1PriceOverrideCapability(request, requestId);
  if (!auth.ok) return auth.response;
  await ensureD1PriceOverrideSchema();

  const rows = await d1All<{
    id: string;
    scope: string;
    target_keys: string;
    new_price: number;
    is_active: number;
    notes: string | null;
    updated_by: string | null;
  }>(
    `SELECT id, scope, target_keys, new_price, is_active, notes, updated_by
     FROM admin_price_override
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 500`,
  );

  return adminApiSuccess(requestId, {
    priceOverrides: rows.map((row) =>
      serializeD1PriceOverride({
        id: row.id,
        scope: row.scope,
        targetKeys: JSON.parse(row.target_keys || "{}") as Prisma.InputJsonValue,
        newPrice: Number(row.new_price),
        isActive: Boolean(row.is_active),
        notes: row.notes,
        updatedBy: row.updated_by,
      }),
    ),
  });
}

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("public_recalc_price_override");

  if (isCloudflareRuntime()) {
    const auth = await requireD1PriceOverrideCapability(request, requestId);
    if (!auth.ok) return auth.response;
    await ensureD1PriceOverrideSchema();

    const payload = (await request.json().catch(() => null)) as PriceOverridePayload | null;
    const parsed = parseD1Payload(requestId, payload);
    if (!parsed.ok) return parsed.response;

    const timestamp = new Date().toISOString();
    const existing = await d1First<{ id: string }>(
      "SELECT id FROM admin_price_override WHERE id = ? LIMIT 1",
      [parsed.values.id],
    );

    if (existing) {
      await d1Run(
        `UPDATE admin_price_override
         SET scope = ?, target_keys = ?, new_price = ?, is_active = ?, notes = ?, updated_by = ?, updated_at = ?
         WHERE id = ?`,
        [
          parsed.values.scope,
          JSON.stringify(parsed.values.targetKeys),
          parsed.values.newPrice,
          parsed.values.isActive ? 1 : 0,
          parsed.values.notes,
          auth.actor.email,
          timestamp,
          parsed.values.id,
        ],
      );
    } else {
      await d1Run(
        `INSERT INTO admin_price_override
          (id, scope, target_keys, new_price, is_active, notes, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          parsed.values.id,
          parsed.values.scope,
          JSON.stringify(parsed.values.targetKeys),
          parsed.values.newPrice,
          parsed.values.isActive ? 1 : 0,
          parsed.values.notes,
          auth.actor.email,
          timestamp,
          timestamp,
        ],
      );
    }

    return adminApiSuccess(requestId, {
      priceOverride: serializeD1PriceOverride({
        ...parsed.values,
        updatedBy: auth.actor.email,
      }),
    });
  }

  const auth = await requireRecalcPublicApiCapability(
    request,
    requestId,
    AdminCapability.manage_prices,
  );
  if (!auth.ok) return auth.response;

  const payload = (await request.json().catch(() => null)) as PriceOverridePayload | null;
  if (!payload) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_JSON",
      error: "El cuerpo JSON no es valido.",
      recoverable: true,
    });
  }

  const id = String(payload.id ?? "").trim();
  const scope = String(payload.scope ?? "base_price").trim();
  const targetKeys = normalizeTargetKeys(payload.targetKeys);
  const newPrice = Number(payload.newPrice);
  const isActive = payload.isActive === undefined ? true : payload.isActive === true;
  const notes = String(payload.notes ?? "").trim() || null;

  if (!scope) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "PRICE_SCOPE_REQUIRED",
      error: "scope es requerido.",
      recoverable: true,
    });
  }
  if (!targetKeys) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "TARGET_KEYS_REQUIRED",
      error: "targetKeys debe ser un objeto JSON.",
      recoverable: true,
    });
  }
  if (!Number.isFinite(newPrice) || newPrice < 0) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_NEW_PRICE",
      error: "newPrice debe ser numerico y no negativo.",
      recoverable: true,
    });
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

  if (id && !before) {
    return adminApiError({
      requestId,
      status: 404,
      errorCode: "PRICE_OVERRIDE_NOT_FOUND",
      error: "El override de precio no existe.",
      recoverable: true,
    });
  }

  const saved = before
    ? await prisma.adminPriceOverride.update({
        where: { id: before.id },
        data: { scope, targetKeys, newPrice, isActive, notes, updatedBy: auth.actor.email },
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
    : await prisma.adminPriceOverride.create({
        data: { scope, targetKeys, newPrice, isActive, notes, updatedBy: auth.actor.email },
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

  await writeAdminAuditLog({
    module: AdminConfigModule.PRICES,
    action: before ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
    actor: auth.actor,
    entityType: "AdminPriceOverride",
    entityId: saved.id,
    requestId,
    before: before ? serializePriceOverride(before) : null,
    after: serializePriceOverride(saved),
    message: "Override de precio actualizado desde API publica Recalc.",
  });

  revalidatePath("/admin/prices");
  revalidatePath("/");
  revalidatePath("/unidep");

  return adminApiSuccess(requestId, { priceOverride: serializePriceOverride(saved) });
}
