import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { parseAdminPagination } from "@/lib/admin-control-api";
import { getD1 } from "@/lib/cloudflare/d1";
import {
  isCloudflareAuthRole,
  listD1AuthUsers,
  type CloudflareAuthStatus,
} from "@/lib/d1/users";

export const dynamic = "force-dynamic";

function parseStatus(value: string | null): CloudflareAuthStatus | null {
  const status = value?.trim().toLowerCase();
  if (status === "active" || status === "activo") return "active";
  if (status === "inactive" || status === "inactivo") return "inactive";
  return null;
}

export async function GET(request: Request) {
  const requestId = buildAdminRequestId("admin_users");

  try {
    const auth = await requireAdminApiCapability(requestId, [
      AdminCapability.view_users,
      AdminCapability.manage_users,
    ]);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const pagination = parseAdminPagination(url.searchParams, {
      defaultPageSize: 50,
      maxPageSize: 200,
    });
    const rawRole = url.searchParams.get("role")?.trim() || null;
    const role = rawRole && isCloudflareAuthRole(rawRole) ? rawRole : null;

    // Keep invalid role filters deterministic without sending arbitrary values
    // into a database predicate.
    if (rawRole && !role) {
      return adminApiSuccess(requestId, {
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: 0,
        },
        users: [],
      });
    }

    const result = await listD1AuthUsers(getD1(), {
      page: pagination.page,
      pageSize: pagination.pageSize,
      query: url.searchParams.get("q"),
      role,
      status: parseStatus(url.searchParams.get("status")),
    });

    return adminApiSuccess(requestId, {
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: result.total,
      },
      users: result.users.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.isActive ? "active" : "inactive",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      })),
    });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-users",
      action: "list",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "USERS_LIST_FAILED",
      error: "No fue posible listar usuarios.",
      details: {
        reason: error instanceof Error ? error.message : String(error),
      },
      recoverable: true,
    });
  }
}
