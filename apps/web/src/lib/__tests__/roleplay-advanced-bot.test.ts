import { describe, expect, it } from "vitest";

import {
  ROLEPLAY_ADVANCED_BOT_ENV_KEYS,
  getAdvancedRoleplayBotStatus,
} from "@/lib/roleplay-advanced-bot";

describe("getAdvancedRoleplayBotStatus", () => {
  it("enables the advanced bot only when endpoint and API key are configured", () => {
    expect(getAdvancedRoleplayBotStatus({}).enabled).toBe(false);
    expect(
      getAdvancedRoleplayBotStatus({
        [ROLEPLAY_ADVANCED_BOT_ENV_KEYS.apiUrl]: "https://bot.example/api",
      }).enabled,
    ).toBe(false);

    const status = getAdvancedRoleplayBotStatus({
      [ROLEPLAY_ADVANCED_BOT_ENV_KEYS.apiUrl]: "https://bot.example/api",
      [ROLEPLAY_ADVANCED_BOT_ENV_KEYS.apiKey]: "secret",
      [ROLEPLAY_ADVANCED_BOT_ENV_KEYS.provider]: "openai",
      [ROLEPLAY_ADVANCED_BOT_ENV_KEYS.model]: "gpt-5-mini",
    });

    expect(status).toMatchObject({
      enabled: true,
      endpointConfigured: true,
      apiKeyConfigured: true,
      provider: "openai",
      model: "gpt-5-mini",
    });
  });
});
