import { DEFAULT_DOM_SELECTORS, encryptedJson, optionsResponse } from "@/lib/premium-sender-legacy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  return encryptedJson(DEFAULT_DOM_SELECTORS);
}
