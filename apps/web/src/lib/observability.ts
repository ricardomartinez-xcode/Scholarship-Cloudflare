import * as Sentry from "@sentry/nextjs";

type TelemetryValue =
  | string
  | number
  | boolean
  | null
  | TelemetryValue[]
  | { [key: string]: TelemetryValue };

export type LogLevel = "info" | "warn" | "error";

export type ObservabilityContext = {
  module?: string | null;
  action?: string | null;
  result?: string | null;
  requestId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  metadata?: Record<string, unknown> | null;
};

const REDACTED = "[redacted]";
const EMAIL_MASK = "***@***";
const MAX_STRING_LENGTH = 240;
const SENSITIVE_KEY_RE =
  /(pass(word)?|secret|token|cookie|authorization|api[-_]?key|smtp|dsn|session|accepturl|link)/i;

function truncate(value: string) {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}...`
    : value;
}

export function isSentryEnabled() {
  return Boolean(
    process.env.SENTRY_DSN ||
      process.env.NEXT_PUBLIC_SENTRY_DSN,
  );
}

export function getSentryEnvironment() {
  return (
    process.env.SENTRY_ENVIRONMENT ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    "development"
  );
}

export function maskEmail(email: string | null | undefined) {
  const value = String(email ?? "").trim().toLowerCase();
  if (!value || !value.includes("@")) return null;

  const [localPart, domain] = value.split("@");
  if (!localPart || !domain) return EMAIL_MASK;

  const visibleLocal = localPart.length <= 2
    ? `${localPart[0] ?? "*"}*`
    : `${localPart.slice(0, 2)}***`;
  const [domainLabel, ...rest] = domain.split(".");
  const maskedDomain = domainLabel ? `${domainLabel.slice(0, 2)}***` : "***";
  return `${visibleLocal}@${[maskedDomain, ...rest].filter(Boolean).join(".")}`;
}

function redactString(value: string, key: string | null) {
  if (key && SENSITIVE_KEY_RE.test(key)) return REDACTED;
  if (value.includes("@")) return maskEmail(value) ?? EMAIL_MASK;
  if (/bearer\s+[a-z0-9\-_\.]+/i.test(value)) return REDACTED;
  if (/https?:\/\/.+token=/i.test(value)) return REDACTED;
  return truncate(value);
}

export function sanitizeTelemetryValue(
  value: unknown,
  key: string | null = null,
): TelemetryValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return redactString(value, key);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message, key),
      stack: value.stack ? truncate(value.stack) : null,
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeTelemetryValue(item, key));
  }
  if (typeof value === "object") {
    const result: Record<string, TelemetryValue> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      result[entryKey] = sanitizeTelemetryValue(entryValue, entryKey);
    }
    return result;
  }
  return truncate(String(value));
}

export function sanitizeTelemetryObject<T>(value: T): T {
  return sanitizeTelemetryValue(value) as T;
}

function normalizeContext(context: ObservabilityContext = {}) {
  return {
    module: context.module ?? null,
    action: context.action ?? null,
    result: context.result ?? null,
    requestId: context.requestId ?? null,
    actorUserId: context.actorUserId ?? null,
    actorEmail: maskEmail(context.actorEmail) ?? null,
    subjectType: context.subjectType ?? null,
    subjectId: context.subjectId ?? null,
    metadata: sanitizeTelemetryObject(context.metadata ?? null) as
      | Record<string, TelemetryValue>
      | null,
  };
}

export function addObservabilityBreadcrumb(
  message: string,
  context: ObservabilityContext = {},
  level: LogLevel = "info",
) {
  if (!isSentryEnabled()) return;

  const normalized = normalizeContext(context);
  const sentryLevel: Sentry.SeverityLevel =
    level === "warn" ? "warning" : level;
  Sentry.addBreadcrumb({
    category: normalized.module ?? "app",
    message,
    level: sentryLevel,
    data: normalized as Record<string, string | number | boolean | null | object>,
  });
}

export function logStructured(
  level: LogLevel,
  message: string,
  context: ObservabilityContext = {},
) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...normalizeContext(context),
  };

  if (level === "error") {
    console.error(payload);
    return;
  }
  if (level === "warn") {
    console.warn(payload);
    return;
  }
  console.info(payload);
}

export function captureException(
  error: unknown,
  context: ObservabilityContext = {},
  message = "Unexpected application error",
) {
  const normalized = normalizeContext(context);
  logStructured("error", message, {
    ...normalized,
    metadata: {
      ...(normalized.metadata ?? {}),
      error: sanitizeTelemetryValue(error),
    },
  });

  if (!isSentryEnabled()) return;

  Sentry.withScope((scope) => {
    if (normalized.module) scope.setTag("module", normalized.module);
    if (normalized.action) scope.setTag("action", normalized.action);
    if (normalized.result) scope.setTag("result", normalized.result);
    if (normalized.requestId) scope.setTag("request_id", normalized.requestId);
    if (normalized.subjectType) scope.setTag("subject_type", normalized.subjectType);
    if (normalized.subjectId) scope.setTag("subject_id", normalized.subjectId);
    if (normalized.actorUserId) {
      scope.setUser({ id: normalized.actorUserId });
    }
    if (normalized.actorEmail) {
      scope.setContext("actor", { email: normalized.actorEmail });
    }
    if (normalized.metadata) {
      scope.setContext("metadata", normalized.metadata);
    }
    Sentry.captureException(
      error instanceof Error ? error : new Error(String(error)),
    );
  });
}

export function sanitizeSentryEvent<T>(event: T): T {
  return sanitizeTelemetryObject(event);
}
