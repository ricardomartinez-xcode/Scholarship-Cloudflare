import { NextResponse } from "next/server";
import { UserAgendaItemStatus, UserAgendaItemType } from "@prisma/client";

import { getSessionUser } from "@/lib/authz";
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

export async function GET() {
  const auth = await requireAgendaUser();
  if ("error" in auth) return auth.error;

  const items = await prisma.userAgendaItem.findMany({
    where: { userId: auth.userId },
    orderBy: [
      { status: "asc" },
      { sortOrder: "asc" },
      { dueAt: "asc" },
      { updatedAt: "desc" },
    ],
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const auth = await requireAgendaUser();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as
    | {
        type?: unknown;
        title?: unknown;
        notes?: unknown;
        dueAt?: unknown;
        sortOrder?: unknown;
        status?: unknown;
      }
    | null;

  const type = normalizeAgendaType(body?.type) ?? UserAgendaItemType.pendiente;
  const status = normalizeAgendaStatus(body?.status) ?? UserAgendaItemStatus.abierto;
  const title = String(body?.title ?? "").trim();
  const notes = String(body?.notes ?? "").trim();
  const dueAtRaw = String(body?.dueAt ?? "").trim();
  const sortOrder = Number.isFinite(Number(body?.sortOrder))
    ? Number(body?.sortOrder)
    : 0;

  if (!title) {
    return NextResponse.json(
      { ok: false, error: "El título es obligatorio." },
      { status: 400 },
    );
  }

  const item = await prisma.userAgendaItem.create({
    data: {
      userId: auth.userId,
      type,
      status,
      title,
      notes: notes || null,
      dueAt: dueAtRaw ? new Date(dueAtRaw) : null,
      sortOrder,
    },
  });

  return NextResponse.json({ ok: true, item }, { status: 201 });
}
