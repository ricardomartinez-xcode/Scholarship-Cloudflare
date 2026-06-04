import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import {
  previewOperationsAction,
  type OperationsActionId,
  type OperationsActionPayload,
} from "@/lib/agents/operations-assistant";

import { requireOperationsAssistantAccess } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_IDS = new Set<OperationsActionId>([
  "create_audit_note",
  "review_offer_imports",
  "document_env_setup",
]);

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("operations_assistant_action_preview");
  const auth = await requireOperationsAssistantAccess(requestId, "action-preview");
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | { actionId?: OperationsActionId; payload?: OperationsActionPayload }
    | null;
  if (!body?.actionId || !ACTION_IDS.has(body.actionId)) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "OPERATIONS_ASSISTANT_INVALID_ACTION",
      error: "Accion no soportada.",
      recoverable: true,
    });
  }

  return adminApiSuccess(requestId, {
    preview: previewOperationsAction({
      actionId: body.actionId,
      payload: body.payload,
    }),
  });
}
