import { AdminCapability, AdminConfigModule, AdminAuditAction } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const buildRequestId = () =>
  `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// ── GET /api/admin/organizations ──────────────────────────────────────────────
export async function GET() {
  const requestId = buildRequestId();
  try {
    const operationsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!operationsAuth.ok) return operationsAuth.response;

    const authResult = await requireAdminApiCapability(requestId, [
      AdminCapability.view_org_members,
      AdminCapability.manage_org_members,
    ]);
    if (!authResult.ok) return authResult.response;

    const orgs = await prisma.organization.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    });

    const teams = orgs.map((o) => ({
      id: o.id,
      display_name: o.displayName,
      created_at_millis: o.createdAt.getTime(),
      memberCount: o._count.members,
    }));

    return NextResponse.json({ ok: true, requestId, teams });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin.organizations.get]", { requestId, error: msg });
    return NextResponse.json(
      { ok: false, error: "No fue posible cargar organizaciones.", code: "LIST_ORGS_FAILED", requestId },
      { status: 500 }
    );
  }
}

// ── POST /api/admin/organizations ─────────────────────────────────────────────
export async function POST(request: Request) {
  const requestId = buildRequestId();
  try {
    const operationsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!operationsAuth.ok) return operationsAuth.response;

    const authResult = await requireAdminApiCapability(
      requestId,
      AdminCapability.manage_org_members,
    );
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as { displayName?: string };
    const displayName = String(body?.displayName ?? "").trim();

    if (!displayName) {
      return NextResponse.json(
        { ok: false, error: "El nombre es obligatorio.", code: "INVALID_NAME", requestId },
        { status: 400 }
      );
    }

    const duplicate = await prisma.organization.findFirst({
      where: {
        isActive: true,
        displayName: { equals: displayName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ya existe una organización activa con ese nombre.",
          code: "DUPLICATE_ORG_NAME",
          requestId,
        },
        { status: 400 },
      );
    }

    const org = await prisma.organization.create({
      data: { displayName },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.CREATE,
      actor: authResult.admin,
      entityType: "organization",
      entityId: org.id,
      after: { displayName: org.displayName },
      message: `Se creó la organización ${org.displayName}.`,
    });

    const team = {
      id: org.id,
      display_name: org.displayName,
      created_at_millis: org.createdAt.getTime(),
      memberCount: 0,
    };

    return NextResponse.json({ ok: true, requestId, team }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin.organizations.post]", { requestId, error: msg });
    return NextResponse.json(
      { ok: false, error: "No fue posible crear la organización.", code: "CREATE_ORG_FAILED", requestId },
      { status: 500 }
    );
  }
}

// ── PATCH /api/admin/organizations ────────────────────────────────────────────
export async function PATCH(request: Request) {
  const requestId = buildRequestId();
  try {
    const operationsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!operationsAuth.ok) return operationsAuth.response;

    const authResult = await requireAdminApiCapability(
      requestId,
      AdminCapability.manage_org_members,
    );
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as { id?: string; displayName?: string };
    const id = String(body?.id ?? "").trim();
    const displayName = String(body?.displayName ?? "").trim();

    if (!id || !displayName) {
      return NextResponse.json(
        { ok: false, error: "ID y nombre son obligatorios.", code: "INVALID_INPUT", requestId },
        { status: 400 }
      );
    }

    const current = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, displayName: true, isActive: true },
    });
    if (!current || !current.isActive) {
      return NextResponse.json(
        {
          ok: false,
          error: "La organización ya no existe.",
          code: "ORG_NOT_FOUND",
          requestId,
        },
        { status: 404 },
      );
    }

    const duplicate = await prisma.organization.findFirst({
      where: {
        id: { not: id },
        isActive: true,
        displayName: { equals: displayName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ya existe otra organización activa con ese nombre.",
          code: "DUPLICATE_ORG_NAME",
          requestId,
        },
        { status: 400 },
      );
    }

    const org = await prisma.organization.update({
      where: { id },
      data: { displayName },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.UPDATE,
      actor: authResult.admin,
      entityType: "organization",
      entityId: org.id,
      before: { displayName: current.displayName },
      after: { displayName: org.displayName },
      message: `Se actualizó la organización ${org.displayName}.`,
    });

    const team = {
      id: org.id,
      display_name: org.displayName,
      created_at_millis: org.createdAt.getTime(),
    };

    return NextResponse.json({ ok: true, requestId, team });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin.organizations.patch]", { requestId, error: msg });
    return NextResponse.json(
      { ok: false, error: "No fue posible actualizar la organización.", code: "UPDATE_ORG_FAILED", requestId },
      { status: 500 }
    );
  }
}

// ── DELETE /api/admin/organizations ───────────────────────────────────────────
export async function DELETE(request: Request) {
  const requestId = buildRequestId();
  try {
    const operationsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!operationsAuth.ok) return operationsAuth.response;

    const authResult = await requireAdminApiCapability(
      requestId,
      AdminCapability.manage_org_members,
    );
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as { id?: string; ids?: string[] };
    const ids = Array.from(
      new Set(
        (Array.isArray(body?.ids) ? body.ids : [body?.id])
          .map((value) => String(value ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (!ids.length) {
      return NextResponse.json(
        { ok: false, error: "ID es obligatorio.", code: "INVALID_INPUT", requestId },
        { status: 400 }
      );
    }

    const current = await prisma.organization.findMany({
      where: {
        id: { in: ids },
        isActive: true,
      },
      select: { id: true, displayName: true, isActive: true },
    });
    if (!current.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "La organización ya no existe.",
          code: "ORG_NOT_FOUND",
          requestId,
        },
        { status: 404 },
      );
    }
    if (current.length !== ids.length) {
      const foundIds = new Set(current.map((org) => org.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        {
          ok: false,
          error: "Una o más organizaciones ya no existen.",
          code: "ORG_NOT_FOUND",
          requestId,
          missing,
        },
        { status: 404 },
      );
    }

    await prisma.organization.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false },
    });

    await Promise.all(
      current.map((org) =>
        writeAdminAuditLog({
          module: AdminConfigModule.ACCESS,
          action: AdminAuditAction.DELETE,
          actor: authResult.admin,
          entityType: "organization",
          entityId: org.id,
          before: { displayName: org.displayName },
          after: { isActive: false },
          message: `Se desactivó la organización ${org.displayName}.`,
        }),
      ),
    );

    return NextResponse.json({ ok: true, requestId, updatedCount: current.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin.organizations.delete]", { requestId, error: msg });
    return NextResponse.json(
      { ok: false, error: "No fue posible eliminar la organización.", code: "DELETE_ORG_FAILED", requestId },
      { status: 500 }
    );
  }
}
