import { AdminCapability, OrgRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type OrganizationTeam = {
  id: string;
  display_name: string;
  created_at_millis: number;
  memberCount: number;
};

const buildRequestId = () =>
  `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function normalizeName(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function validateName(value: string) {
  if (!value) return "El nombre es obligatorio.";
  if (value.length < 3) return "El nombre debe tener al menos 3 caracteres.";
  if (value.length > 80) return "El nombre debe tener máximo 80 caracteres.";
  return null;
}

function toTeam(organization: {
  id: string;
  displayName: string;
  createdAt: Date;
  _count: { members: number };
}): OrganizationTeam {
  return {
    id: organization.id,
    display_name: organization.displayName,
    created_at_millis: organization.createdAt.getTime(),
    memberCount: organization._count.members,
  };
}

function errorResponse(
  requestId: string,
  status: number,
  error: string,
  code: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { ok: false, error, code, requestId, ...(extra ?? {}) },
    { status },
  );
}

async function requireReadAccess(requestId: string) {
  const operations = await requireAdminApiCapability(
    requestId,
    AdminCapability.view_admin_operations,
  );
  if (!operations.ok) return operations;

  return requireAdminApiCapability(requestId, [
    AdminCapability.view_org_members,
    AdminCapability.manage_org_members,
  ]);
}

async function requireWriteAccess(requestId: string) {
  const operations = await requireAdminApiCapability(
    requestId,
    AdminCapability.view_admin_operations,
  );
  if (!operations.ok) return operations;

  return requireAdminApiCapability(
    requestId,
    AdminCapability.manage_org_members,
  );
}

async function findActiveDuplicate(displayName: string, exceptId?: string) {
  return prisma.organization.findFirst({
    where: {
      isActive: true,
      displayName: { equals: displayName, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
}

export async function GET() {
  const requestId = buildRequestId();

  try {
    const auth = await requireReadAccess(requestId);
    if (!auth.ok) return auth.response;

    const organizations = await prisma.organization.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    });

    return NextResponse.json({
      ok: true,
      requestId,
      teams: organizations.map(toTeam),
    });
  } catch (error) {
    console.error("[admin.organizations.get]", { requestId, error });
    return errorResponse(
      requestId,
      500,
      "No fue posible cargar organizaciones.",
      "LIST_ORGS_FAILED",
    );
  }
}

export async function POST(request: Request) {
  const requestId = buildRequestId();

  try {
    const auth = await requireWriteAccess(requestId);
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => null)) as
      | { displayName?: unknown }
      | null;
    const displayName = normalizeName(body?.displayName);
    const validationError = validateName(displayName);

    if (validationError) {
      return errorResponse(requestId, 400, validationError, "INVALID_NAME");
    }

    if (await findActiveDuplicate(displayName)) {
      return errorResponse(
        requestId,
        409,
        "Ya existe una organización activa con ese nombre.",
        "DUPLICATE_ORG_NAME",
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { displayName },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: auth.admin.id,
          role: OrgRole.owner,
        },
      });

      return tx.organization.findUniqueOrThrow({
        where: { id: organization.id },
        include: { _count: { select: { members: true } } },
      });
    });

    return NextResponse.json(
      { ok: true, requestId, team: toTeam(created) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin.organizations.post]", { requestId, error });
    return errorResponse(
      requestId,
      500,
      "No fue posible crear la organización.",
      "CREATE_ORG_FAILED",
    );
  }
}

export async function PATCH(request: Request) {
  const requestId = buildRequestId();

  try {
    const auth = await requireWriteAccess(requestId);
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => null)) as
      | { id?: unknown; displayName?: unknown }
      | null;
    const id = String(body?.id ?? "").trim();
    const displayName = normalizeName(body?.displayName);
    const validationError = validateName(displayName);

    if (!id || validationError) {
      return errorResponse(
        requestId,
        400,
        validationError ?? "El ID es obligatorio.",
        "INVALID_INPUT",
      );
    }

    const current = await prisma.organization.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
    if (!current) {
      return errorResponse(
        requestId,
        404,
        "La organización no existe o está desactivada.",
        "ORG_NOT_FOUND",
      );
    }

    if (await findActiveDuplicate(displayName, id)) {
      return errorResponse(
        requestId,
        409,
        "Ya existe otra organización activa con ese nombre.",
        "DUPLICATE_ORG_NAME",
      );
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: { displayName },
      include: { _count: { select: { members: true } } },
    });

    return NextResponse.json({
      ok: true,
      requestId,
      team: toTeam(updated),
    });
  } catch (error) {
    console.error("[admin.organizations.patch]", { requestId, error });
    return errorResponse(
      requestId,
      500,
      "No fue posible actualizar la organización.",
      "UPDATE_ORG_FAILED",
    );
  }
}

export async function DELETE(request: Request) {
  const requestId = buildRequestId();

  try {
    const auth = await requireWriteAccess(requestId);
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => null)) as
      | { id?: unknown; ids?: unknown }
      | null;
    const candidates = Array.isArray(body?.ids) ? body.ids : [body?.id];
    const ids = Array.from(
      new Set(
        candidates
          .map((value) => String(value ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (!ids.length) {
      return errorResponse(
        requestId,
        400,
        "Debes indicar al menos una organización.",
        "INVALID_INPUT",
      );
    }

    const existing = await prisma.organization.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true },
    });
    const existingIds = existing.map((organization) => organization.id);

    if (!existingIds.length) {
      return errorResponse(
        requestId,
        404,
        "Las organizaciones ya no existen o están desactivadas.",
        "ORG_NOT_FOUND",
        { missing: ids },
      );
    }

    const result = await prisma.organization.updateMany({
      where: { id: { in: existingIds }, isActive: true },
      data: { isActive: false },
    });
    const existingSet = new Set(existingIds);

    return NextResponse.json({
      ok: true,
      requestId,
      updatedCount: result.count,
      missing: ids.filter((id) => !existingSet.has(id)),
    });
  } catch (error) {
    console.error("[admin.organizations.delete]", { requestId, error });
    return errorResponse(
      requestId,
      500,
      "No fue posible desactivar la organización.",
      "DELETE_ORG_FAILED",
    );
  }
}
