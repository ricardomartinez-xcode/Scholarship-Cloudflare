/**
 * api-auth.ts — API-level capability enforcement layer.
 *
 * Answers: "Does the currently authenticated admin have capability X to handle
 * this API request?" Returns structured 401/403 responses when not.
 *
 * Layering:
 *   auth/server.ts  →  authz.ts  →  admin-session.ts  →  api-auth.ts  ← you are here
 *
 * For session validity (is the user logged in at all?), use `authz.ts`.
 * For admin panel page access, use `admin-session.ts` directly.
 */
import { AdminCapability } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  adminHasCapability,
  getAdminAccessState,
  type AdminAccessUser,
} from "@/lib/admin-session";
import { captureException } from "@/lib/observability";

export type ApiAdminUser = Pick<
  AdminAccessUser,
  "id" | "email" | "role" | "capabilities" | "isSystemOwner"
>;

function unauthorizedResponse(requestId: string) {
  return NextResponse.json(
    {
      ok: false,
      error: "Sesion expirada o sin acceso administrativo.",
      code: "UNAUTHORIZED",
      requestId,
    },
    { status: 401 },
  );
}

function forbiddenCapabilityResponse(requestId: string) {
  return NextResponse.json(
    {
      ok: false,
      error: "No tienes permiso para realizar esta accion.",
      code: "MISSING_CAPABILITY",
      requestId,
    },
    { status: 403 },
  );
}

export async function getAdminApiUser(requestId: string): Promise<
  | { ok: true; admin: ApiAdminUser }
  | { ok: false; response: NextResponse }
> {
  try {
    const state = await getAdminAccessState();
    if (state.status !== "ok" || !state.user.isSystemOwner) {
      return { ok: false, response: unauthorizedResponse(requestId) };
    }

    return {
      ok: true,
      admin: {
        id: state.user.id,
        email: state.user.email,
        role: state.user.role,
        capabilities: state.user.capabilities,
        isSystemOwner: state.user.isSystemOwner,
      },
    };
  } catch (err) {
    captureException(err, {
      module: "api-auth",
      action: "getAdminApiUser",
      result: "failure",
      requestId,
    }, "Failed to resolve admin API user");
    return { ok: false, response: unauthorizedResponse(requestId) };
  }
}

export async function getAdminAccessApiUser(requestId: string): Promise<
  | { ok: true; admin: ApiAdminUser }
  | { ok: false; response: NextResponse }
> {
  try {
    const state = await getAdminAccessState();
    if (state.status !== "ok") {
      return { ok: false, response: unauthorizedResponse(requestId) };
    }

    return {
      ok: true,
      admin: {
        id: state.user.id,
        email: state.user.email,
        role: state.user.role,
        capabilities: state.user.capabilities,
        isSystemOwner: state.user.isSystemOwner,
      },
    };
  } catch (err) {
    captureException(err, {
      module: "api-auth",
      action: "getAdminAccessApiUser",
      result: "failure",
      requestId,
    }, "Failed to resolve admin access API user");
    return { ok: false, response: unauthorizedResponse(requestId) };
  }
}

export async function requireAdminApiCapability(
  requestId: string,
  capability: AdminCapability | AdminCapability[],
): Promise<
  | { ok: true; admin: ApiAdminUser }
  | { ok: false; response: NextResponse }
> {
  const auth = await getAdminAccessApiUser(requestId);
  if (!auth.ok) return auth;
  if (!adminHasCapability(auth.admin, capability)) {
    return { ok: false, response: forbiddenCapabilityResponse(requestId) };
  }
  return auth;
}
