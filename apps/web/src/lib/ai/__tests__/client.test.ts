import { afterEach, describe, expect, it, vi } from "vitest";

import { generateAiText, sanitizeAiMessages } from "@/lib/ai/client";

describe("ai client", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns ai_not_configured when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await generateAiText({
      system: "Eres un asistente operativo.",
      messages: [{ role: "user", content: "Hola" }],
    });

    expect(result).toMatchObject({
      ok: false,
      code: "ai_not_configured",
    });
  });

  it("trims message history and content before sending to the provider", () => {
    const messages = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: ` ${index}-${"x".repeat(500)} `,
    }));

    const sanitized = sanitizeAiMessages(messages, {
      maxMessages: 6,
      maxContentLength: 120,
    });

    expect(sanitized).toHaveLength(6);
    expect(sanitized[0].content).toHaveLength(120);
    expect(sanitized[5].content.startsWith("19-")).toBe(true);
  });

  it("uses OPENAI_MODEL fallback and returns provider text", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.OPENAI_MODEL;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: "Respuesta lista" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateAiText({
      system: "Sistema",
      messages: [{ role: "user", content: "Dime algo" }],
    });

    expect(result).toMatchObject({
      ok: true,
      text: "Respuesta lista",
      model: "gpt-4.1-mini",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
