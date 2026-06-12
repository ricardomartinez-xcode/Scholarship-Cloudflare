import { AdminCapability } from "@prisma/client";
import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import { deleteDuplicateAcademicPrograms } from "@/lib/program-dedupe";

export const dynamic = "force-dynamic";

const CONFIRMATION = "DELETE_DUPLICATE_PROGRAMS";

export async function POST(request: Request) {
  const admin = await getAdminUser(AdminCapability.manage_offers);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const dryRun = body?.dryRun !== false;

  if (!dryRun && body?.confirm !== CONFIRMATION) {
    return NextResponse.json(
      {
        ok: false,
        error: `Confirmación requerida: ${CONFIRMATION}.`,
      },
      { status: 400 },
    );
  }

  const result = await deleteDuplicateAcademicPrograms({
    dryRun,
    includeOrphanExtras: body?.includeOrphanExtras !== false,
  });

  return NextResponse.json({ ok: true, actor: admin.email, result });
}
