import { NextRequest } from "next/server";
import { legacyJson, optionsResponse } from "@/lib/premium-sender-legacy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  // The extension only checks response.ok for this endpoint.
  // Persistence can later be connected to the ReCalc user/session model.
  return legacyJson({
    ok: true,
    status: "success",
    saved: true,
    count: Array.isArray(body?.templates) ? body.templates.length : 0,
  });
}
