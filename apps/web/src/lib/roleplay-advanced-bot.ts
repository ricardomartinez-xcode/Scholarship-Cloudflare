export const ROLEPLAY_ADVANCED_BOT_ENV_KEYS = {
  apiUrl: "ROLEPLAY_ADVANCED_BOT_API_URL",
  apiKey: "ROLEPLAY_ADVANCED_BOT_API_KEY",
  provider: "ROLEPLAY_ADVANCED_BOT_PROVIDER",
  model: "ROLEPLAY_ADVANCED_BOT_MODEL",
} as const;

export type AdvancedRoleplayBotStatus = {
  enabled: boolean;
  endpointConfigured: boolean;
  apiKeyConfigured: boolean;
  provider: string;
  model: string | null;
};

function readEnvValue(
  env: Record<string, string | undefined>,
  key: string,
): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

export function getAdvancedRoleplayBotStatus(
  env: Record<string, string | undefined> = process.env,
): AdvancedRoleplayBotStatus {
  const endpoint = readEnvValue(env, ROLEPLAY_ADVANCED_BOT_ENV_KEYS.apiUrl);
  const apiKey = readEnvValue(env, ROLEPLAY_ADVANCED_BOT_ENV_KEYS.apiKey);
  const provider =
    readEnvValue(env, ROLEPLAY_ADVANCED_BOT_ENV_KEYS.provider) ?? "custom";

  return {
    enabled: Boolean(endpoint && apiKey),
    endpointConfigured: Boolean(endpoint),
    apiKeyConfigured: Boolean(apiKey),
    provider,
    model: readEnvValue(env, ROLEPLAY_ADVANCED_BOT_ENV_KEYS.model),
  };
}
