import { legacyJson, optionsResponse } from "@/lib/premium-sender-legacy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST() {
  return legacyJson({ ok: true, status: "success", message: "Logged out" });
}
