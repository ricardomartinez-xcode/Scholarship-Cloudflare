import { NextRequest } from "next/server";
import { encryptedJson, optionsResponse, readLegacyRequest, asString } from "@/lib/premium-sender-legacy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  const payload = await readLegacyRequest(request);
  const text = asString(payload.text, "");
  const role = asString(payload.role, "assistant");

  // Compatibility fallback. This keeps the extension functional without
  // depending on the old sender AI endpoint.
  return encryptedJson({
    ok: true,
    role,
    message: text || "Escribe tu mensaje y personalizalo antes de enviarlo.",
  });
}
