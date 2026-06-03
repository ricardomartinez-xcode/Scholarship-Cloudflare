import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { parseAdminPagination } from "@/lib/admin-control-api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const query = url.searchParams.get("q")?.trim();
    const role = url.searchParams.get("role")?.trim();
    const status = url.searchParams.get("status")?.trim().toLowerCase();

    const where = {
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" as const } },
              { displayName: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(role ? { role: role as never } : {}),
      ...(status === "active" || status === "activo" ? { isActive: true } : {}),
      ...(status === "inactive" || status === "inactivo" ? { isActive: false } : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      }),
    ]);

    return adminApiSuccess(requestId, {
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
      },
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.isActive ? "active" : "inactive",
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
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
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
