import { NextRequest } from "next/server";
import { legacyJson, optionsResponse, readLegacyRequest } from "@/lib/premium-sender-legacy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  const payload = await readLegacyRequest(request);

  return legacyJson({
    ok: true,
    status: "success",
    data: {
      notifications: [],
      announcements: [],
      news: [],
      offline: "Allow",
      compatibility: "recalc",
      mobile: payload.mobile ?? "",
    },
  });
}
