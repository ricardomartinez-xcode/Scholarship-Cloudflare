import "server-only";

import {
  createMatriculaSdkClient,
  type MatriculaSdkAuth,
  type ShareMatriculaOptions,
  type ShareMatriculaPayload,
  type ShareMatriculaResponse,
} from "@relead/matricula-sdk";

const DEFAULT_TIMEOUT_MS = 10_000;

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readTimeoutMs(): number {
  const rawValue = readEnv("MATRICULA_SDK_TIMEOUT_MS");
  if (!rawValue) return DEFAULT_TIMEOUT_MS;

  const timeoutMs = Number(rawValue);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
}

function readAuth(): MatriculaSdkAuth | undefined {
  const bearerToken = readEnv("MATRICULA_SDK_BEARER_TOKEN");
  if (bearerToken) return { type: "bearer", token: bearerToken };

  const apiKey = readEnv("MATRICULA_SDK_API_KEY");
  if (!apiKey) return undefined;

  return {
    type: "api-key",
    apiKey,
    headerName: readEnv("MATRICULA_SDK_API_KEY_HEADER") ?? "x-api-key",
  };
}

export function isMatriculaSharingEnabled(): boolean {
  return Boolean(readEnv("MATRICULA_SDK_BASE_URL") && readAuth());
}

export function createScholarshipMatriculaClient() {
  const baseUrl = readEnv("MATRICULA_SDK_BASE_URL");
  const auth = readAuth();

  if (!baseUrl) {
    throw new Error("MATRICULA_SDK_BASE_URL is required to share matricula.");
  }

  if (!auth) {
    throw new Error("MATRICULA_SDK_BEARER_TOKEN or MATRICULA_SDK_API_KEY is required to share matricula.");
  }

  return createMatriculaSdkClient({
    baseUrl,
    auth,
    timeoutMs: readTimeoutMs(),
    sharePath: readEnv("MATRICULA_SDK_SHARE_PATH") ?? "/api/matricula/share",
    statusPath: readEnv("MATRICULA_SDK_STATUS_PATH") ?? "/api/matricula/share/{shareId}",
    healthPath: readEnv("MATRICULA_SDK_HEALTH_PATH") ?? "/api/health",
    headers: {
      "x-integration-source": "scholarship",
    },
  });
}

export async function shareMatriculaFromScholarship(
  payload: ShareMatriculaPayload,
  options: ShareMatriculaOptions = {},
): Promise<ShareMatriculaResponse> {
  return createScholarshipMatriculaClient().shareMatricula(
    {
      source: "scholarship",
      ...payload,
    },
    options,
  );
}

export type { ShareMatriculaOptions, ShareMatriculaPayload, ShareMatriculaResponse };
