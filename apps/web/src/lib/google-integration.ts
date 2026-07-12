import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { prisma } from "@/lib/prisma";
import { writeBusinessEventSafe } from "@/lib/business-events";
import {
  GOOGLE_CONTACTS_SHEET_NAME as PROSPECT_CONTACTS_SHEET_NAME,
  PROSPECT_TRACKING_HEADER_STYLE,
  PROSPECT_TRACKING_SHEETS,
  PROSPECT_TRACKING_SPREADSHEET_TITLE,
  PROSPECT_TRACKING_WORKBOOK_SHEET_NAMES,
  buildProspectTrackingSheets,
  type ProspectCampaignSyncRow,
  type ProspectContactSyncRow,
  type ProspectGeneratedSheet,
  type ProspectSheetValue,
  type ProspectTrackingSheetName,
} from "@/lib/prospect-tracking-sheets";
import {
  MATRICULA_CONTACT_AUDIT_HEADERS,
  MATRICULA_CONTACT_HEADERS,
  buildMatriculaContactAuditRow,
  buildMatriculaContactRow,
  findMatriculaContactRowIndex,
  type MatriculaContactSheetInput,
} from "@/lib/matricula-contact-sheets";

const GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API_BASE_URL = "https://www.googleapis.com";
const GOOGLE_TASKS_API_BASE_URL = "https://tasks.googleapis.com";
const GOOGLE_SHEETS_API_BASE_URL = "https://sheets.googleapis.com";
const GOOGLE_PEOPLE_API_BASE_URL = "https://people.googleapis.com";
const GOOGLE_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/contacts.readonly",
  "openid",
  "email",
  "profile",
];
const GOOGLE_STATE_TTL_MS = 15 * 60 * 1000;
const MATRICULA_CONTACT_CREATION_SHEET_NAME = "Creacion de contacto";
const MATRICULA_CONTACT_UPDATE_SHEET_NAME = "Actualizacion de contacto";

const GOOGLE_TASKS_SCOPES = ["https://www.googleapis.com/auth/tasks"];
const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.calendarlist",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
const GOOGLE_CALENDAR_LIST_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.calendarlist",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
const GOOGLE_SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const GOOGLE_CONTACTS_SCOPES = [
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/contacts.readonly",
];

const GOOGLE_IDENTITY_SCOPES = ["openid", "email", "profile"];

export type GoogleConnectService =
  | "all"
  | "agenda"
  | "contacts"
  | "calendar"
  | "tasks"
  | "sheets";

export type GoogleConnectIntent = "agenda_sync" | "contacts_sync" | "manual";

export type GoogleServiceState = {
  key: "identity" | "calendar" | "tasks" | "sheets" | "contacts";
  label: string;
  connected: boolean;
  missingScopes: string[];
};

type GoogleConnectionRecord = Awaited<
  ReturnType<typeof prisma.userGoogleConnection.findUnique>
>;

export const GOOGLE_CONTACTS_SHEET_NAME = PROSPECT_CONTACTS_SHEET_NAME;

export type GoogleContactsSyncRow = ProspectContactSyncRow;

export type MatriculaContactSheetSyncResult =
  | {
      ok: true;
      action: "created" | "updated";
      spreadsheetId: string;
      sheetName: string;
      matchedBy?: "matricula" | "fullName" | "email" | "phone";
    }
  | {
      ok: false;
      skipped:
        | "dry_run"
        | "unauthenticated"
        | "google_not_connected"
        | "sheets_not_connected"
        | "sheets_sync_disabled";
    };

export type GoogleTasklistSummary = {
  id: string;
  title: string;
  updated: string | null;
};

export type GoogleTaskSummary = {
  id: string;
  title: string;
  notes: string | null;
  due: string | null;
  status: string;
  updated: string | null;
  tasklistId: string;
  tasklistTitle: string;
  webViewLink: string | null;
};

export type GoogleCalendarSummary = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string | null;
};

export type GoogleCalendarEventSummary = {
  id: string;
  summary: string;
  description: string | null;
  start: string | null;
  end: string | null;
  status: string | null;
  htmlLink: string | null;
  calendarId: string;
  calendarSummary: string;
};

export type GoogleContactPreview = {
  resourceName: string;
  etag: string | null;
  displayName: string;
  primaryPhone: string | null;
  normalizedPhone: string | null;
  primaryEmail: string | null;
  organization: string | null;
  title: string | null;
  photoUrl: string | null;
  updatedAt: string | null;
};

function getGoogleServiceLabel(path: string) {
  if (path.startsWith("/sheets/")) return "Google Sheets";
  if (path.startsWith("/tasks/")) return "Google Tasks";
  if (path.startsWith("/calendar/")) return "Google Calendar";
  if (path.startsWith("/people/")) return "Google Contacts";
  return "Google";
}

function resolveGoogleApiUrl(path: string) {
  if (path === "/sheets/v4/spreadsheets") {
    return `${GOOGLE_SHEETS_API_BASE_URL}/v4/spreadsheets`;
  }
  if (path.startsWith("/sheets/v4/")) {
    return `${GOOGLE_SHEETS_API_BASE_URL}/v4/${path.slice("/sheets/v4/".length)}`;
  }
  if (path.startsWith("/tasks/")) {
    return `${GOOGLE_TASKS_API_BASE_URL}${path}`;
  }
  if (path.startsWith("/calendar/")) {
    return `${GOOGLE_CALENDAR_API_BASE_URL}${path}`;
  }
  if (path.startsWith("/people/")) {
    return `${GOOGLE_PEOPLE_API_BASE_URL}${path}`;
  }
  return `${GOOGLE_CALENDAR_API_BASE_URL}${path}`;
}

function normalizeGooglePhone(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  const hasPlus = normalized.startsWith("+");
  const digits = normalized.replace(/\D+/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

function scopeListIncludes(scopes: string[] | null | undefined, candidates: string[]) {
  return candidates.some((candidate) =>
    (scopes ?? []).some((scope) => scope.trim() === candidate),
  );
}

function uniqueScopes(scopes: string[]) {
  return Array.from(new Set(scopes.map((scope) => scope.trim()).filter(Boolean)));
}

function resolveServiceScopes(service: GoogleConnectService | null | undefined) {
  const normalized = String(service ?? "all").trim().toLowerCase();
  if (normalized === "contacts") {
    return uniqueScopes([
      ...GOOGLE_IDENTITY_SCOPES,
      ...GOOGLE_CONTACTS_SCOPES,
      ...GOOGLE_SHEETS_SCOPES,
    ]);
  }
  if (normalized === "agenda") {
    return uniqueScopes([
      ...GOOGLE_IDENTITY_SCOPES,
      ...GOOGLE_TASKS_SCOPES,
      ...GOOGLE_CALENDAR_SCOPES,
      ...GOOGLE_SHEETS_SCOPES,
    ]);
  }
  if (normalized === "calendar") {
    return uniqueScopes([...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_CALENDAR_SCOPES]);
  }
  if (normalized === "tasks") {
    return uniqueScopes([...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_TASKS_SCOPES]);
  }
  if (normalized === "sheets") {
    return uniqueScopes([...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_SHEETS_SCOPES]);
  }

  return uniqueScopes(GOOGLE_DEFAULT_SCOPES);
}

export function buildGoogleServiceStates(scopes: string[] | null | undefined): GoogleServiceState[] {
  const normalized = (scopes ?? []).map((scope) => scope.trim()).filter(Boolean);
  const hasScope = (candidateScopes: string[]) =>
    candidateScopes.some((candidate) => normalized.includes(candidate));

  return [
    {
      key: "identity",
      label: "Google Identity",
      connected: hasScope(GOOGLE_IDENTITY_SCOPES),
      missingScopes: GOOGLE_IDENTITY_SCOPES.filter((scope) => !normalized.includes(scope)),
    },
    {
      key: "calendar",
      label: "Google Calendar",
      connected: hasScope(GOOGLE_CALENDAR_SCOPES),
      missingScopes: GOOGLE_CALENDAR_SCOPES.filter((scope) => !normalized.includes(scope)),
    },
    {
      key: "tasks",
      label: "Google Tasks",
      connected: hasScope(GOOGLE_TASKS_SCOPES),
      missingScopes: GOOGLE_TASKS_SCOPES.filter((scope) => !normalized.includes(scope)),
    },
    {
      key: "sheets",
      label: "Google Sheets",
      connected: hasScope(GOOGLE_SHEETS_SCOPES),
      missingScopes: GOOGLE_SHEETS_SCOPES.filter((scope) => !normalized.includes(scope)),
    },
    {
      key: "contacts",
      label: "Google Contacts",
      connected: hasScope(GOOGLE_CONTACTS_SCOPES),
      missingScopes: GOOGLE_CONTACTS_SCOPES.filter((scope) => !normalized.includes(scope)),
    },
  ];
}

function getErrorMessageFromJsonPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  if (typeof record.error_description === "string" && record.error_description.trim()) {
    return record.error_description.trim();
  }
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error.trim();
  }

  const nestedError = record.error;
  if (!nestedError || typeof nestedError !== "object") return null;

  const nestedRecord = nestedError as Record<string, unknown>;
  if (typeof nestedRecord.message === "string" && nestedRecord.message.trim()) {
    return nestedRecord.message.trim();
  }
  if (typeof nestedRecord.status === "string" && nestedRecord.status.trim()) {
    return nestedRecord.status.trim();
  }

  return null;
}

async function parseGoogleResponseBody(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const rawBody = await response.text();
  if (!rawBody) {
    return {
      rawBody: "",
      parsedBody: null as unknown,
      contentType,
    };
  }

  if (contentType.includes("application/json")) {
    try {
      return {
        rawBody,
        parsedBody: JSON.parse(rawBody) as unknown,
        contentType,
      };
    } catch {
      return {
        rawBody,
        parsedBody: null as unknown,
        contentType,
      };
    }
  }

  return {
    rawBody,
    parsedBody: null as unknown,
    contentType,
  };
}

async function getGoogleApiErrorMessage(response: Response, path: string) {
  const { rawBody, parsedBody, contentType } = await parseGoogleResponseBody(response);
  const serviceLabel = getGoogleServiceLabel(path);
  const structuredMessage = getErrorMessageFromJsonPayload(parsedBody);

  if (structuredMessage) {
    return `${serviceLabel}: ${structuredMessage}`;
  }

  if (!contentType.includes("application/json") && rawBody.includes("<!DOCTYPE html")) {
    if (response.status === 404) {
      return `${serviceLabel} no encontró el recurso solicitado. Revisa la configuración del servicio y vuelve a sincronizar.`;
    }
    return `${serviceLabel} respondió con un error inesperado del proveedor (HTTP ${response.status}).`;
  }

  if (response.status === 401 || response.status === 403) {
    return `${serviceLabel} rechazó la solicitud. Vuelve a conectar tu cuenta y verifica los permisos otorgados.`;
  }

  if (response.status === 404) {
    return `${serviceLabel} no encontró el recurso solicitado.`;
  }

  return rawBody.trim() || `${serviceLabel} devolvió un error HTTP ${response.status}.`;
}

function getGoogleEnv() {
  const dedicatedClientId = process.env.GOOGLE_SYNC_CLIENT_ID?.trim() ?? "";
  const dedicatedClientSecret = process.env.GOOGLE_SYNC_CLIENT_SECRET?.trim() ?? "";
  const dedicatedRedirectUri =
    process.env.GOOGLE_SYNC_OAUTH_REDIRECT_URI?.trim() ?? "";
  // Use the dedicated sync client only when the full triplet is configured.
  const useDedicatedSyncClient = Boolean(
    dedicatedClientId && dedicatedClientSecret && dedicatedRedirectUri,
  );

  const clientId = useDedicatedSyncClient
    ? dedicatedClientId
    : process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = useDedicatedSyncClient
    ? dedicatedClientSecret
    : process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = useDedicatedSyncClient
    ? dedicatedRedirectUri
    : process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ?? "";

  return {
    clientId,
    clientSecret,
    redirectUri,
    encryptionSecret: process.env.GOOGLE_INTEGRATION_SECRET?.trim() ?? "",
    mode: useDedicatedSyncClient ? "dedicated" : "shared",
  };
}

export function getGoogleIntegrationConfigState() {
  const env = getGoogleEnv();
  const missingVars =
    env.mode === "dedicated"
      ? Object.entries({
          GOOGLE_SYNC_CLIENT_ID: env.clientId,
          GOOGLE_SYNC_CLIENT_SECRET: env.clientSecret,
          GOOGLE_SYNC_OAUTH_REDIRECT_URI: env.redirectUri,
          GOOGLE_INTEGRATION_SECRET: env.encryptionSecret,
        })
      : Object.entries({
          GOOGLE_CLIENT_ID: env.clientId,
          GOOGLE_CLIENT_SECRET: env.clientSecret,
          GOOGLE_OAUTH_REDIRECT_URI: env.redirectUri,
          GOOGLE_INTEGRATION_SECRET: env.encryptionSecret,
        });

  return {
    ready:
      Boolean(env.clientId) &&
      Boolean(env.clientSecret) &&
      Boolean(env.redirectUri) &&
      Boolean(env.encryptionSecret),
    mode: env.mode,
    missing: missingVars
      .filter(([, value]) => !value)
      .map(([key]) => key),
  };
}

export function getSupabaseGoogleCallbackUri() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/+$/, "")}/auth/v1/callback`;
}

export function getGoogleOAuthSetupSummary() {
  const env = getGoogleEnv();
  const config = getGoogleIntegrationConfigState();
  return {
    mode: env.mode,
    syncCallbackUri: env.redirectUri || null,
    supabaseLoginCallbackUri: getSupabaseGoogleCallbackUri(),
    expectedAuthorizedRedirectUris: [
      getSupabaseGoogleCallbackUri(),
      env.redirectUri || null,
    ].filter((value): value is string => Boolean(value)),
    ready: config.ready,
    missing: config.missing,
  };
}

function getEncryptionKey() {
  const { encryptionSecret } = getGoogleEnv();
  if (!encryptionSecret) {
    throw new Error(
      "GOOGLE_INTEGRATION_SECRET es requerido para guardar tokens Google de forma segura.",
    );
  }

  return createHash("sha256").update(encryptionSecret).digest();
}

function getGoogleStateSecret() {
  return (
    process.env.GOOGLE_OAUTH_STATE_SECRET?.trim() ||
    process.env.GOOGLE_INTEGRATION_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

function buildGoogleStateSigningInput(payload: {
  userId: string;
  nextPath: string;
  intent: GoogleConnectIntent;
  service: GoogleConnectService;
  iat: number;
  exp: number;
  nonce: string;
}) {
  return JSON.stringify({
    userId: payload.userId,
    nextPath: payload.nextPath,
    intent: payload.intent,
    service: payload.service,
    iat: payload.iat,
    exp: payload.exp,
    nonce: payload.nonce,
  });
}

function signGoogleStatePayload(payload: {
  userId: string;
  nextPath: string;
  intent: GoogleConnectIntent;
  service: GoogleConnectService;
  iat: number;
  exp: number;
  nonce: string;
}) {
  const secret = getGoogleStateSecret();
  if (!secret) return "";
  return createHmac("sha256", secret)
    .update(buildGoogleStateSigningInput(payload))
    .digest("base64url");
}

function signaturesMatch(left: string, right: string) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  const buffer = Buffer.from(value, "base64url");
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function buildStatePayload(
  userId: string,
  nextPath: string | null,
  extras?: {
    intent?: GoogleConnectIntent | null;
    service?: GoogleConnectService | null;
  },
) {
  const iat = Date.now();
  const payload = {
    userId,
    nextPath: nextPath && nextPath.startsWith("/") ? nextPath : "/profile",
    intent: extras?.intent ?? "manual",
    service: extras?.service ?? "all",
    iat,
    exp: iat + GOOGLE_STATE_TTL_MS,
    nonce: randomBytes(16).toString("base64url"),
  };
  return Buffer.from(
    JSON.stringify({
      ...payload,
      sig: signGoogleStatePayload(payload),
    }),
  ).toString("base64url");
}

function parseGoogleStatePayload(state: string) {
  const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
    userId?: string;
    nextPath?: string;
    intent?: string;
    service?: string;
    iat?: number;
    exp?: number;
    nonce?: string;
    sig?: string;
  };
  const intentCandidate = String(parsed.intent ?? "").trim().toLowerCase();
  const serviceCandidate = String(parsed.service ?? "").trim().toLowerCase();
  const normalized = {
    userId: String(parsed.userId ?? "").trim(),
    nextPath:
      String(parsed.nextPath ?? "").trim().startsWith("/")
        ? String(parsed.nextPath ?? "").trim()
        : "/profile",
    intent:
      intentCandidate === "agenda_sync" ||
      intentCandidate === "contacts_sync" ||
      intentCandidate === "manual"
        ? (intentCandidate as GoogleConnectIntent)
        : ("manual" as const),
    service:
      serviceCandidate === "agenda" ||
      serviceCandidate === "contacts" ||
      serviceCandidate === "calendar" ||
      serviceCandidate === "tasks" ||
      serviceCandidate === "sheets" ||
      serviceCandidate === "all"
        ? (serviceCandidate as GoogleConnectService)
        : ("all" as const),
  };
  const iat = Number(parsed.iat ?? 0);
  const exp = Number(parsed.exp ?? 0);
  const nonce = String(parsed.nonce ?? "").trim();
  const sig = String(parsed.sig ?? "").trim();
  const expectedSig =
    iat > 0 && exp > 0 && nonce
      ? signGoogleStatePayload({
          ...normalized,
          iat,
          exp,
          nonce,
        })
      : "";

  return {
    ...normalized,
    signed: Boolean(sig),
    validSignature: Boolean(sig && expectedSig && signaturesMatch(sig, expectedSig)),
    expired: Boolean(exp && exp < Date.now()),
  };
}

export function parseGoogleState(state: string) {
  const parsed = parseGoogleStatePayload(state);
  return {
    userId: parsed.userId,
    nextPath: parsed.nextPath,
    intent: parsed.intent,
    service: parsed.service,
  };
}

export function parseGoogleCallbackState(state: string) {
  try {
    return parseGoogleStatePayload(state);
  } catch {
    return {
      userId: "",
      nextPath: "/profile",
      intent: "manual" as const,
      service: "all" as const,
      signed: false,
      validSignature: false,
      expired: false,
    };
  }
}

export function buildGoogleConnectUrl(params: {
  userId: string;
  nextPath?: string | null;
  scopes?: string[] | null;
  service?: GoogleConnectService | null;
  intent?: GoogleConnectIntent | null;
  loginHint?: string | null;
}) {
  const env = getGoogleEnv();
  if (!env.clientId || !env.redirectUri) {
    throw new Error(
      "Configura GOOGLE_CLIENT_ID y GOOGLE_OAUTH_REDIRECT_URI antes de iniciar la conexión Google.",
    );
  }

  const url = new URL(GOOGLE_AUTH_BASE_URL);
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set(
    "scope",
    uniqueScopes(params.scopes ?? resolveServiceScopes(params.service)).join(" "),
  );
  if (params.loginHint?.trim()) {
    url.searchParams.set("login_hint", params.loginHint.trim());
  }
  url.searchParams.set(
    "state",
    buildStatePayload(params.userId, params.nextPath ?? "/profile", {
      intent: params.intent ?? "manual",
      service: params.service ?? "all",
    }),
  );
  return url.toString();
}

async function exchangeCodeForTokens(code: string) {
  const env = getGoogleEnv();
  if (!env.clientId || !env.clientSecret || !env.redirectUri) {
    throw new Error("Faltan credenciales OAuth de Google para intercambiar el código.");
  }

  const body = new URLSearchParams({
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      getErrorMessageFromJsonPayload(payload) || "Google OAuth failed";
    throw new Error(message);
  }

  return {
    accessToken: String(payload.access_token ?? ""),
    refreshToken: String(payload.refresh_token ?? ""),
    expiresIn: Number(payload.expires_in ?? 0),
    scopes: String(payload.scope ?? "")
      .split(" ")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

async function refreshAccessToken(connection: NonNullable<GoogleConnectionRecord>) {
  const env = getGoogleEnv();
  if (!env.clientId || !env.clientSecret) {
    throw new Error("Faltan credenciales OAuth de Google para refrescar el token.");
  }

  const refreshToken = decryptSecret(connection.encryptedRefreshToken);
  if (!refreshToken) {
    throw new Error("La conexión Google no tiene refresh token disponible.");
  }

  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      getErrorMessageFromJsonPayload(payload) || "Google refresh failed";
    throw new Error(message);
  }

  const accessToken = String(payload.access_token ?? "");
  const expiresIn = Number(payload.expires_in ?? 0);

  await prisma.userGoogleConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encryptSecret(accessToken),
      accessTokenExpiresAt: expiresIn
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
      status: "connected",
      lastSyncError: null,
    },
  });

  return accessToken;
}

async function ensureGoogleAccessToken(connection: NonNullable<GoogleConnectionRecord>) {
  const accessToken = decryptSecret(connection.encryptedAccessToken);
  const expiresAt = connection.accessTokenExpiresAt?.getTime() ?? 0;
  const shouldRefresh = !accessToken || !expiresAt || expiresAt <= Date.now() + 60_000;

  if (!shouldRefresh) return accessToken;
  return refreshAccessToken(connection);
}

export async function upsertGoogleConnectionFromCode(params: {
  userId: string;
  code: string;
}) {
  const tokens = await exchangeCodeForTokens(params.code);

  const connection = await prisma.userGoogleConnection.upsert({
    where: { userId: params.userId },
    update: {
      encryptedAccessToken: tokens.accessToken ? encryptSecret(tokens.accessToken) : null,
      encryptedRefreshToken: tokens.refreshToken
        ? encryptSecret(tokens.refreshToken)
        : undefined,
      accessTokenExpiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
      scopes: tokens.scopes,
      status: "connected",
      calendarConnected: tokens.scopes.some((scope) => scope.includes("calendar")),
      tasksConnected: tokens.scopes.some((scope) => scope.includes("tasks")),
      sheetsConnected: tokens.scopes.some((scope) => scope.includes("spreadsheets")),
      lastSyncError: null,
    },
    create: {
      userId: params.userId,
      encryptedAccessToken: tokens.accessToken ? encryptSecret(tokens.accessToken) : null,
      encryptedRefreshToken: tokens.refreshToken
        ? encryptSecret(tokens.refreshToken)
        : null,
      accessTokenExpiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
      scopes: tokens.scopes,
      status: "connected",
      calendarConnected: tokens.scopes.some((scope) => scope.includes("calendar")),
      tasksConnected: tokens.scopes.some((scope) => scope.includes("tasks")),
      sheetsConnected: tokens.scopes.some((scope) => scope.includes("spreadsheets")),
    },
  });

  await prisma.agendaSyncPreference.upsert({
    where: { userId: params.userId },
    update: { googleConnectionId: connection.id },
    create: {
      userId: params.userId,
      googleConnectionId: connection.id,
    },
  });

  await writeBusinessEventSafe({
    type: "EXTENSION_RUN_EVENT",
    userId: params.userId,
    subjectType: "google_connection",
    subjectId: connection.id,
    metadata: {
      eventType: "google_connected",
      scopes: tokens.scopes,
    },
  });

  return connection;
}

export async function getAgendaIntegrationStatus(userId: string) {
  const [connection, preference] = await Promise.all([
    prisma.userGoogleConnection.findUnique({ where: { userId } }),
    prisma.agendaSyncPreference.findUnique({ where: { userId } }),
  ]);

  const scopes = Array.isArray(connection?.scopes)
    ? connection.scopes.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const serviceStates = buildGoogleServiceStates(scopes);
  const operationalServices = serviceStates.filter((service) => service.key !== "identity");
  const activeOperationalServices = operationalServices.filter((service) => service.connected);
  const identityOnlyLogin =
    Boolean(connection) &&
    serviceStates.find((service) => service.key === "identity")?.connected === true &&
    activeOperationalServices.length === 0;

  return {
    provider: connection?.provider ?? "google",
    connectionStatus: connection?.status ?? "pending",
    googleReady: getGoogleIntegrationConfigState(),
    serviceStates,
    identityOnlyLogin,
    integrationSummary:
      activeOperationalServices.length > 0
        ? `Servicios activos: ${activeOperationalServices.map((service) => service.label).join(", ")}.`
        : identityOnlyLogin
          ? "La cuenta solo tiene scopes de identidad (login). Faltan permisos operativos."
          : "Aún no hay conexión operativa con Google.",
    connection: connection
      ? {
          connected: connection.status === "connected",
          calendarConnected: scopeListIncludes(scopes, GOOGLE_CALENDAR_SCOPES),
          tasksConnected: scopeListIncludes(scopes, GOOGLE_TASKS_SCOPES),
          sheetsConnected: scopeListIncludes(scopes, GOOGLE_SHEETS_SCOPES),
          contactsConnected: scopeListIncludes(scopes, GOOGLE_CONTACTS_SCOPES),
          scopes,
          lastSyncError: connection.lastSyncError,
          updatedAt: connection.updatedAt.toISOString(),
        }
      : null,
    preference: preference
      ? {
          syncCalendarEnabled: preference.syncCalendarEnabled,
          syncTasksEnabled: preference.syncTasksEnabled,
          syncSheetsEnabled: preference.syncSheetsEnabled,
          calendarId: preference.calendarId,
          tasklistId: preference.tasklistId,
          spreadsheetId: preference.spreadsheetId,
          worksheetName: preference.worksheetName,
          lastSyncedAt: preference.lastSyncedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export async function updateAgendaSyncPreference(params: {
  userId: string;
  syncCalendarEnabled?: boolean;
  syncTasksEnabled?: boolean;
  syncSheetsEnabled?: boolean;
  calendarId?: string | null;
  tasklistId?: string | null;
  spreadsheetId?: string | null;
  worksheetName?: string | null;
}) {
  return prisma.agendaSyncPreference.upsert({
    where: { userId: params.userId },
    update: {
      syncCalendarEnabled: params.syncCalendarEnabled ?? undefined,
      syncTasksEnabled: params.syncTasksEnabled ?? undefined,
      syncSheetsEnabled: params.syncSheetsEnabled ?? undefined,
      calendarId: params.calendarId === undefined ? undefined : params.calendarId,
      tasklistId: params.tasklistId === undefined ? undefined : params.tasklistId,
      spreadsheetId:
        params.spreadsheetId === undefined ? undefined : params.spreadsheetId,
      worksheetName:
        params.worksheetName === undefined ? undefined : params.worksheetName,
    },
    create: {
      userId: params.userId,
      syncCalendarEnabled: params.syncCalendarEnabled ?? false,
      syncTasksEnabled: params.syncTasksEnabled ?? false,
      syncSheetsEnabled: params.syncSheetsEnabled ?? false,
      calendarId: params.calendarId ?? null,
      tasklistId: params.tasklistId ?? null,
      spreadsheetId: params.spreadsheetId ?? null,
      worksheetName: params.worksheetName ?? null,
    },
  });
}

export async function disconnectGoogleIntegration(userId: string) {
  const connection = await prisma.userGoogleConnection.findUnique({
    where: { userId },
  });

  const preferenceOperation = prisma.agendaSyncPreference.upsert({
    where: { userId },
    update: {
      googleConnectionId: null,
      syncCalendarEnabled: false,
      syncTasksEnabled: false,
      syncSheetsEnabled: false,
      calendarId: null,
      tasklistId: null,
      spreadsheetId: null,
      worksheetName: null,
      lastSyncedAt: null,
    },
    create: {
      userId,
      googleConnectionId: null,
      syncCalendarEnabled: false,
      syncTasksEnabled: false,
      syncSheetsEnabled: false,
      calendarId: null,
      tasklistId: null,
      spreadsheetId: null,
      worksheetName: null,
      lastSyncedAt: null,
    },
  });

  await prisma.$transaction([
    preferenceOperation,
    ...(connection
      ? [prisma.userGoogleConnection.delete({ where: { userId } })]
      : []),
  ]);

  await writeBusinessEventSafe({
    type: "EXTENSION_RUN_EVENT",
    userId,
    subjectType: "google_connection",
    subjectId: connection?.id ?? userId,
    metadata: {
      eventType: "google_disconnected",
      hadConnection: Boolean(connection),
    },
  });

  return {
    removedConnection: Boolean(connection),
  };
}

async function googleApiFetch(
  path: string,
  init: RequestInit,
  connection: NonNullable<GoogleConnectionRecord>,
) {
  const token = await ensureGoogleAccessToken(connection);
  const response = await fetch(resolveGoogleApiUrl(path), {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await getGoogleApiErrorMessage(response, path));
  }

  return response;
}

async function getGoogleConnectionForUserOrThrow(userId: string) {
  const connection = await prisma.userGoogleConnection.findUnique({
    where: { userId },
  });

  if (!connection || connection.status !== "connected") {
    throw new Error("No existe una conexión Google activa para este usuario.");
  }

  return connection;
}

async function listGoogleTasklists(
  connection: NonNullable<GoogleConnectionRecord>,
) {
  const response = await googleApiFetch(
    "/tasks/v1/users/@me/lists?maxResults=100",
    { method: "GET" },
    connection,
  );
  const result = (await response.json()) as {
    items?: Array<{
      id?: string;
      title?: string;
      updated?: string;
    }>;
  };

  return (result.items ?? [])
    .map<GoogleTasklistSummary | null>((item) => {
      const id = String(item.id ?? "").trim();
      if (!id) return null;
      return {
        id,
        title: String(item.title ?? "Sin nombre").trim() || "Sin nombre",
        updated: String(item.updated ?? "").trim() || null,
      };
    })
    .filter((item): item is GoogleTasklistSummary => Boolean(item));
}

async function listGoogleTasks(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  tasklistId: string;
  tasklistTitle: string;
}) {
  const response = await googleApiFetch(
    `/tasks/v1/lists/${encodeURIComponent(
      params.tasklistId,
    )}/tasks?maxResults=100&showCompleted=true&showHidden=false&showDeleted=false`,
    { method: "GET" },
    params.connection,
  );
  const result = (await response.json()) as {
    items?: Array<{
      id?: string;
      title?: string;
      notes?: string;
      due?: string;
      status?: string;
      updated?: string;
      webViewLink?: string;
    }>;
  };

  return (result.items ?? [])
    .map<GoogleTaskSummary | null>((item) => {
      const id = String(item.id ?? "").trim();
      if (!id) return null;
      return {
        id,
        title: String(item.title ?? "Sin título").trim() || "Sin título",
        notes: String(item.notes ?? "").trim() || null,
        due: String(item.due ?? "").trim() || null,
        status: String(item.status ?? "needsAction").trim() || "needsAction",
        updated: String(item.updated ?? "").trim() || null,
        tasklistId: params.tasklistId,
        tasklistTitle: params.tasklistTitle,
        webViewLink: String(item.webViewLink ?? "").trim() || null,
      };
    })
    .filter((item): item is GoogleTaskSummary => Boolean(item));
}

async function listGoogleCalendars(
  connection: NonNullable<GoogleConnectionRecord>,
) {
  const response = await googleApiFetch(
    "/calendar/v3/users/me/calendarList",
    { method: "GET" },
    connection,
  );
  const result = (await response.json()) as {
    items?: Array<{
      id?: string;
      summary?: string;
      primary?: boolean;
      accessRole?: string;
    }>;
  };

  return (result.items ?? [])
    .map<GoogleCalendarSummary | null>((item) => {
      const id = String(item.id ?? "").trim();
      if (!id) return null;
      return {
        id,
        summary: String(item.summary ?? "Sin nombre").trim() || "Sin nombre",
        primary: Boolean(item.primary),
        accessRole: String(item.accessRole ?? "").trim() || null,
      };
    })
    .filter((item): item is GoogleCalendarSummary => Boolean(item));
}

async function listGoogleCalendarEvents(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  calendarId: string;
  calendarSummary: string;
  timeMin: string;
  timeMax: string;
}) {
  const searchParams = new URLSearchParams({
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  const response = await googleApiFetch(
    `/calendar/v3/calendars/${encodeURIComponent(
      params.calendarId,
    )}/events?${searchParams.toString()}`,
    { method: "GET" },
    params.connection,
  );
  const result = (await response.json()) as {
    items?: Array<{
      id?: string;
      summary?: string;
      description?: string;
      status?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };

  return (result.items ?? [])
    .map<GoogleCalendarEventSummary | null>((item) => {
      const id = String(item.id ?? "").trim();
      if (!id) return null;
      return {
        id,
        summary: String(item.summary ?? "Evento sin título").trim() || "Evento sin título",
        description: String(item.description ?? "").trim() || null,
        start:
          String(item.start?.dateTime ?? item.start?.date ?? "").trim() || null,
        end: String(item.end?.dateTime ?? item.end?.date ?? "").trim() || null,
        status: String(item.status ?? "").trim() || null,
        htmlLink: String(item.htmlLink ?? "").trim() || null,
        calendarId: params.calendarId,
        calendarSummary: params.calendarSummary,
      };
    })
    .filter((item): item is GoogleCalendarEventSummary => Boolean(item));
}

export async function getAgendaGooglePreview(params: {
  userId: string;
  calendarId?: string | null;
  tasklistId?: string | null;
  month?: string | null;
}) {
  const [connection, preference] = await Promise.all([
    getGoogleConnectionForUserOrThrow(params.userId),
    prisma.agendaSyncPreference.findUnique({ where: { userId: params.userId } }),
  ]);

  const scopes = Array.isArray(connection.scopes)
    ? connection.scopes.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const tasksEnabled = scopeListIncludes(scopes, GOOGLE_TASKS_SCOPES);
  const calendarsEnabled = scopeListIncludes(scopes, GOOGLE_CALENDAR_SCOPES);
  const calendarListsEnabled = scopeListIncludes(scopes, GOOGLE_CALENDAR_LIST_SCOPES);

  const monthBase = String(params.month ?? "").trim();
  const visibleMonth = /^\d{4}-\d{2}$/.test(monthBase)
    ? new Date(`${monthBase}-01T00:00:00.000Z`)
    : new Date();
  const windowStart = new Date(
    Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), 1, 0, 0, 0),
  );
  const windowEnd = new Date(
    Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth() + 1, 1, 0, 0, 0),
  );

  const tasklists = tasksEnabled ? await listGoogleTasklists(connection) : [];
  const resolvedTasklistId =
    String(params.tasklistId ?? "").trim() ||
    preference?.tasklistId?.trim() ||
    tasklists[0]?.id ||
    "@default";
  const resolvedTasklist =
    tasklists.find((tasklist) => tasklist.id === resolvedTasklistId) ?? null;
  const tasks =
    tasksEnabled && resolvedTasklistId
      ? await listGoogleTasks({
          connection,
          tasklistId: resolvedTasklistId,
          tasklistTitle: resolvedTasklist?.title ?? "Predeterminada",
        })
      : [];

  const calendars = calendarsEnabled
    ? calendarListsEnabled
      ? await listGoogleCalendars(connection)
      : [
          {
            id: preference?.calendarId?.trim() || "primary",
            summary:
              preference?.calendarId?.trim() === "primary"
                ? "Principal"
                : preference?.calendarId?.trim() || "Principal",
            primary: true,
            accessRole: null,
          } satisfies GoogleCalendarSummary,
        ]
    : [];
  const resolvedCalendarId =
    String(params.calendarId ?? "").trim() ||
    preference?.calendarId?.trim() ||
    calendars[0]?.id ||
    "primary";
  const resolvedCalendar =
    calendars.find((calendar) => calendar.id === resolvedCalendarId) ?? null;
  const events =
    calendarsEnabled && resolvedCalendarId
      ? await listGoogleCalendarEvents({
          connection,
          calendarId: resolvedCalendarId,
          calendarSummary: resolvedCalendar?.summary ?? "Principal",
          timeMin: windowStart.toISOString(),
          timeMax: windowEnd.toISOString(),
        })
      : [];

  return {
    tasklists,
    tasks,
    calendars,
    events,
    selectedTasklistId: resolvedTasklistId,
    selectedCalendarId: resolvedCalendarId,
    visibleMonth: `${windowStart.getUTCFullYear()}-${String(
      windowStart.getUTCMonth() + 1,
    ).padStart(2, "0")}`,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    capabilities: {
      tasksEnabled,
      calendarsEnabled,
      calendarListsEnabled,
    },
  };
}

function pickPrimaryPersonField<T extends { metadata?: { primary?: boolean } | null }>(
  values: T[] | null | undefined,
) {
  const rows = values ?? [];
  return rows.find((item) => Boolean(item.metadata?.primary)) ?? rows[0] ?? null;
}

export async function listGoogleContactsPreview(params: {
  userId: string;
  query?: string | null;
}) {
  const connection = await getGoogleConnectionForUserOrThrow(params.userId);
  const response = await googleApiFetch(
    "/people/v1/people/me/connections?pageSize=500&personFields=names,emailAddresses,phoneNumbers,organizations,photos,metadata",
    { method: "GET" },
    connection,
  );
  const result = (await response.json()) as {
    connections?: Array<{
      resourceName?: string;
      etag?: string;
      names?: Array<{ displayName?: string; metadata?: { primary?: boolean } }>;
      emailAddresses?: Array<{ value?: string; metadata?: { primary?: boolean } }>;
      phoneNumbers?: Array<{ value?: string; metadata?: { primary?: boolean } }>;
      organizations?: Array<{
        name?: string;
        title?: string;
        metadata?: { primary?: boolean };
      }>;
      photos?: Array<{ url?: string; metadata?: { primary?: boolean } }>;
      metadata?: {
        sources?: Array<{
          updateTime?: string;
        }>;
      };
    }>;
  };

  const contacts = (result.connections ?? [])
    .map<GoogleContactPreview | null>((person) => {
      const resourceName = String(person.resourceName ?? "").trim();
      if (!resourceName) return null;

      const name = pickPrimaryPersonField(person.names);
      const phone = pickPrimaryPersonField(person.phoneNumbers);
      const email = pickPrimaryPersonField(person.emailAddresses);
      const organization = pickPrimaryPersonField(person.organizations);
      const photo = pickPrimaryPersonField(person.photos);

      return {
        resourceName,
        etag: String(person.etag ?? "").trim() || null,
        displayName:
          String(name?.displayName ?? "").trim() ||
          String(phone?.value ?? "").trim() ||
          "Sin nombre",
        primaryPhone: String(phone?.value ?? "").trim() || null,
        normalizedPhone: normalizeGooglePhone(String(phone?.value ?? "")) || null,
        primaryEmail: String(email?.value ?? "").trim() || null,
        organization: String(organization?.name ?? "").trim() || null,
        title: String(organization?.title ?? "").trim() || null,
        photoUrl: String(photo?.url ?? "").trim() || null,
        updatedAt:
          String(person.metadata?.sources?.[0]?.updateTime ?? "").trim() || null,
      };
    })
    .filter((contact): contact is GoogleContactPreview => Boolean(contact));

  const normalizedQuery = String(params.query ?? "").trim().toLowerCase();
  if (!normalizedQuery) {
    return contacts;
  }

  return contacts.filter((contact) =>
    [
      contact.displayName,
      contact.primaryPhone ?? "",
      contact.primaryEmail ?? "",
      contact.organization ?? "",
      contact.title ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery),
  );
}

async function ensureGoogleSpreadsheetTarget(params: {
  userId: string;
  connection: NonNullable<GoogleConnectionRecord>;
  preference: Awaited<ReturnType<typeof prisma.agendaSyncPreference.findUnique>>;
  title?: string;
  initialSheets?: Array<{ title: string; sheetId?: number | null }>;
}) {
  const currentSpreadsheetId = params.preference?.spreadsheetId?.trim();
  if (currentSpreadsheetId) {
    return {
      spreadsheetId: currentSpreadsheetId,
      created: false,
    };
  }

  const response = await googleApiFetch(
    "/sheets/v4/spreadsheets",
    {
      method: "POST",
      body: JSON.stringify({
        properties: {
          title: params.title ?? "ReCalc Workspace",
        },
        sheets: (
          params.initialSheets?.length
            ? params.initialSheets
            : [
                { title: params.preference?.worksheetName?.trim() || "Agenda" },
                { title: GOOGLE_CONTACTS_SHEET_NAME },
              ]
        ).map((sheet) => ({
          properties: {
            title: sheet.title,
            ...(Number.isInteger(sheet.sheetId) ? { sheetId: sheet.sheetId } : {}),
          },
        })),
      }),
    },
    params.connection,
  );

  const result = (await response.json()) as { spreadsheetId?: string };
  const spreadsheetId = String(result.spreadsheetId ?? "").trim();
  if (!spreadsheetId) {
    throw new Error("Google Sheets no devolvió un spreadsheetId válido.");
  }

  await prisma.agendaSyncPreference.upsert({
    where: { userId: params.userId },
    update: {
      spreadsheetId,
      worksheetName: params.preference?.worksheetName?.trim() || "Agenda",
    },
    create: {
      userId: params.userId,
      syncSheetsEnabled: true,
      spreadsheetId,
      worksheetName: "Agenda",
      googleConnectionId: params.connection.id,
    },
  });

  return {
    spreadsheetId,
    created: true,
  };
}

type GoogleWorksheetProperty = {
  sheetId: number;
  title: string;
};

async function getGoogleWorksheetProperties(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  spreadsheetId: string;
}) {
  const response = await googleApiFetch(
    `/sheets/v4/spreadsheets/${encodeURIComponent(params.spreadsheetId)}?fields=sheets.properties(sheetId,title)`,
    { method: "GET" },
    params.connection,
  );
  const result = (await response.json()) as {
    sheets?: Array<{ properties?: { sheetId?: number | null; title?: string | null } }>;
  };

  return (result.sheets ?? [])
    .map((sheet) => ({
      sheetId: Number(sheet.properties?.sheetId),
      title: String(sheet.properties?.title ?? "").trim(),
    }))
    .filter((sheet): sheet is GoogleWorksheetProperty =>
      Number.isInteger(sheet.sheetId) && Boolean(sheet.title),
    );
}

async function ensureGoogleWorksheet(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  spreadsheetId: string;
  sheetName: string;
  sheetId?: number | null;
}) {
  const sheets = await getGoogleWorksheetProperties({
    connection: params.connection,
    spreadsheetId: params.spreadsheetId,
  });

  const existing = sheets.find(
    (sheet) => sheet.title === params.sheetName,
  );

  if (existing) return existing;

  const requestedSheetId =
    Number.isInteger(params.sheetId) &&
    !sheets.some((sheet) => sheet.sheetId === params.sheetId)
      ? params.sheetId
      : undefined;

  await googleApiFetch(
    `/sheets/v4/spreadsheets/${encodeURIComponent(params.spreadsheetId)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: params.sheetName,
                ...(requestedSheetId === undefined ? {} : { sheetId: requestedSheetId }),
              },
            },
          },
        ],
      }),
    },
    params.connection,
  );

  const updatedSheets = await getGoogleWorksheetProperties({
    connection: params.connection,
    spreadsheetId: params.spreadsheetId,
  });
  return (
    updatedSheets.find((sheet) => sheet.title === params.sheetName) ?? {
      sheetId: requestedSheetId ?? -1,
      title: params.sheetName,
    }
  );
}

async function replaceGoogleSheetValues(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  spreadsheetId: string;
  sheetName: string;
  values: ProspectSheetValue[][];
}) {
  const sheetName = `'${params.sheetName.replace(/'/g, "''")}'`;
  await googleApiFetch(
    `/sheets/v4/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values/${encodeURIComponent(
      `${sheetName}!A:Z`,
    )}:clear`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    params.connection,
  );

  await googleApiFetch(
    `/sheets/v4/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values/${encodeURIComponent(
      `${sheetName}!A1`,
    )}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({
        values: params.values,
      }),
    },
    params.connection,
  );
}

function googleSheetRange(sheetName: string, range: string) {
  return `'${sheetName.replace(/'/g, "''")}'!${range}`;
}

async function getGoogleSheetValues(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  spreadsheetId: string;
  sheetName: string;
  range?: string;
}) {
  const response = await googleApiFetch(
    `/sheets/v4/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values/${encodeURIComponent(
      googleSheetRange(params.sheetName, params.range ?? "A:Z"),
    )}`,
    { method: "GET" },
    params.connection,
  );
  const result = (await response.json()) as { values?: ProspectSheetValue[][] };
  return result.values ?? [];
}

async function putGoogleSheetValues(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  spreadsheetId: string;
  sheetName: string;
  range: string;
  values: ProspectSheetValue[][];
}) {
  await googleApiFetch(
    `/sheets/v4/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values/${encodeURIComponent(
      googleSheetRange(params.sheetName, params.range),
    )}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({ values: params.values }),
    },
    params.connection,
  );
}

async function appendGoogleSheetRow(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  spreadsheetId: string;
  sheetName: string;
  values: ProspectSheetValue[];
}) {
  await googleApiFetch(
    `/sheets/v4/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values/${encodeURIComponent(
      googleSheetRange(params.sheetName, "A1"),
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: [params.values] }),
    },
    params.connection,
  );
}

async function ensureGoogleSheetHeaders(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  spreadsheetId: string;
  sheetName: string;
  headers: readonly ProspectSheetValue[];
}) {
  const values = await getGoogleSheetValues({
    connection: params.connection,
    spreadsheetId: params.spreadsheetId,
    sheetName: params.sheetName,
    range: "A1:Z1",
  });

  if (values[0]?.some((value) => String(value ?? "").trim())) return;

  await putGoogleSheetValues({
    connection: params.connection,
    spreadsheetId: params.spreadsheetId,
    sheetName: params.sheetName,
    range: "A1",
    values: [[...params.headers]],
  });
}

function prospectSheetId(sheetName: ProspectTrackingSheetName) {
  const definition = PROSPECT_TRACKING_SHEETS.find((sheet) => sheet.sheetName === sheetName);
  const sheetId = Number(definition?.gid);
  return Number.isInteger(sheetId) ? sheetId : null;
}

function buildProspectInitialSheets() {
  return PROSPECT_TRACKING_WORKBOOK_SHEET_NAMES.map((sheetName) => ({
    title: sheetName,
    sheetId: prospectSheetId(sheetName),
  }));
}

function googleColorFromHex(hex: string) {
  const normalized = hex.replace(/^#/, "");
  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) {
    return { red: 0, green: 0, blue: 0 };
  }

  return {
    red: ((value >> 16) & 255) / 255,
    green: ((value >> 8) & 255) / 255,
    blue: (value & 255) / 255,
  };
}

async function ensureProspectWorksheets(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  spreadsheetId: string;
  sheets: ProspectGeneratedSheet[];
}) {
  const properties = new Map<string, GoogleWorksheetProperty>();

  for (const sheet of params.sheets) {
    const property = await ensureGoogleWorksheet({
      connection: params.connection,
      spreadsheetId: params.spreadsheetId,
      sheetName: sheet.name,
      sheetId: prospectSheetId(sheet.name),
    });
    properties.set(sheet.name, property);
  }

  return properties;
}

async function applyProspectSheetLayout(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  spreadsheetId: string;
  sheets: ProspectGeneratedSheet[];
  propertiesByTitle: Map<string, GoogleWorksheetProperty>;
}) {
  const headerBackgroundColor = googleColorFromHex(
    PROSPECT_TRACKING_HEADER_STYLE.backgroundColor,
  );
  const headerForegroundColor = googleColorFromHex(
    PROSPECT_TRACKING_HEADER_STYLE.foregroundColor,
  );
  const requests: Array<Record<string, unknown>> = [];

  for (const sheet of params.sheets) {
    const property = params.propertiesByTitle.get(sheet.name);
    if (!property || property.sheetId < 0) continue;

    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: property.sheetId,
          gridProperties: {
            frozenRowCount: sheet.frozenRowCount,
          },
        },
        fields: "gridProperties.frozenRowCount",
      },
    });

    sheet.columnWidths.forEach((pixelSize, index) => {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: property.sheetId,
            dimension: "COLUMNS",
            startIndex: index,
            endIndex: index + 1,
          },
          properties: { pixelSize },
          fields: "pixelSize",
        },
      });
    });

    requests.push({
      repeatCell: {
        range: {
          sheetId: property.sheetId,
          startRowIndex: 0,
          endRowIndex: Math.max(sheet.values.length, 1),
          startColumnIndex: 0,
          endColumnIndex: sheet.columnCount,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: "WRAP",
            verticalAlignment: "TOP",
          },
        },
        fields: "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment",
      },
    });

    sheet.headerRowIndexes.forEach((rowIndex) => {
      requests.push({
        repeatCell: {
          range: {
            sheetId: property.sheetId,
            startRowIndex: rowIndex,
            endRowIndex: rowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: sheet.columnCount,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: headerBackgroundColor,
              horizontalAlignment: "CENTER",
              textFormat: {
                foregroundColor: headerForegroundColor,
                bold: PROSPECT_TRACKING_HEADER_STYLE.bold,
              },
            },
          },
          fields:
            "userEnteredFormat.backgroundColor,userEnteredFormat.horizontalAlignment,userEnteredFormat.textFormat",
        },
      });
    });

    if (sheet.name !== "Metadatos") {
      requests.push({
        setBasicFilter: {
          filter: {
            range: {
              sheetId: property.sheetId,
              startRowIndex: 0,
              endRowIndex: Math.max(sheet.values.length, 1),
              startColumnIndex: 0,
              endColumnIndex: sheet.columnCount,
            },
          },
        },
      });
    }
  }

  if (!requests.length) return;

  await googleApiFetch(
    `/sheets/v4/spreadsheets/${encodeURIComponent(params.spreadsheetId)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({ requests }),
    },
    params.connection,
  );
}

async function syncAgendaItemToTasks(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  preference: Awaited<ReturnType<typeof prisma.agendaSyncPreference.findUnique>>;
  item: Awaited<ReturnType<typeof prisma.userAgendaItem.findMany>>[number];
  existingSync: Awaited<ReturnType<typeof prisma.agendaExternalSync.findMany>>[number] | undefined;
}) {
  const tasklistId = params.preference?.tasklistId?.trim() || "@default";
  const payload = {
    title: params.item.title,
    notes: params.item.notes ?? undefined,
    due: params.item.dueAt?.toISOString(),
    status: params.item.status === "hecho" ? "completed" : "needsAction",
  };

  const path = params.existingSync
    ? `/tasks/v1/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(params.existingSync.externalId)}`
    : `/tasks/v1/lists/${encodeURIComponent(tasklistId)}/tasks`;
  const method = params.existingSync ? "PATCH" : "POST";
  const response = await googleApiFetch(
    path,
    {
      method,
      body: JSON.stringify(payload),
    },
    params.connection,
  );
  const result = (await response.json()) as { id?: string };
  if (!result.id) {
    throw new Error("Google Tasks no devolvió un id válido.");
  }
  return result.id;
}

async function deleteAgendaItemFromTasks(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  preference: Awaited<ReturnType<typeof prisma.agendaSyncPreference.findUnique>>;
  externalId: string;
}) {
  const tasklistId = params.preference?.tasklistId?.trim() || "@default";
  try {
    await googleApiFetch(
      `/tasks/v1/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(
        params.externalId,
      )}`,
      { method: "DELETE" },
      params.connection,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("no encontró el recurso solicitado")) {
      return;
    }
    throw error;
  }
}

async function syncAgendaItemToCalendar(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  preference: Awaited<ReturnType<typeof prisma.agendaSyncPreference.findUnique>>;
  item: Awaited<ReturnType<typeof prisma.userAgendaItem.findMany>>[number];
  existingSync: Awaited<ReturnType<typeof prisma.agendaExternalSync.findMany>>[number] | undefined;
}) {
  const calendarId = params.preference?.calendarId?.trim() || "primary";
  const startIso = params.item.dueAt?.toISOString() ?? new Date().toISOString();
  const endIso = params.item.dueAt
    ? new Date(params.item.dueAt.getTime() + 30 * 60 * 1000).toISOString()
    : new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const payload = {
    summary: params.item.title,
    description: params.item.notes ?? undefined,
    start: { dateTime: startIso },
    end: { dateTime: endIso },
    status: params.item.status === "cancelado" ? "cancelled" : "confirmed",
  };

  const path = params.existingSync
    ? `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(params.existingSync.externalId)}`
    : `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const method = params.existingSync ? "PATCH" : "POST";
  const response = await googleApiFetch(
    path,
    {
      method,
      body: JSON.stringify(payload),
    },
    params.connection,
  );
  const result = (await response.json()) as { id?: string };
  if (!result.id) {
    throw new Error("Google Calendar no devolvió un id válido.");
  }
  return result.id;
}

async function deleteAgendaItemFromCalendar(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  preference: Awaited<ReturnType<typeof prisma.agendaSyncPreference.findUnique>>;
  externalId: string;
}) {
  const calendarId = params.preference?.calendarId?.trim() || "primary";
  try {
    await googleApiFetch(
      `/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events/${encodeURIComponent(params.externalId)}`,
      { method: "DELETE" },
      params.connection,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("no encontró el recurso solicitado")) {
      return;
    }
    throw error;
  }
}

function shouldSyncAgendaItemToCalendar(
  item: Awaited<ReturnType<typeof prisma.userAgendaItem.findMany>>[number],
) {
  // Legacy enum preserved for compatibility:
  // "pago" is now treated as a calendar event in the UI.
  return item.type === "pago";
}

function shouldSyncAgendaItemToTasks(
  item: Awaited<ReturnType<typeof prisma.userAgendaItem.findMany>>[number],
) {
  return !shouldSyncAgendaItemToCalendar(item);
}

async function syncAgendaItemsToSheets(params: {
  connection: NonNullable<GoogleConnectionRecord>;
  preference: Awaited<ReturnType<typeof prisma.agendaSyncPreference.findUnique>>;
  items: Awaited<ReturnType<typeof prisma.userAgendaItem.findMany>>;
  userId: string;
}) {
  const { spreadsheetId } = await ensureGoogleSpreadsheetTarget({
    userId: params.userId,
    connection: params.connection,
    preference: params.preference,
  });
  const sheetName = params.preference?.worksheetName?.trim() || "Agenda";
  await ensureGoogleWorksheet({
    connection: params.connection,
    spreadsheetId,
    sheetName,
  });
  const values = params.items.map((item) => [
    item.id,
    item.type,
    item.status,
    item.title,
    item.notes ?? "",
    item.dueAt?.toISOString() ?? "",
    item.updatedAt.toISOString(),
  ]);

  await replaceGoogleSheetValues({
    connection: params.connection,
    spreadsheetId,
    sheetName,
    values: [
      ["id", "tipo", "estatus", "titulo", "notas", "fecha_objetivo", "actualizado_en"],
      ...values,
    ],
  });
}

export async function syncAgendaToGoogle(userId: string) {
  const [connection, preference, items, syncRows] = await Promise.all([
    prisma.userGoogleConnection.findUnique({ where: { userId } }),
    prisma.agendaSyncPreference.findUnique({ where: { userId } }),
    prisma.userAgendaItem.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.agendaExternalSync.findMany({
      where: {
        agendaItem: {
          userId,
        },
      },
    }),
  ]);

  if (!connection || connection.status !== "connected") {
    throw new Error("No existe una conexión Google activa para este usuario.");
  }

  if (!preference) {
    throw new Error("Configura primero las preferencias de sincronización de agenda.");
  }

  const syncByKey = new Map(
    syncRows.map((row) => [`${row.agendaItemId}:${row.targetKind}`, row]),
  );

  for (const item of items) {
    const existingTaskSync = syncByKey.get(`${item.id}:tasks`);
    if (preference.syncTasksEnabled && shouldSyncAgendaItemToTasks(item)) {
      const externalId = await syncAgendaItemToTasks({
        connection,
        preference,
        item,
        existingSync: existingTaskSync,
      });

      await prisma.agendaExternalSync.upsert({
        where: {
          agendaItemId_provider_targetKind: {
            agendaItemId: item.id,
            provider: "google",
            targetKind: "tasks",
          },
        },
        update: {
          externalId,
          syncedAt: new Date(),
        },
        create: {
          agendaItemId: item.id,
          provider: "google",
          targetKind: "tasks",
          externalId,
        },
      });
    } else if (existingTaskSync) {
      await deleteAgendaItemFromTasks({
        connection,
        preference,
        externalId: existingTaskSync.externalId,
      });
      await prisma.agendaExternalSync.delete({
        where: {
          agendaItemId_provider_targetKind: {
            agendaItemId: item.id,
            provider: "google",
            targetKind: "tasks",
          },
        },
      });
    }

    const existingCalendarSync = syncByKey.get(`${item.id}:calendar`);
    if (preference.syncCalendarEnabled && shouldSyncAgendaItemToCalendar(item)) {
      const externalId = await syncAgendaItemToCalendar({
        connection,
        preference,
        item,
        existingSync: existingCalendarSync,
      });

      await prisma.agendaExternalSync.upsert({
        where: {
          agendaItemId_provider_targetKind: {
            agendaItemId: item.id,
            provider: "google",
            targetKind: "calendar",
          },
        },
        update: {
          externalId,
          syncedAt: new Date(),
        },
        create: {
          agendaItemId: item.id,
          provider: "google",
          targetKind: "calendar",
          externalId,
        },
      });
    } else if (existingCalendarSync) {
      await deleteAgendaItemFromCalendar({
        connection,
        preference,
        externalId: existingCalendarSync.externalId,
      });
      await prisma.agendaExternalSync.delete({
        where: {
          agendaItemId_provider_targetKind: {
            agendaItemId: item.id,
            provider: "google",
            targetKind: "calendar",
          },
        },
      });
    }
  }

  if (preference.syncSheetsEnabled) {
    await syncAgendaItemsToSheets({
      connection,
      preference,
      items,
      userId,
    });
  }

  await prisma.$transaction([
    prisma.agendaSyncPreference.update({
      where: { userId },
      data: { lastSyncedAt: new Date() },
    }),
    prisma.userGoogleConnection.update({
      where: { userId },
      data: { lastSyncError: null },
    }),
  ]);

  await writeBusinessEventSafe({
    type: "EXTENSION_RUN_EVENT",
    userId,
    subjectType: "agenda_sync",
    subjectId: userId,
    metadata: {
      eventType: "google_agenda_synced",
      itemCount: items.length,
      calendar: preference.syncCalendarEnabled,
      tasks: preference.syncTasksEnabled,
      sheets: preference.syncSheetsEnabled,
    },
  });

  return {
    ok: true as const,
    itemCount: items.length,
    syncCalendarEnabled: preference.syncCalendarEnabled,
    syncTasksEnabled: preference.syncTasksEnabled,
    syncSheetsEnabled: preference.syncSheetsEnabled,
  };
}

export async function removeAgendaItemFromGoogle(params: {
  userId: string;
  agendaItemId: string;
}) {
  const [connection, preference, syncRows] = await Promise.all([
    prisma.userGoogleConnection.findUnique({ where: { userId: params.userId } }),
    prisma.agendaSyncPreference.findUnique({ where: { userId: params.userId } }),
    prisma.agendaExternalSync.findMany({
      where: {
        agendaItemId: params.agendaItemId,
      },
    }),
  ]);

  if (!connection || connection.status !== "connected" || !preference || !syncRows.length) {
    return {
      ok: true as const,
      removedCount: 0,
    };
  }

  try {
    for (const row of syncRows) {
      if (row.targetKind === "tasks") {
        await deleteAgendaItemFromTasks({
          connection,
          preference,
          externalId: row.externalId,
        });
      }

      if (row.targetKind === "calendar") {
        await deleteAgendaItemFromCalendar({
          connection,
          preference,
          externalId: row.externalId,
        });
      }
    }

    await prisma.agendaExternalSync.deleteMany({
      where: {
        agendaItemId: params.agendaItemId,
      },
    });

    await prisma.userGoogleConnection.update({
      where: { userId: params.userId },
      data: { lastSyncError: null },
    });
  } catch (error) {
    await prisma.userGoogleConnection.update({
      where: { userId: params.userId },
      data: {
        lastSyncError:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "No se pudo eliminar el registro remoto de Google.",
      },
    });
  }

  return {
    ok: true as const,
    removedCount: syncRows.length,
  };
}

export async function syncMatriculaContactToGoogleSheet(params: {
  userId: string;
  contact: MatriculaContactSheetInput;
}): Promise<MatriculaContactSheetSyncResult> {
  const [connection, preference] = await Promise.all([
    prisma.userGoogleConnection.findUnique({ where: { userId: params.userId } }),
    prisma.agendaSyncPreference.findUnique({ where: { userId: params.userId } }),
  ]);

  if (!connection || connection.status !== "connected") {
    return { ok: false as const, skipped: "google_not_connected" };
  }

  const scopes = Array.isArray(connection.scopes)
    ? connection.scopes.map((scope) => String(scope ?? "").trim()).filter(Boolean)
    : [];

  if (!connection.sheetsConnected && !scopeListIncludes(scopes, GOOGLE_SHEETS_SCOPES)) {
    return { ok: false as const, skipped: "sheets_not_connected" };
  }

  if (!preference?.syncSheetsEnabled) {
    return { ok: false as const, skipped: "sheets_sync_disabled" };
  }

  try {
    const { spreadsheetId } = await ensureGoogleSpreadsheetTarget({
      userId: params.userId,
      connection,
      preference,
      title: PROSPECT_TRACKING_SPREADSHEET_TITLE,
      initialSheets: buildProspectInitialSheets(),
    });

    await ensureGoogleWorksheet({
      connection,
      spreadsheetId,
      sheetName: GOOGLE_CONTACTS_SHEET_NAME,
      sheetId: prospectSheetId(GOOGLE_CONTACTS_SHEET_NAME),
    });
    await ensureGoogleWorksheet({
      connection,
      spreadsheetId,
      sheetName: MATRICULA_CONTACT_CREATION_SHEET_NAME,
    });
    await ensureGoogleWorksheet({
      connection,
      spreadsheetId,
      sheetName: MATRICULA_CONTACT_UPDATE_SHEET_NAME,
    });

    await ensureGoogleSheetHeaders({
      connection,
      spreadsheetId,
      sheetName: GOOGLE_CONTACTS_SHEET_NAME,
      headers: MATRICULA_CONTACT_HEADERS,
    });
    await ensureGoogleSheetHeaders({
      connection,
      spreadsheetId,
      sheetName: MATRICULA_CONTACT_CREATION_SHEET_NAME,
      headers: MATRICULA_CONTACT_AUDIT_HEADERS,
    });
    await ensureGoogleSheetHeaders({
      connection,
      spreadsheetId,
      sheetName: MATRICULA_CONTACT_UPDATE_SHEET_NAME,
      headers: MATRICULA_CONTACT_AUDIT_HEADERS,
    });

    const contactValues = await getGoogleSheetValues({
      connection,
      spreadsheetId,
      sheetName: GOOGLE_CONTACTS_SHEET_NAME,
    });
    const match = findMatriculaContactRowIndex(contactValues, params.contact);
    const contactRow = buildMatriculaContactRow(params.contact);

    if (match) {
      await putGoogleSheetValues({
        connection,
        spreadsheetId,
        sheetName: GOOGLE_CONTACTS_SHEET_NAME,
        range: `A${match.rowIndex}`,
        values: [contactRow],
      });
      await appendGoogleSheetRow({
        connection,
        spreadsheetId,
        sheetName: MATRICULA_CONTACT_UPDATE_SHEET_NAME,
        values: buildMatriculaContactAuditRow("updated", params.contact),
      });
      await prisma.userGoogleConnection.update({
        where: { userId: params.userId },
        data: { lastSyncError: null },
      });
      await prisma.agendaSyncPreference.update({
        where: { userId: params.userId },
        data: { lastSyncedAt: new Date() },
      });

      return {
        ok: true as const,
        action: "updated",
        spreadsheetId,
        sheetName: GOOGLE_CONTACTS_SHEET_NAME,
        matchedBy: match.matchedBy,
      };
    }

    await appendGoogleSheetRow({
      connection,
      spreadsheetId,
      sheetName: GOOGLE_CONTACTS_SHEET_NAME,
      values: contactRow,
    });
    await appendGoogleSheetRow({
      connection,
      spreadsheetId,
      sheetName: MATRICULA_CONTACT_CREATION_SHEET_NAME,
      values: buildMatriculaContactAuditRow("created", params.contact),
    });
    await prisma.userGoogleConnection.update({
      where: { userId: params.userId },
      data: { lastSyncError: null },
    });
    await prisma.agendaSyncPreference.update({
      where: { userId: params.userId },
      data: { lastSyncedAt: new Date() },
    });

    return {
      ok: true as const,
      action: "created",
      spreadsheetId,
      sheetName: GOOGLE_CONTACTS_SHEET_NAME,
    };
  } catch (error) {
    await prisma.userGoogleConnection.update({
      where: { userId: params.userId },
      data: {
        lastSyncError:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "No se pudo sincronizar la matrícula con Google Sheets.",
      },
    });

    throw error;
  }
}

export async function syncContactsSnapshotToGoogle(params: {
  userId: string;
  contacts: GoogleContactsSyncRow[];
}) {
  const [connection, preference, user, campaigns] = await Promise.all([
    prisma.userGoogleConnection.findUnique({ where: { userId: params.userId } }),
    prisma.agendaSyncPreference.findUnique({ where: { userId: params.userId } }),
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true },
    }),
    prisma.extensionCampaign.findMany({
      where: { ownerUserId: params.userId },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        campaignName: true,
        channel: true,
        status: true,
        scheduleAt: true,
        batchSize: true,
        messageDelayMs: true,
        messageTemplate: true,
        notes: true,
        updatedAt: true,
        recipients: {
          select: {
            contactValue: true,
            contactName: true,
            status: true,
            updatedAt: true,
          },
        },
      },
    }),
  ]);

  if (!connection || connection.status !== "connected") {
    return { ok: false as const, skipped: "google_not_connected" };
  }

  if (!preference?.syncSheetsEnabled) {
    return { ok: false as const, skipped: "sheets_sync_disabled" };
  }

  const syncedAt = new Date();

  try {
    const { spreadsheetId } = await ensureGoogleSpreadsheetTarget({
      userId: params.userId,
      connection,
      preference,
      title: PROSPECT_TRACKING_SPREADSHEET_TITLE,
      initialSheets: buildProspectInitialSheets(),
    });

    const prospectSheets = buildProspectTrackingSheets({
      contacts: params.contacts,
      campaigns: campaigns.map(
        (campaign): ProspectCampaignSyncRow => ({
          id: campaign.id,
          campaignName: campaign.campaignName,
          channel: campaign.channel,
          status: campaign.status,
          scheduleAt: campaign.scheduleAt?.toISOString() ?? null,
          batchSize: campaign.batchSize,
          messageDelayMs: campaign.messageDelayMs,
          messageTemplate: campaign.messageTemplate,
          notes: campaign.notes,
          updatedAt: campaign.updatedAt.toISOString(),
          recipients: campaign.recipients.map((recipient) => ({
            contactValue: recipient.contactValue,
            contactName: recipient.contactName,
            status: recipient.status,
            updatedAt: recipient.updatedAt.toISOString(),
          })),
        }),
      ),
      ownerEmail: user?.email ?? null,
      generatedAt: syncedAt.toISOString(),
    });

    const propertiesByTitle = await ensureProspectWorksheets({
      connection,
      spreadsheetId,
      sheets: prospectSheets,
    });

    for (const sheet of prospectSheets) {
      await replaceGoogleSheetValues({
        connection,
        spreadsheetId,
        sheetName: sheet.name,
        values: sheet.values,
      });
    }

    await applyProspectSheetLayout({
      connection,
      spreadsheetId,
      sheets: prospectSheets,
      propertiesByTitle,
    });

    await prisma.userGoogleConnection.update({
      where: { userId: params.userId },
      data: { lastSyncError: null },
    });

    return {
      ok: true as const,
      spreadsheetId,
      sheetName: GOOGLE_CONTACTS_SHEET_NAME,
      syncedAt,
    };
  } catch (error) {
    await prisma.userGoogleConnection.update({
      where: { userId: params.userId },
      data: {
        lastSyncError:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "No se pudo sincronizar contactos con Google Sheets.",
      },
    });

    throw error;
  }
}
