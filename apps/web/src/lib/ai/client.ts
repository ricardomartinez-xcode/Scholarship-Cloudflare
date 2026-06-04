import "server-only";

export type AiChatRole = "system" | "user" | "assistant";

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
};

export type AiGenerationResult =
  | { ok: true; text: string; model: string }
  | { ok: false; code: "ai_not_configured" | "ai_provider_error"; error: string };

const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_MAX_MESSAGES = 12;
const DEFAULT_MAX_CONTENT_LENGTH = 2_000;

function readOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  return apiKey ? { apiKey, model } : null;
}

function normalizeRole(role: AiChatRole): "user" | "assistant" {
  return role === "assistant" ? "assistant" : "user";
}

function trimContent(value: string, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function sanitizeAiMessages(
  messages: AiChatMessage[],
  options: { maxMessages?: number; maxContentLength?: number } = {},
) {
  const maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const maxContentLength = options.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;

  return messages
    .slice(-maxMessages)
    .map((message) => ({
      role: message.role,
      content: trimContent(message.content, maxContentLength),
    }))
    .filter((message) => message.content.length > 0);
}

function extractResponsesText(payload: unknown) {
  const casted = payload as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
        type?: string;
      }>;
    }>;
  };

  if (typeof casted.output_text === "string" && casted.output_text.trim()) {
    return casted.output_text.trim();
  }

  const text = casted.output
    ?.flatMap((entry) => entry.content ?? [])
    .map((content) => content.text)
    .find((value): value is string => Boolean(value?.trim()));

  return text?.trim() ?? "";
}

export async function generateAiText(params: {
  system: string;
  messages: AiChatMessage[];
  maxMessages?: number;
  maxContentLength?: number;
}): Promise<AiGenerationResult> {
  const config = readOpenAiConfig();
  if (!config) {
    return {
      ok: false,
      code: "ai_not_configured",
      error: "OPENAI_API_KEY no está configurada.",
    };
  }

  const system = trimContent(params.system, 3_000);
  const messages = sanitizeAiMessages(params.messages, {
    maxMessages: params.maxMessages,
    maxContentLength: params.maxContentLength,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: [
          {
            role: "system",
            content: system,
          },
          ...messages.map((message) => ({
            role: normalizeRole(message.role),
            content: message.content,
          })),
        ],
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        code: "ai_provider_error",
        error: `OpenAI respondió con status ${response.status}.`,
      };
    }

    const payload = await response.json();
    const text = extractResponsesText(payload);
    if (!text) {
      return {
        ok: false,
        code: "ai_provider_error",
        error: "OpenAI no devolvió texto utilizable.",
      };
    }

    return { ok: true, text, model: config.model };
  } catch {
    return {
      ok: false,
      code: "ai_provider_error",
      error: "No se pudo contactar al proveedor de IA.",
    };
  }
}
