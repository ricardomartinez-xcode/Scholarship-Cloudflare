import { AdminUiModule, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getAdminAccessApiUser } from "@/lib/api-auth";
import {
  getAdminUiPreferenceState,
  upsertAdminUiPreferenceState,
} from "@/lib/admin-ui-preferences";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const buildRequestId = () =>
  `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function parseModule(raw: string | null | undefined) {
  const value = String(raw ?? "").trim().toUpperCase();
  return Object.values(AdminUiModule).includes(value as AdminUiModule)
    ? (value as AdminUiModule)
    : null;
}

export async function GET(request: Request) {
  const requestId = buildRequestId();
  const auth = await getAdminAccessApiUser(requestId);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const uiModule = parseModule(url.searchParams.get("module"));
  if (!uiModule) {
    return NextResponse.json(
      { ok: false, error: "Modulo invalido.", code: "INVALID_MODULE", requestId },
      { status: 400 },
    );
  }

  const state = await getAdminUiPreferenceState(auth.admin.id, uiModule);
  return NextResponse.json({ ok: true, requestId, module: uiModule, state });
}

export async function PATCH(request: Request) {
  const requestId = buildRequestId();
  const auth = await getAdminAccessApiUser(requestId);
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    module?: string;
    state?: Record<string, unknown>;
  };
  const uiModule = parseModule(body?.module);
  if (!uiModule) {
    return NextResponse.json(
      { ok: false, error: "Modulo invalido.", code: "INVALID_MODULE", requestId },
      { status: 400 },
    );
  }

  const state =
    body?.state && typeof body.state === "object" && !Array.isArray(body.state)
      ? (body.state as Record<string, Prisma.JsonValue>)
      : ({} as Record<string, Prisma.JsonValue>);

  await upsertAdminUiPreferenceState({
    userId: auth.admin.id,
    module: uiModule,
    state,
  });

  return NextResponse.json({ ok: true, requestId, module: uiModule, state });
}
