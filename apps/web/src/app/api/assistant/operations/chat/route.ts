import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import {
  runOperationsAssistantChat,
  type OperationsActionPayload,
} from "@/lib/agents/operations-assistant";
import type { AiChatMessage, AiChatRole } from "@/lib/ai/client";

import { requireOperationsAssistantAccess } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeMessages(input: unknown): AiChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      const casted = entry as { role?: unknown; content?: unknown };
      const role = String(casted.role ?? "user") as AiChatRole;
      const content = String(casted.content ?? "").trim();
      if (!["user", "assistant", "system"].includes(role) || !content) return null;
      return { role, content };
    })
    .filter((entry): entry is AiChatMessage => Boolean(entry));
}

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("operations_assistant_chat");
  const auth = await requireOperationsAssistantAccess(requestId, "chat", {
    limit: 10,
    windowMs: 60_000,
  });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | { messages?: unknown; message?: string; payload?: OperationsActionPayload }
    | null;
  const messages = normalizeMessages(body?.messages);
  const fallbackMessage = String(body?.message ?? "").trim();
  const normalizedMessages =
    messages.length > 0
      ? messages
      : fallbackMessage
        ? [{ role: "user" as const, content: fallbackMessage }]
        : [];

  if (normalizedMessages.length === 0) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "OPERATIONS_ASSISTANT_EMPTY_MESSAGE",
      error: "Agrega un mensaje para el asistente.",
      recoverable: true,
    });
  }

  try {
    const result = await runOperationsAssistantChat({
      actor: auth.admin,
      messages: normalizedMessages,
    });
    return adminApiSuccess(requestId, result);
  } catch {
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "OPERATIONS_ASSISTANT_CHAT_FAILED",
      error: "No fue posible ejecutar el asistente operativo.",
      recoverable: true,
    });
  }
}
