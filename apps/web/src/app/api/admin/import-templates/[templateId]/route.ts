import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import { buildCsvTemplate, getAdminImportTemplate } from "@/lib/importers/admin-import-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ templateId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const { templateId } = await context.params;
  const template = getAdminImportTemplate(templateId);

  if (!template) {
    return NextResponse.json(
      { ok: false, error: "Plantilla no encontrada." },
      { status: 404 },
    );
  }

  const body = buildCsvTemplate(template);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${template.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
