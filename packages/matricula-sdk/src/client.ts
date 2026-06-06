import { MatriculaSdkError } from "./errors";
import type {
  MatriculaHealthResponse,
  MatriculaSdkAuth,
  MatriculaSdkClientOptions,
  MatriculaShareStatusResponse,
  ShareMatriculaOptions,
  ShareMatriculaPayload,
  ShareMatriculaResponse,
} from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_SHARE_PATH = "/api/matricula/share";
const DEFAULT_STATUS_PATH = "/api/matricula/share/{shareId}";
const DEFAULT_HEALTH_PATH = "/api/health";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function stripLeadingSlash(value: string): string {
  return value.replace(/^\/+/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function buildUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${stripTrailingSlash(baseUrl)}/${stripLeadingSlash(path)}`;
}

function parsePayload(text: string): unknown {
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function buildAuthHeaders(auth: MatriculaSdkAuth | undefined): Record<string, string> {
  if (!auth) return {};
  if (auth.type === "bearer") return { Authorization: `Bearer ${auth.token}` };
  return { [auth.headerName ?? "x-api-key"]: auth.apiKey };
}

function normalizeShareResponse(payload: unknown): ShareMatriculaResponse {
  if (!isRecord(payload)) return { ok: true, raw: payload };

  return {
    ok: typeof payload.ok === "boolean" ? payload.ok : true,
    shareId: readString(payload.shareId) ?? readString(payload.id),
    externalId: readString(payload.externalId),
    status: readString(payload.status),
    message: readString(payload.message),
    credentialUrl: readString(payload.credentialUrl),
    raw: payload,
  };
}

function normalizeHealthResponse(payload: unknown): MatriculaHealthResponse {
  if (!isRecord(payload)) return { ok: true, raw: payload };

  return {
    ok: typeof payload.ok === "boolean" ? payload.ok : true,
    status: readString(payload.status),
    service: readString(payload.service),
    raw: payload,
  };
}

type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
};

export class MatriculaSdkClient {
  private readonly baseUrl: string;
  private readonly auth?: MatriculaSdkAuth;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;
  private readonly sharePath: string;
  private readonly statusPath: string;
  private readonly healthPath: string;

  constructor(options: MatriculaSdkClientOptions) {
    if (!options.baseUrl.trim()) {
      throw new MatriculaSdkError("Matricula SDK requires a non-empty baseUrl.", {
        code: "MATRICULA_SDK_BASE_URL_REQUIRED",
      });
    }

    this.baseUrl = options.baseUrl;
    this.auth = options.auth;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetch ?? fetch;
    this.headers = options.headers ?? {};
    this.sharePath = options.sharePath ?? DEFAULT_SHARE_PATH;
    this.statusPath = options.statusPath ?? DEFAULT_STATUS_PATH;
    this.healthPath = options.healthPath ?? DEFAULT_HEALTH_PATH;
  }

  async health(): Promise<MatriculaHealthResponse> {
    const payload = await this.request("GET", this.healthPath);
    return normalizeHealthResponse(payload);
  }

  async shareMatricula(
    payload: ShareMatriculaPayload,
    options: ShareMatriculaOptions = {},
  ): Promise<ShareMatriculaResponse> {
    const matricula = payload.matricula.trim();

    if (!matricula) {
      throw new MatriculaSdkError("matricula is required before sharing.", {
        code: "MATRICULA_REQUIRED",
      });
    }

    const headers = {
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      ...(options.headers ?? {}),
    };
    const body = options.dryRun ? { ...payload, matricula, dryRun: true } : { ...payload, matricula };
    const response = await this.request("POST", this.sharePath, { body, headers });

    return normalizeShareResponse(response);
  }

  async getShareStatus(shareId: string): Promise<MatriculaShareStatusResponse> {
    const normalizedShareId = shareId.trim();

    if (!normalizedShareId) {
      throw new MatriculaSdkError("shareId is required to read share status.", {
        code: "MATRICULA_SHARE_ID_REQUIRED",
      });
    }

    const encodedShareId = encodeURIComponent(normalizedShareId);
    const path = this.statusPath.replace("{shareId}", encodedShareId).replace(":shareId", encodedShareId);
    const payload = await this.request("GET", path);

    return normalizeShareResponse(payload);
  }

  private async request(method: string, path: string, options: RequestOptions = {}): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body = options.body === undefined ? undefined : JSON.stringify(options.body);
      const response = await this.fetchImpl(buildUrl(this.baseUrl, path), {
        method,
        headers: {
          Accept: "application/json",
          ...this.headers,
          ...buildAuthHeaders(this.auth),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers ?? {}),
        },
        body,
        signal: controller.signal,
      });
      const responsePayload = parsePayload(await response.text());

      if (!response.ok) {
        throw new MatriculaSdkError(`Matricula SDK request failed with HTTP ${response.status}.`, {
          status: response.status,
          code: "MATRICULA_SDK_HTTP_ERROR",
          payload: responsePayload,
        });
      }

      return responsePayload;
    } catch (error) {
      if (error instanceof MatriculaSdkError) throw error;

      const isAbort = error instanceof Error && error.name === "AbortError";
      throw new MatriculaSdkError(isAbort ? "Matricula SDK request timed out." : "Matricula SDK request failed.", {
        code: isAbort ? "MATRICULA_SDK_TIMEOUT" : "MATRICULA_SDK_REQUEST_FAILED",
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createMatriculaSdkClient(options: MatriculaSdkClientOptions): MatriculaSdkClient {
  return new MatriculaSdkClient(options);
}
