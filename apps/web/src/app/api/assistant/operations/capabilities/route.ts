import { adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";

import { requireOperationsAssistantAccess } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = buildAdminRequestId("operations_assistant_capabilities");
  const auth = await requireOperationsAssistantAccess(requestId, "capabilities", {
    limit: 30,
    windowMs: 60_000,
  });
  if (!auth.ok) return auth.response;

  return adminApiSuccess(requestId, {
    capabilities: {
      chat: true,
      context: true,
      recommendations: true,
      actions: ["create_audit_note", "review_offer_imports", "document_env_setup"],
      confirmationText: "CONFIRMAR",
    },
  });
}
