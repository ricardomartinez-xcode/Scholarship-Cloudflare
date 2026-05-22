import { NextResponse } from "next/server";
import { UserAgendaItemStatus, UserAgendaItemType } from "@prisma/client";

import { getSessionUser } from "@/lib/authz";
import { removeAgendaItemFromGoogle } from "@/lib/google-integration";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function normalizeAgendaType(value: unknown): UserAgendaItemType | null {
  return Object.values(UserAgendaItemType).includes(value as UserAgendaItemType)
    ? (value as UserAgendaItemType)
    : null;
}

function normalizeAgendaStatus(value: unknown): UserAgendaItemStatus | null {
  return Object.values(UserAgendaItemStatus).includes(value as UserAgendaItemStatus)
    ? (value as UserAgendaItemStatus)
    : null;
}

async function requireAgendaUser() {
  const auth = await getSessionUser();
  if (auth.status === "unauthenticated") {
    return { error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  }
  if (auth.status === "forbidden") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  if (auth.status === "inactive") {
    return { error: NextResponse.json({ error: "inactive" }, { status: 403 }) };
  }
  return { userId: auth.user.id };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAgendaUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const existing = await prisma.userAgendaItem.findFirst({
    where: { id, userId: auth.userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Elemento no encontrado." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        type?: unknown;
        status?: unknown;
        title?: unknown;
        notes?: unknown;
        dueAt?: unknown;
        sortOrder?: unknown;
      }
    | null;

  const title = body?.title == null ? undefined : String(body.title).trim();
  if (title !== undefined && !title) {
    return NextResponse.json({ ok: false, error: "El título no puede ir vacío." }, { status: 400 });
  }

  const item = await prisma.userAgendaItem.update({
    where: { id },
    data: {
      ...(body?.type !== undefined
        ? { type: normalizeAgendaType(body.type) ?? undefined }
        : {}),
      ...(body?.status !== undefined
        ? { status: normalizeAgendaStatus(body.status) ?? undefined }
        : {}),
      ...(title !== undefined ? { title } : {}),
      ...(body?.notes !== undefined
        ? { notes: String(body.notes ?? "").trim() || null }
        : {}),
      ...(body?.dueAt !== undefined
        ? { dueAt: String(body.dueAt ?? "").trim() ? new Date(String(body.dueAt)) : null }
        : {}),
      ...(body?.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))
        ? { sortOrder: Number(body.sortOrder) }
        : {}),
    },
  });

  return NextResponse.json({ ok: true, item });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAgendaUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const existing = await prisma.userAgendaItem.findFirst({
    where: { id, userId: auth.userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Elemento no encontrado." }, { status: 404 });
  }

  await removeAgendaItemFromGoogle({
    userId: auth.userId,
    agendaItemId: id,
  });
  await prisma.userAgendaItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
