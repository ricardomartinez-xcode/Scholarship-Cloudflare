import { AdminCapability } from "@prisma/client";
import type { NextResponse } from "next/server";

import { adminApiError } from "@/lib/admin-api";
import { requireAdminApiCapability, type ApiAdminUser } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

type GuardResult =
  | { ok: true; admin: ApiAdminUser }
  | { ok: false; response: NextResponse };

export async function requireOperationsAssistantAccess(
  requestId: string,
  action: string,
  options?: { limit?: number; windowMs?: number },
): Promise<GuardResult> {
  const auth = await requireAdminApiCapability(
    requestId,
    AdminCapability.view_admin_operations,
  );
  if (!auth.ok) return auth;

  const limiter = await checkRateLimit(`operations-assistant:${action}:${auth.admin.id}`, {
    limit: options?.limit ?? 12,
    windowMs: options?.windowMs ?? 60_000,
  });
  if (!limiter.ok) {
    return {
      ok: false,
      response: adminApiError({
        requestId,
        status: 429,
        errorCode: "OPERATIONS_ASSISTANT_RATE_LIMITED",
        error: "Demasiadas solicitudes al asistente operativo.",
        details: { retryAfterMs: limiter.retryAfterMs },
        recoverable: true,
      }),
    };
  }

  return { ok: true, admin: auth.admin };
}
