import { AdminCapability } from "@prisma/client";
import type { NextResponse } from "next/server";

import { getAdminApiUser, requireAdminApiCapability, type ApiAdminUser } from "@/lib/api-auth";
import { adminApiError } from "@/lib/admin-api";
import { checkRateLimit } from "@/lib/rate-limit";

type GuardResult =
  | { ok: true; admin: ApiAdminUser }
  | { ok: false; response: NextResponse };

function rateLimitResponse(requestId: string, retryAfterMs: number) {
  return adminApiError({
    requestId,
    status: 429,
    errorCode: "AUDITOR_RATE_LIMITED",
    error: "Demasiadas solicitudes al auditor. Intenta de nuevo en unos segundos.",
    details: { retryAfterMs },
    recoverable: true,
  });
}

async function applyAuditorRateLimit(
  requestId: string,
  admin: ApiAdminUser,
  action: string,
  options?: { limit?: number; windowMs?: number },
): Promise<GuardResult> {
  const result = await checkRateLimit(`auditor:${action}:${admin.id}`, {
    limit: options?.limit ?? 8,
    windowMs: options?.windowMs ?? 60_000,
  });
  if (!result.ok) {
    return { ok: false, response: rateLimitResponse(requestId, result.retryAfterMs) };
  }
  return { ok: true, admin };
}

export async function requireAuditorReadAccess(
  requestId: string,
  action: string,
): Promise<GuardResult> {
  const auth = await requireAdminApiCapability(
    requestId,
    AdminCapability.view_admin_operations,
  );
  if (!auth.ok) return auth;
  return applyAuditorRateLimit(requestId, auth.admin, action, {
    limit: action === "diagnose" ? 4 : 12,
    windowMs: 60_000,
  });
}

export async function requireAuditorRepairAccess(
  requestId: string,
  action: string,
): Promise<GuardResult> {
  const auth = await getAdminApiUser(requestId);
  if (!auth.ok) return auth;
  return applyAuditorRateLimit(requestId, auth.admin, action, {
    limit: 3,
    windowMs: 60_000,
  });
}
