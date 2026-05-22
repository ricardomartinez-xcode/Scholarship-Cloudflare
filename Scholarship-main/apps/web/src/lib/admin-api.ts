import { NextResponse } from "next/server";

import { logStructured } from "@/lib/observability";

type JsonRecord = Record<string, unknown>;

export type AdminApiErrorPayload = {
  requestId: string;
  status: number;
  error: string;
  errorCode: string;
  message?: string;
  details?: unknown;
  recoverable?: boolean;
};

function normalizeScope(scope: string) {
  const normalized = scope
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "admin";
}

export function buildAdminRequestId(scope = "admin") {
  const prefix = normalizeScope(scope);
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function describeError(error: unknown) {
  const err = error as { message?: string; code?: string; hint?: string };
  const chunks: string[] = [];
  if (err?.code) chunks.push(`code=${err.code}`);
  if (err?.message) chunks.push(err.message);
  if (err?.hint) chunks.push(`hint=${err.hint}`);
  return chunks.join(" · ") || String(error);
}

export function adminApiSuccess<T extends JsonRecord>(
  requestId: string,
  payload: T,
  options?: {
    status?: number;
    message?: string;
    details?: unknown;
  },
) {
  return NextResponse.json(
    {
      ok: true as const,
      message: options?.message ?? "OK",
      requestId,
      details: options?.details ?? null,
      ...payload,
    },
    { status: options?.status ?? 200 },
  );
}

export function adminApiError(params: AdminApiErrorPayload) {
  const recoverable =
    params.recoverable ??
    (params.status >= 500 ? true : params.status !== 401 && params.status !== 403);
  return NextResponse.json(
    {
      ok: false as const,
      error: params.error,
      errorCode: params.errorCode,
      message: params.message ?? params.error,
      requestId: params.requestId,
      details: params.details ?? null,
      recoverable,
    },
    { status: params.status },
  );
}

export function logAdminApiFailure(params: {
  requestId: string;
  module: string;
  action: string;
  error: unknown;
  actorUserId?: string | null;
  actorEmail?: string | null;
  details?: Record<string, unknown>;
}) {
  logStructured("error", "Admin API request failed", {
    module: params.module,
    action: params.action,
    result: "failure",
    requestId: params.requestId,
    actorUserId: params.actorUserId ?? null,
    actorEmail: params.actorEmail ?? null,
    metadata: {
      ...(params.details ?? {}),
      error: describeError(params.error),
    },
  });
}
