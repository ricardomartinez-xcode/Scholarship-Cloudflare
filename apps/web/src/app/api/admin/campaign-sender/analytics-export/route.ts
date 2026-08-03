import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { listExtensionAnalyticsRecipientExport } from "@/lib/extension-analytics";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function filePart(value: string | null) {
  return String(value || "todos")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "todos";
}

export async function GET(request: Request) {
  await requireAdminCapabilityUser(AdminCapability.view_reports);

  const params = new URL(request.url).searchParams;
  const nameId = params.get("nameId");
  const campaignId = params.get("campaignId");
  const status = params.get("status");
  const rows = await listExtensionAnalyticsRecipientExport({ nameId, campaignId, status });
  const header = [
    "Name_ID",
    "Campaña",
    "Teléfono",
    "Nombre",
    "Estado",
    "Intentado",
    "Enviado",
    "Fallido",
    "Error",
    "Mensaje resuelto",
    "Actualizado",
  ];
  const body = rows.map((row) => [
    row.nameId,
    row.campaign.campaignName,
    row.contactValue,
    row.contactName,
    row.status,
    row.attemptedAt?.toISOString() ?? "",
    row.sentAt?.toISOString() ?? "",
    row.failedAt?.toISOString() ?? "",
    row.lastError,
    row.resolvedMessage,
    row.updatedAt.toISOString(),
  ]);
  const csv = `\uFEFF${[header, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = status ? `-${filePart(status)}` : "";

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="recalc-extension-${filePart(nameId)}${suffix}-${stamp}.csv"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
