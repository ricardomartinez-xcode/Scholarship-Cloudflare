import { AdminCapability } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { getD1 } from "@/lib/cloudflare/d1";
import {
  archiveOrganizations,
  createOrganization,
  findActiveOrganization,
  findActiveOrganizationByName,
  listActiveOrganizations,
  nextOrganizationSlug,
  renameOrganization,
  type D1OrganizationSummary,
} from "@/lib/d1/organizations";

export const dynamic = "force-dynamic";

const buildRequestId = () =>
  `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function toMillis(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTeam(organization: D1OrganizationSummary) {
  return {
    id: organization.id,
    display_name: organization.name,
    created_at_millis: toMillis(organization.createdAt),
    memberCount: organization.memberCount,
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

async function requireOrganizationReadAccess(requestId: string) {
  const operationsAuth = await requireAdminApiCapability(
    requestId,
    AdminCapability.view_admin_operations,
  );
  if (!operationsAuth.ok) return operationsAuth;

  return requireAdminApiCapability(requestId, [
    AdminCapability.view_org_members,
    AdminCapability.manage_org_members,
  ]);
}

async function requireOrganizationWriteAccess(requestId: string) {
  const operationsAuth = await requireAdminApiCapability(
    requestId,
    AdminCapability.view_admin_operations,
  );
  if (!operationsAuth.ok) return operationsAuth;

  return requireAdminApiCapability(
    requestId,
    AdminCapability.manage_org_members,
  );
}

// GET /api/admin/organizations
export async function GET() {
  const requestId = buildRequestId();

  try {
    const authResult = await requireOrganizationReadAccess(requestId);
    if (!authResult.ok) return authResult.response;

    const organizations = await listActiveOrganizations(getD1());
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

// POST /api/admin/organizations
export async function POST(request: Request) {
  const requestId = buildRequestId();

  try {
    const authResult = await requireOrganizationWriteAccess(requestId);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json().catch(() => null)) as
      | { displayName?: unknown }
      | null;
    const displayName = String(body?.displayName ?? "").trim();

    if (!displayName) {
      return errorResponse(
        requestId,
        400,
        "El nombre es obligatorio.",
        "INVALID_NAME",
      );
    }

    const db = getD1();
    const duplicate = await findActiveOrganizationByName(db, displayName);
    if (duplicate) {
      return errorResponse(
        requestId,
        400,
        "Ya existe una organización activa con ese nombre.",
        "DUPLICATE_ORG_NAME",
      );
    }

    const slug = await nextOrganizationSlug(db, displayName);
    const created = await createOrganization(db, {
      slug,
      name: displayName,
      ownerUserId: authResult.admin.id,
      actorUserId: authResult.admin.id,
      requestId,
    });
    const organization = await findActiveOrganization(db, created.organizationId);

    if (!organization) {
      throw new Error("La organización creada no pudo recuperarse desde D1.");
    }

    return NextResponse.json(
      { ok: true, requestId, team: toTeam(organization) },
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

// PATCH /api/admin/organizations
export async function PATCH(request: Request) {
  const requestId = buildRequestId();

  try {
    const authResult = await requireOrganizationWriteAccess(requestId);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json().catch(() => null)) as
      | { id?: unknown; displayName?: unknown }
      | null;
    const id = String(body?.id ?? "").trim();
    const displayName = String(body?.displayName ?? "").trim();

    if (!id || !displayName) {
      return errorResponse(
        requestId,
        400,
        "ID y nombre son obligatorios.",
        "INVALID_INPUT",
      );
    }

    const db = getD1();
    const current = await findActiveOrganization(db, id);
    if (!current) {
      return errorResponse(
        requestId,
        404,
        "La organización ya no existe.",
        "ORG_NOT_FOUND",
      );
    }

    const duplicate = await findActiveOrganizationByName(db, displayName, {
      exceptId: id,
    });
    if (duplicate) {
      return errorResponse(
        requestId,
        400,
        "Ya existe otra organización activa con ese nombre.",
        "DUPLICATE_ORG_NAME",
      );
    }

    const renamed = await renameOrganization(db, {
      id,
      name: displayName,
      actorUserId: authResult.admin.id,
      requestId,
    });
    if (!renamed) {
      return errorResponse(
        requestId,
        404,
        "La organización ya no existe.",
        "ORG_NOT_FOUND",
      );
    }

    return NextResponse.json({
      ok: true,
      requestId,
      team: toTeam(renamed),
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

// DELETE /api/admin/organizations
export async function DELETE(request: Request) {
  const requestId = buildRequestId();

  try {
    const authResult = await requireOrganizationWriteAccess(requestId);
    if (!authResult.ok) return authResult.response;

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
        "ID es obligatorio.",
        "INVALID_INPUT",
      );
    }

    const archived = await archiveOrganizations(getD1(), {
      ids,
      actorUserId: authResult.admin.id,
      requestId,
    });
    const foundIds = new Set(archived.map((organization) => organization.id));
    const missing = ids.filter((id) => !foundIds.has(id));

    if (!archived.length) {
      return errorResponse(
        requestId,
        404,
        "La organización ya no existe.",
        "ORG_NOT_FOUND",
      );
    }
    if (missing.length) {
      return errorResponse(
        requestId,
        404,
        "Una o más organizaciones ya no existen.",
        "ORG_NOT_FOUND",
        { missing },
      );
    }

    return NextResponse.json({
      ok: true,
      requestId,
      updatedCount: archived.length,
    });
  } catch (error) {
    console.error("[admin.organizations.delete]", { requestId, error });
    return errorResponse(
      requestId,
      500,
      "No fue posible eliminar la organización.",
      "DELETE_ORG_FAILED",
    );
  }
}
