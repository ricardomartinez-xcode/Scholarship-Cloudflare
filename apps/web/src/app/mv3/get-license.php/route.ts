import { NextRequest } from "next/server";
import { buildLegacyLicense, encryptedJson, optionsResponse, readLegacyRequest } from "@/lib/premium-sender-legacy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  const payload = await readLegacyRequest(request);
  return encryptedJson(buildLegacyLicense(payload));
}
