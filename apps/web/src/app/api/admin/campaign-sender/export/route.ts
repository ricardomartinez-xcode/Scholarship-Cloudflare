import { AdminCapability } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import {
  campaignSenderRowsToCsv,
  listCampaignSenderRecipientExports,
} from "@/lib/public-campaign-sender-export";

export const dynamic = "force-dynamic";

function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  await requireAdminCapabilityUser(AdminCapability.view_reports);

  const params = new URL(request.url).searchParams;
  try {
    const rows = await listCampaignSenderRecipientExports({
      campaignId: params.get("campaignId"),
      status: params.get("status"),
    });
    const csv = campaignSenderRowsToCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="recalc-campaigns-${fileStamp()}.csv"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "No fue posible exportar el historial. Confirma que la migración Campaign Sender está aplicada en D1.",
        code: "campaign_export_unavailable",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
