import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";

import { listRecentMetaEmbeddedSignupSessions, type MetaEmbeddedSignupSessionSummary } from "@/lib/meta-embedded-signup";
import { getMetaLegalUrls } from "@/lib/meta-legal";
import { prisma } from "@/lib/prisma";
import {
  recordDirectWhatsappMessageForContact,
  upsertMetaIdentityForUser,
} from "@/lib/user-contacts";

type MetaConnectionRecord = Awaited<
  ReturnType<typeof prisma.userMetaWhatsappConnection.findUnique>
>;

type MetaTokenExchangeResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type GraphResponseError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type GraphListResponse<T> = {
  data?: T[];
  paging?: {
    next?: string;
  };
} & GraphResponseError;

type MetaMessageRecord = Prisma.MetaWhatsappMessageGetPayload<{
  include: { contact: true };
}>;

type MetaMessageEventRecord = Prisma.MetaWhatsappMessageEventGetPayload<{
  include: { contact: true };
}>;

export type MetaConnectionSummary = {
  id: string;
  status: string;
  graphApiVersion: string;
  wabaId: string | null;
  wabaName: string | null;
  phoneNumberId: string | null;
  phoneDisplayNumber: string | null;
  phoneVerifiedName: string | null;
  phoneQualityRating: string | null;
  phoneCodeVerificationStatus: string | null;
  businessAccountId: string | null;
  businessManagerId: string | null;
  businessName: string | null;
  wabaCurrency: string | null;
  wabaTimezoneId: string | null;
  accessTokenExpiresAt: string | null;
  connectedAt: string | null;
  lastAssetSyncAt: string | null;
  lastTemplateSyncAt: string | null;
  lastWebhookAt: string | null;
  lastSyncError: string | null;
  grantedScopes: string[];
  updatedAt: string;
};

export type MetaTemplateSummary = {
  id: string;
  name: string;
  language: string | null;
  status: string | null;
  category: string | null;
  qualityScore: string | null;
  rejectedReason: string | null;
  updatedAt: string | null;
};

export type MetaBusinessProfileSummary = {
  about: string | null;
  address: string | null;
  description: string | null;
  email: string | null;
  profilePictureUrl: string | null;
  websites: string[];
  vertical: string | null;
};

export type MetaMessageSummary = {
  id: string;
  metaMessageId: string | null;
  direction: string;
  messageType: string;
  templateName: string | null;
  templateLanguage: string | null;
  textBody: string | null;
  mediaId: string | null;
  mediaMimeType: string | null;
  mediaCaption: string | null;
  externalStatus: string | null;
  contact: {
    id: string | null;
    contactName: string | null;
    phone: string | null;
    waId: string | null;
    bsuid: string | null;
    whatsappUsername: string | null;
  };
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MetaEventSummary = {
  id: string;
  eventType: string;
  deliveryStatus: string | null;
  metaMessageId: string | null;
  contact: {
    id: string | null;
    contactName: string | null;
    phone: string | null;
    bsuid: string | null;
    whatsappUsername: string | null;
  };
  eventAt: string;
  createdAt: string;
};

export type MetaEmbeddedSignupOverview = {
  legalUrls: {
    cancelAuthorizationUrl: string;
    dataDeletionRequestUrl: string;
    dataDeletionCallbackUrl: string;
  };
  recentSessions: MetaEmbeddedSignupSessionSummary[];
};

export type MetaEnvironmentAudit = {
  requiredServerVariables: string[];
  requiredPublicVariables: string[];
  requiredConversionsVariables: string[];
  optionalVariables: string[];
  missingServerVariables: string[];
  missingPublicVariables: string[];
  missingConversionsVariables: string[];
};

export type MetaOnboardingPhaseStatus = "pending" | "in_progress" | "ready" | "blocked";

export type MetaOnboardingPhase = {
  key: "connect" | "provision" | "validate" | "app_review";
  title: string;
  status: MetaOnboardingPhaseStatus;
  summary: string;
  blockers: string[];
};

export type MetaOnboardingSummary = {
  status: MetaOnboardingPhaseStatus;
  phases: MetaOnboardingPhase[];
  missingPermissions: string[];
};

export type MetaWhatsappOverview = {
  connection: MetaConnectionSummary | null;
  assets: {
    business: { id: string | null; name: string | null } | null;
    waba: {
      id: string | null;
      name: string | null;
      currency: string | null;
      timezoneId: string | null;
    } | null;
    phoneNumber: {
      id: string | null;
      displayPhoneNumber: string | null;
      verifiedName: string | null;
      qualityRating: string | null;
      codeVerificationStatus: string | null;
    } | null;
    businessProfile: MetaBusinessProfileSummary | null;
  };
  templates: MetaTemplateSummary[];
  recentMessages: MetaMessageSummary[];
  recentEvents: MetaEventSummary[];
  embeddedSignup: MetaEmbeddedSignupOverview;
  blockers: string[];
  reviewerNotes: string[];
  capabilities: {
    canLaunchEmbeddedSignup: boolean;
    canSyncAssets: boolean;
    canListTemplates: boolean;
    canSendText: boolean;
    canSendTemplate: boolean;
    canUploadMedia: boolean;
    canSendConversions: boolean;
    canReviewBsuid: boolean;
    canReviewBusinessAssetProfile: boolean;
    businessManagementInScope: boolean;
  };
  environment: MetaEnvironmentAudit;
  onboarding: MetaOnboardingSummary;
};

type MetaSyncResult = {
  business: { id: string | null; name: string | null } | null;
  waba: {
    id: string | null;
    name: string | null;
    currency: string | null;
    timezoneId: string | null;
  } | null;
  phoneNumber: {
    id: string | null;
    displayPhoneNumber: string | null;
    verifiedName: string | null;
    qualityRating: string | null;
    codeVerificationStatus: string | null;
  } | null;
  businessProfile: MetaBusinessProfileSummary | null;
  templates: MetaTemplateSummary[];
  blockers: string[];
  grantedScopes: string[];
};

type MetaSendPayload =
  | { type: "text"; text: string }
  | { type: "template"; templateName: string; language: string; bodyVariables?: string[] }
  | { type: "image" | "document"; mediaId: string; caption?: string | null; filename?: string | null };

type MetaSendParams = {
  userId: string;
  to: string;
  phoneNumberId?: string | null;
  contactName?: string | null;
  waId?: string | null;
  bsuid?: string | null;
  parentBsuid?: string | null;
  whatsappUsername?: string | null;
  profilePictureUrl?: string | null;
  profileSource?: string | null;
  payload: MetaSendPayload;
};

type MetaWebhookIdentity = {
  waId?: string | null;
  bsuid?: string | null;
  parentBsuid?: string | null;
  whatsappUsername?: string | null;
  contactName?: string | null;
  phone?: string | null;
  profilePictureUrl?: string | null;
  profileSource?: string | null;
};

const FALLBACK_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
const DEFAULT_META_APP_ID = "920977560769210";
const DEFAULT_EMBEDDED_SIGNUP_CONFIG_ID = "2191644411673120";
const DEFAULT_WHATSAPP_API_CONFIG_ID = "1593446981941546";

function getMetaEnv() {
  return {
    appId: process.env.META_APP_ID?.trim() ?? DEFAULT_META_APP_ID,
    appSecret: process.env.META_APP_SECRET?.trim() ?? "",
    encryptionSecret: process.env.META_INTEGRATION_SECRET?.trim() ?? "",
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ?? "",
    graphApiVersion: process.env.META_GRAPH_API_VERSION?.trim() ?? FALLBACK_GRAPH_VERSION,
    publicAppId: process.env.NEXT_PUBLIC_META_APP_ID?.trim() ?? DEFAULT_META_APP_ID,
    publicEmbeddedSignupConfigId:
      process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID?.trim() ??
      process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_CONFIG_ID?.trim() ??
      DEFAULT_EMBEDDED_SIGNUP_CONFIG_ID,
    publicWhatsappApiConfigId:
      process.env.NEXT_PUBLIC_WHATSAPP_API_CONFIG_ID?.trim() ?? DEFAULT_WHATSAPP_API_CONFIG_ID,
  };
}

export function getMetaEnvironmentAudit(): MetaEnvironmentAudit {
  const requiredServerVariables = [
    "META_APP_ID",
    "META_APP_SECRET",
    "META_INTEGRATION_SECRET",
  ];
  const requiredPublicVariables = [
    "NEXT_PUBLIC_META_APP_ID",
    "NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID",
    "NEXT_PUBLIC_WHATSAPP_API_CONFIG_ID",
  ];
  const requiredConversionsVariables = [
    "META_CONVERSIONS_DATASET_ID",
    "META_CONVERSIONS_ACCESS_TOKEN",
  ];
  const optionalVariables = [
    "META_GRAPH_API_VERSION",
    "META_WEBHOOK_VERIFY_TOKEN",
    "META_PUBLIC_BASE_URL",
    "META_SUPPORT_EMAIL",
    "META_CONVERSIONS_TEST_EVENT_CODE",
    "NEXT_PUBLIC_WHATSAPP_ES_SESSION_INFO_VERSION",
    "NEXT_PUBLIC_BASE_URL",
  ];

  const missingServerVariables = requiredServerVariables.filter((name) => !process.env[name]?.trim());
  const missingPublicVariables = requiredPublicVariables.filter((name) => !process.env[name]?.trim());
  const missingConversionsVariables = requiredConversionsVariables.filter(
    (name) => !process.env[name]?.trim(),
  );

  return {
    requiredServerVariables,
    requiredPublicVariables,
    requiredConversionsVariables,
    optionalVariables,
    missingServerVariables,
    missingPublicVariables,
    missingConversionsVariables,
  };
}

function getEncryptionKey() {
  const { encryptionSecret } = getMetaEnv();
  if (!encryptionSecret) {
    throw new Error("META_INTEGRATION_SECRET is required to store Meta tokens securely.");
  }

  return createHash("sha256").update(encryptionSecret).digest();
}

function encryptSecret(value: string) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

function decryptSecret(value: string | null | undefined) {
  if (!value) return "";
  const buffer = Buffer.from(value, "base64url");
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function metaGraphUrl(path: string, graphApiVersion = FALLBACK_GRAPH_VERSION) {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `https://graph.facebook.com/${graphApiVersion}/${normalizedPath}`;
}

function formatGraphError(status: number, payload: GraphResponseError | unknown) {
  const casted = payload as GraphResponseError | null;
  const message = casted?.error?.message ?? JSON.stringify(payload ?? {});
  return `Meta Graph error (${status}): ${String(message).slice(0, 400)}`;
}

async function fetchGraphJson<T>(params: {
  path: string;
  accessToken: string;
  graphApiVersion?: string;
  method?: "GET" | "POST";
  searchParams?: URLSearchParams;
  body?: BodyInit | null;
  headers?: Record<string, string>;
}) {
  const url = new URL(metaGraphUrl(params.path, params.graphApiVersion));
  if (params.searchParams) {
    for (const [key, value] of params.searchParams.entries()) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method: params.method ?? "GET",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      ...(params.headers ?? {}),
    },
    body: params.body ?? undefined,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as T & GraphResponseError;
  if (!response.ok) {
    throw new Error(formatGraphError(response.status, payload));
  }

  return payload;
}

async function fetchGraphJsonSafe<T>(params: Parameters<typeof fetchGraphJson<T>>[0]) {
  try {
    const data = await fetchGraphJson<T>(params);
    return { data, error: null as string | null };
  } catch (error) {
    return {
      data: null as T | null,
      error: error instanceof Error ? error.message : "unknown_graph_error",
    };
  }
}

async function exchangeCodeForMetaAccessToken(code: string) {
  const { appId, appSecret, graphApiVersion } = getMetaEnv();
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID and META_APP_SECRET are required to exchange the Meta code.");
  }

  const search = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  });

  const response = await fetch(`${metaGraphUrl("oauth/access_token", graphApiVersion)}?${search.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meta token exchange failed (${response.status}): ${body.slice(0, 400)}`);
  }

  const payload = (await response.json()) as MetaTokenExchangeResponse;
  const accessToken = String(payload.access_token ?? "").trim();
  if (!accessToken) {
    throw new Error("Meta did not return an access token during code exchange.");
  }

  return {
    accessToken,
    expiresIn: Number(payload.expires_in ?? 0) || null,
  };
}

async function getConnectionOrThrow(userId: string) {
  const connection = await prisma.userMetaWhatsappConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new Error("No WABA connection exists for this user yet.");
  }
  return connection;
}

async function ensureValidToken(connection: NonNullable<MetaConnectionRecord>) {
  const token = decryptSecret(connection.encryptedSystemUserToken || connection.encryptedMetaAccessToken);
  if (!token) {
    throw new Error("The WABA connection does not have a reusable access token.");
  }
  return token;
}

async function readGrantedScopes(accessToken: string) {
  const { appId, appSecret, graphApiVersion } = getMetaEnv();
  if (!appId || !appSecret) {
    return [] as string[];
  }

  const searchParams = new URLSearchParams({
    input_token: accessToken,
    access_token: `${appId}|${appSecret}`,
  });

  const response = await fetch(metaGraphUrl("debug_token", graphApiVersion) + `?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: {
      scopes?: string[];
    };
  } | null;

  return toStringArray(payload?.data?.scopes);
}

function mapTemplateSummary(template: Record<string, unknown>): MetaTemplateSummary {
  const qualityScoreRaw = template.quality_score as { score?: string } | string | undefined;
  const qualityScore =
    typeof qualityScoreRaw === "string"
      ? qualityScoreRaw
      : normalizeString(qualityScoreRaw?.score) ?? null;

  return {
    id: normalizeString(template.id) ?? `template-${Math.random().toString(16).slice(2)}`,
    name: normalizeString(template.name) ?? "unnamed-template",
    language: normalizeString(template.language),
    status: normalizeString(template.status),
    category: normalizeString(template.category),
    qualityScore,
    rejectedReason:
      normalizeString(template.rejected_reason) ??
      normalizeString(template.rejection_reason),
    updatedAt: normalizeString(template.updated_time),
  };
}

async function fetchAllTemplates(accessToken: string, wabaId: string, graphApiVersion: string) {
  const templates: MetaTemplateSummary[] = [];
  let nextUrl: string | null = metaGraphUrl(`${wabaId}/message_templates`, graphApiVersion);
  let pageCount = 0;

  while (nextUrl && pageCount < 5) {
    const url = new URL(nextUrl);
    if (!url.searchParams.has("limit")) {
      url.searchParams.set("limit", "100");
    }
    if (!url.searchParams.has("fields")) {
      url.searchParams.set(
        "fields",
        "id,name,status,category,language,quality_score,rejected_reason,updated_time",
      );
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as GraphListResponse<Record<string, unknown>> | null;
    if (!response.ok) {
      throw new Error(formatGraphError(response.status, payload));
    }

    for (const template of payload?.data ?? []) {
      templates.push(mapTemplateSummary(template));
    }

    nextUrl = payload?.paging?.next ?? null;
    pageCount += 1;
  }

  return templates;
}

async function ensureWebhookSubscription(params: {
  accessToken: string;
  graphApiVersion: string;
  wabaId: string;
}) {
  try {
    await fetchGraphJson<Record<string, unknown>>({
      path: `${params.wabaId}/subscribed_apps`,
      accessToken: params.accessToken,
      graphApiVersion: params.graphApiVersion,
      method: "POST",
    });

    return { ok: true, error: null as string | null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "webhook_subscription_failed",
    };
  }
}

async function syncConnectionAssets(connection: NonNullable<MetaConnectionRecord>) {
  const accessToken = await ensureValidToken(connection);
  const graphApiVersion = connection.graphApiVersion || getMetaEnv().graphApiVersion;
  const blockers: string[] = [];
  const subscriptionResultPromise = connection.wabaId
    ? ensureWebhookSubscription({
        accessToken,
        graphApiVersion,
        wabaId: connection.wabaId,
      })
    : Promise.resolve({
        ok: false,
        error: "Missing wabaId for subscribed_apps registration.",
      });

  const grantedScopesPromise = readGrantedScopes(accessToken);
  const businessPromise =
    connection.businessAccountId
      ? fetchGraphJsonSafe<Record<string, unknown>>({
          path: connection.businessAccountId,
          accessToken,
          graphApiVersion,
          searchParams: new URLSearchParams({ fields: "id,name" }),
        })
      : Promise.resolve({ data: null, error: "Missing businessAccountId on the stored connection." });

  const wabaPromise =
    connection.wabaId
      ? fetchGraphJsonSafe<Record<string, unknown>>({
          path: connection.wabaId,
          accessToken,
          graphApiVersion,
          searchParams: new URLSearchParams({ fields: "id,name,currency,timezone_id" }),
        })
      : Promise.resolve({ data: null, error: "Missing wabaId on the stored connection." });

  const phonePromise =
    connection.phoneNumberId
      ? fetchGraphJsonSafe<Record<string, unknown>>({
          path: connection.phoneNumberId,
          accessToken,
          graphApiVersion,
          searchParams: new URLSearchParams({
            fields:
              "id,display_phone_number,verified_name,quality_rating,code_verification_status",
          }),
        })
      : Promise.resolve({ data: null, error: "Missing phoneNumberId on the stored connection." });

  const businessProfilePromise =
    connection.phoneNumberId
      ? fetchGraphJsonSafe<Record<string, unknown>>({
          path: `${connection.phoneNumberId}/whatsapp_business_profile`,
          accessToken,
          graphApiVersion,
          searchParams: new URLSearchParams({
            fields: "about,address,description,email,profile_picture_url,websites,vertical",
          }),
        })
      : Promise.resolve({ data: null, error: "Missing phoneNumberId for business profile lookup." });

  const templatesPromise =
    connection.wabaId
      ? fetchAllTemplates(accessToken, connection.wabaId, graphApiVersion)
          .then((templates) => ({ templates, error: null as string | null }))
          .catch((error) => ({
            templates: [] as MetaTemplateSummary[],
            error: error instanceof Error ? error.message : "template_sync_failed",
          }))
      : Promise.resolve({
          templates: [] as MetaTemplateSummary[],
          error: "Missing wabaId for template listing.",
        });

  const [
    subscriptionResult,
    grantedScopesResolved,
    businessResolved,
    wabaResolved,
    phoneResolved,
    businessProfileResolved,
    templatesResolved,
  ] = await Promise.all([
    subscriptionResultPromise,
    grantedScopesPromise,
    businessPromise,
    wabaPromise,
    phonePromise,
    businessProfilePromise,
    templatesPromise,
  ]);

  if (!subscriptionResult.ok && connection.wabaId) blockers.push(`Webhook subscription: ${subscriptionResult.error}`);
  if (businessResolved.error && connection.businessAccountId) blockers.push(`Business asset sync: ${businessResolved.error}`);
  if (wabaResolved.error && connection.wabaId) blockers.push(`WABA sync: ${wabaResolved.error}`);
  if (phoneResolved.error && connection.phoneNumberId) blockers.push(`Phone number sync: ${phoneResolved.error}`);
  if (businessProfileResolved.error && connection.phoneNumberId) blockers.push(`Business profile sync: ${businessProfileResolved.error}`);
  if (templatesResolved.error && connection.wabaId) blockers.push(`Template listing: ${templatesResolved.error}`);

  const business = {
    id: normalizeString(businessResolved.data?.id) ?? connection.businessAccountId ?? null,
    name: normalizeString(businessResolved.data?.name) ?? connection.businessName ?? null,
  };
  const waba = {
    id: normalizeString(wabaResolved.data?.id) ?? connection.wabaId ?? null,
    name: normalizeString(wabaResolved.data?.name) ?? connection.wabaName ?? null,
    currency: normalizeString(wabaResolved.data?.currency) ?? connection.wabaCurrency ?? null,
    timezoneId:
      normalizeString(wabaResolved.data?.timezone_id) ?? connection.wabaTimezoneId ?? null,
  };
  const phoneNumber = {
    id: normalizeString(phoneResolved.data?.id) ?? connection.phoneNumberId ?? null,
    displayPhoneNumber:
      normalizeString(phoneResolved.data?.display_phone_number) ??
      connection.phoneDisplayNumber ??
      null,
    verifiedName:
      normalizeString(phoneResolved.data?.verified_name) ?? connection.phoneVerifiedName ?? null,
    qualityRating:
      normalizeString(phoneResolved.data?.quality_rating) ??
      connection.phoneQualityRating ??
      null,
    codeVerificationStatus:
      normalizeString(phoneResolved.data?.code_verification_status) ??
      connection.phoneCodeVerificationStatus ??
      null,
  };
  const businessProfile = businessProfileResolved.data
    ? {
        about: normalizeString(businessProfileResolved.data.about),
        address: normalizeString(businessProfileResolved.data.address),
        description: normalizeString(businessProfileResolved.data.description),
        email: normalizeString(businessProfileResolved.data.email),
        profilePictureUrl: normalizeString(businessProfileResolved.data.profile_picture_url),
        websites: toStringArray(businessProfileResolved.data.websites),
        vertical: normalizeString(businessProfileResolved.data.vertical),
      }
    : null;

  const now = new Date();
  await prisma.userMetaWhatsappConnection.update({
    where: { id: connection.id },
    data: {
      graphApiVersion,
      businessName: business.name,
      wabaName: waba.name,
      wabaCurrency: waba.currency,
      wabaTimezoneId: waba.timezoneId,
      phoneDisplayNumber: phoneNumber.displayPhoneNumber,
      phoneVerifiedName: phoneNumber.verifiedName,
      phoneQualityRating: phoneNumber.qualityRating,
      phoneCodeVerificationStatus: phoneNumber.codeVerificationStatus,
      lastAssetSyncAt: now,
      lastTemplateSyncAt: templatesResolved.templates.length ? now : connection.lastTemplateSyncAt,
      lastSyncError: blockers[0] ?? null,
      grantedScopes: grantedScopesResolved,
      accountReviewSnapshot: toJsonValue({
        business,
        waba,
        phoneNumber,
        businessProfile,
        templates: templatesResolved.templates,
        webhookSubscriptionActive: subscriptionResult.ok,
      }),
      status: blockers.length ? "warning" : "connected",
    },
  });

  return {
    business,
    waba,
    phoneNumber,
    businessProfile,
    templates: templatesResolved.templates,
    blockers,
    grantedScopes: grantedScopesResolved,
  } satisfies MetaSyncResult;
}

function serializeConnectionSummary(connection: NonNullable<MetaConnectionRecord>): MetaConnectionSummary {
  return {
    id: connection.id,
    status: connection.status,
    graphApiVersion: connection.graphApiVersion || FALLBACK_GRAPH_VERSION,
    wabaId: connection.wabaId,
    wabaName: connection.wabaName,
    phoneNumberId: connection.phoneNumberId,
    phoneDisplayNumber: connection.phoneDisplayNumber,
    phoneVerifiedName: connection.phoneVerifiedName,
    phoneQualityRating: connection.phoneQualityRating,
    phoneCodeVerificationStatus: connection.phoneCodeVerificationStatus,
    businessAccountId: connection.businessAccountId,
    businessManagerId: connection.businessManagerId,
    businessName: connection.businessName,
    wabaCurrency: connection.wabaCurrency,
    wabaTimezoneId: connection.wabaTimezoneId,
    accessTokenExpiresAt: toIsoString(connection.accessTokenExpiresAt),
    connectedAt: toIsoString(connection.connectedAt),
    lastAssetSyncAt: toIsoString(connection.lastAssetSyncAt),
    lastTemplateSyncAt: toIsoString(connection.lastTemplateSyncAt),
    lastWebhookAt: toIsoString(connection.lastWebhookAt),
    lastSyncError: connection.lastSyncError,
    grantedScopes: toStringArray(connection.grantedScopes),
    updatedAt: connection.updatedAt.toISOString(),
  };
}

function buildOverviewCapabilities(params: {
  connection: MetaConnectionRecord;
  syncResult: MetaSyncResult | null;
  environment: MetaEnvironmentAudit;
}) {
  const connection = params.connection;
  const connectionScopes =
    params.syncResult?.grantedScopes.length
      ? params.syncResult.grantedScopes
      : toStringArray(connection?.grantedScopes);
  const hasConnection = Boolean(connection);
  const canSend = Boolean(hasConnection && (connection?.phoneNumberId || params.syncResult?.phoneNumber?.id));
  const canTemplate = Boolean(hasConnection && (connection?.wabaId || params.syncResult?.waba?.id));
  const canBsuid = Boolean(
    connectionScopes.includes("whatsapp_business_messaging") ||
      connectionScopes.includes("whatsapp_business_management"),
  );

  return {
    canLaunchEmbeddedSignup: params.environment.missingPublicVariables.length === 0,
    canSyncAssets: hasConnection && params.environment.missingServerVariables.length === 0,
    canListTemplates: canTemplate,
    canSendText: canSend,
    canSendTemplate: canSend && canTemplate,
    canUploadMedia: canSend,
    canSendConversions:
      hasConnection && params.environment.missingConversionsVariables.length === 0,
    canReviewBsuid: canBsuid,
    canReviewBusinessAssetProfile: canBsuid,
    businessManagementInScope: false,
  };
}

function serializeRecentMessage(message: MetaMessageRecord): MetaMessageSummary {
  return {
    id: message.id,
    metaMessageId: message.metaMessageId,
    direction: message.direction,
    messageType: message.messageType,
    templateName: message.templateName,
    templateLanguage: message.templateLanguage,
    textBody: message.textBody,
    mediaId: message.mediaId,
    mediaMimeType: message.mediaMimeType,
    mediaCaption: message.mediaCaption,
    externalStatus: message.externalStatus,
    contact: {
      id: message.contact?.id ?? null,
      contactName: message.contact?.contactName ?? null,
      phone: message.contact?.phone ?? null,
      waId: message.contact?.waId ?? null,
      bsuid: message.contact?.bsuid ?? null,
      whatsappUsername: message.contact?.whatsappUsername ?? null,
    },
    sentAt: toIsoString(message.sentAt),
    deliveredAt: toIsoString(message.deliveredAt),
    readAt: toIsoString(message.readAt),
    failedAt: toIsoString(message.failedAt),
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

function serializeRecentEvent(event: MetaMessageEventRecord): MetaEventSummary {
  return {
    id: event.id,
    eventType: event.eventType,
    deliveryStatus: event.deliveryStatus,
    metaMessageId: event.metaMessageId,
    contact: {
      id: event.contact?.id ?? null,
      contactName: event.contact?.contactName ?? null,
      phone: event.contact?.phone ?? null,
      bsuid: event.contact?.bsuid ?? null,
      whatsappUsername: event.contact?.whatsappUsername ?? null,
    },
    eventAt: event.eventAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
  };
}

function buildReviewerNotes(params: {
  connection: MetaConnectionRecord;
  syncResult: MetaSyncResult | null;
  blockers: string[];
}) {
  const legalUrls = getMetaLegalUrls();
  const notes = [
    "This WABA surface is reviewer-oriented: it exposes connection state, business assets, templates, sending actions, media upload and delivery evidence in one place.",
    "business_management is intentionally not exposed as an in-product capability until a real Business Manager flow exists in Recalc.",
  ];

  if (!params.connection) {
    notes.push("A live Meta connection is still required before reviewer flows can be demonstrated end-to-end.");
  }

  if (params.syncResult?.templates.length) {
    notes.push("Official WhatsApp templates are loaded from Meta and shown separately from Recalc internal draft templates.");
  }

  notes.push(
    `Meta legal URLs are available for app review: cancel authorization (${legalUrls.cancelAuthorizationUrl}) and data deletion (${legalUrls.dataDeletionRequestUrl}).`,
  );

  if (getMetaEnvironmentAudit().missingConversionsVariables.length === 0) {
    notes.push("Conversions API is configured for business messaging and can be exercised from this WABA surface with the selected reviewer contact.");
  } else {
    notes.push("Conversions API is optional for this workspace. Configure META_CONVERSIONS_DATASET_ID and META_CONVERSIONS_ACCESS_TOKEN to enable reviewer-visible CAPI events.");
  }

  if (params.blockers.length) {
    notes.push("Some reviewer-visible actions remain blocked. Check the blockers list and the audit markdown files before claiming readiness.");
  }

  return notes;
}

function summarizePhaseStatus(phases: MetaOnboardingPhase[]) {
  if (phases.some((phase) => phase.status === "blocked")) return "blocked" as const;
  if (phases.every((phase) => phase.status === "ready")) return "ready" as const;
  if (phases.some((phase) => phase.status === "in_progress" || phase.status === "ready")) {
    return "in_progress" as const;
  }
  return "pending" as const;
}

export function buildMetaOnboardingSummary(params: {
  connection: MetaConnectionSummary | null;
  assets: MetaWhatsappOverview["assets"];
  templates: MetaTemplateSummary[];
  blockers: string[];
  recentMessagesCount: number;
  recentEventsCount: number;
  capabilities: MetaWhatsappOverview["capabilities"];
}) {
  const grantedScopes = params.connection?.grantedScopes ?? [];
  const missingPermissions = [
    "whatsapp_business_messaging",
    "whatsapp_business_management",
  ].filter((scope) => !grantedScopes.includes(scope));
  const hasAssets = Boolean(
    params.assets.business?.id && params.assets.waba?.id && params.assets.phoneNumber?.id,
  );
  const hasOperationalEvidence =
    params.recentMessagesCount > 0 || params.recentEventsCount > 0;
  const connectionStatus = String(params.connection?.status ?? "pending").toLowerCase();

  const phases: MetaOnboardingPhase[] = [
    {
      key: "connect",
      title: "Conectar cuenta / Embedded Signup",
      status: params.connection
        ? connectionStatus === "error"
          ? "blocked"
          : "ready"
        : "pending",
      summary: params.connection
        ? "La cuenta Meta quedó enlazada al usuario actual."
        : "Falta completar Embedded Signup para iniciar.",
      blockers: params.connection ? [] : ["No hay conexión Meta activa."],
    },
    {
      key: "provision",
      title: "Provisionar activos",
      status: hasAssets ? "ready" : params.connection ? "in_progress" : "blocked",
      summary: hasAssets
        ? "Business Account, WABA y phone number detectados."
        : "Falta sincronizar activos obligatorios para operar.",
      blockers: [
        ...(!params.assets.business?.id ? ["Falta business account id."] : []),
        ...(!params.assets.waba?.id ? ["Falta WABA id."] : []),
        ...(!params.assets.phoneNumber?.id ? ["Falta phone number id."] : []),
      ],
    },
    {
      key: "validate",
      title: "Validar operación",
      status: !params.capabilities.canSendText
        ? "blocked"
        : hasOperationalEvidence
          ? "ready"
          : "in_progress",
      summary: hasOperationalEvidence
        ? "Existe evidencia de envío y/o eventos webhook recientes."
        : "Aún no hay evidencia reciente de envío webhooks para revisión.",
      blockers: params.capabilities.canSendText
        ? []
        : ["No están listos los permisos o activos para enviar mensajes de prueba."],
    },
    {
      key: "app_review",
      title: "Estado App Review",
      status: params.blockers.length
        ? "blocked"
        : params.templates.length && hasOperationalEvidence
          ? "ready"
          : "in_progress",
      summary: params.blockers.length
        ? "Hay bloqueos pendientes antes de declarar readiness."
        : params.templates.length
          ? "Templates oficiales cargados para evidencia."
          : "Falta cargar templates oficiales o evidencia de operación.",
      blockers: [
        ...params.blockers,
        ...(params.templates.length ? [] : ["No hay templates oficiales listados en Meta."]),
        ...(hasOperationalEvidence ? [] : ["No hay evidencia operacional reciente."]),
      ],
    },
  ];

  return {
    status: summarizePhaseStatus(phases),
    phases,
    missingPermissions,
  } satisfies MetaOnboardingSummary;
}

export async function upsertMetaWhatsappConnectionFromCode(params: {
  userId: string;
  code: string;
  wabaId?: string | null;
  phoneNumberId?: string | null;
  businessAccountId?: string | null;
}) {
  const { graphApiVersion } = getMetaEnv();
  const tokens = await exchangeCodeForMetaAccessToken(params.code);
  const expiresAt = tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null;

  const connection = await prisma.userMetaWhatsappConnection.upsert({
    where: { userId: params.userId },
    update: {
      encryptedMetaAccessToken: encryptSecret(tokens.accessToken),
      encryptedSystemUserToken: encryptSecret(tokens.accessToken),
      graphApiVersion,
      wabaId: params.wabaId ?? undefined,
      phoneNumberId: params.phoneNumberId ?? undefined,
      businessAccountId: params.businessAccountId ?? undefined,
      accessTokenExpiresAt: expiresAt,
      connectedAt: new Date(),
      status: "connected",
      lastSyncError: null,
    },
    create: {
      userId: params.userId,
      encryptedMetaAccessToken: encryptSecret(tokens.accessToken),
      encryptedSystemUserToken: encryptSecret(tokens.accessToken),
      graphApiVersion,
      wabaId: params.wabaId ?? null,
      phoneNumberId: params.phoneNumberId ?? null,
      businessAccountId: params.businessAccountId ?? null,
      accessTokenExpiresAt: expiresAt,
      connectedAt: new Date(),
      status: "connected",
      lastSyncError: null,
    },
  });

  try {
    await syncConnectionAssets(connection);
  } catch (error) {
    await prisma.userMetaWhatsappConnection.update({
      where: { id: connection.id },
      data: {
        status: "warning",
        lastSyncError:
          error instanceof Error ? error.message.slice(0, 500) : "post_exchange_sync_failed",
      },
    });
  }

  return getMetaWhatsappConnectionSummary(params.userId);
}

export async function syncMetaWhatsappAssets(userId: string) {
  const connection = await getConnectionOrThrow(userId);
  return syncConnectionAssets(connection);
}

export async function getMetaWhatsappConnectionSummary(userId: string) {
  const connection = await prisma.userMetaWhatsappConnection.findUnique({
    where: { userId },
  });

  return connection ? serializeConnectionSummary(connection) : null;
}

export async function getMetaWhatsappOverview(userId: string, options?: { forceSync?: boolean }) {
  const environment = getMetaEnvironmentAudit();
  const legalUrls = getMetaLegalUrls();
  const connection = await prisma.userMetaWhatsappConnection.findUnique({
    where: { userId },
  });

  let syncResult: MetaSyncResult | null = null;
  const blockers: string[] = [];

  if (!connection) {
    blockers.push("No WABA connection exists yet. Embedded Signup must complete successfully first.");
  } else if (options?.forceSync) {
    try {
      syncResult = await syncConnectionAssets(connection);
    } catch (error) {
      blockers.push(
        error instanceof Error ? error.message : "Meta asset synchronization failed unexpectedly.",
      );
    }
  }

  const refreshedConnection = connection
    ? await prisma.userMetaWhatsappConnection.findUnique({ where: { userId } })
    : null;

  const recentMessages = refreshedConnection
    ? await prisma.metaWhatsappMessage.findMany({
        where: { ownerUserId: userId },
        orderBy: [{ createdAt: "desc" }],
        take: 12,
        include: {
          contact: true,
        },
      })
    : [];

  const recentEvents = refreshedConnection
    ? await prisma.metaWhatsappMessageEvent.findMany({
        where: { ownerUserId: userId },
        orderBy: [{ eventAt: "desc" }],
        take: 20,
        include: {
          contact: true,
        },
      })
    : [];
  const recentEmbeddedSignupSessions = await listRecentMetaEmbeddedSignupSessions(userId);

  const snapshot = (refreshedConnection?.accountReviewSnapshot as Record<string, unknown> | null) ?? null;
  const assets = {
    business:
      syncResult?.business ??
      ((snapshot?.business as { id?: string | null; name?: string | null } | undefined)
        ? {
            id: normalizeString((snapshot?.business as Record<string, unknown>).id),
            name: normalizeString((snapshot?.business as Record<string, unknown>).name),
          }
        : refreshedConnection
          ? {
              id: refreshedConnection.businessAccountId,
              name: refreshedConnection.businessName,
            }
          : null),
    waba:
      syncResult?.waba ??
      ((snapshot?.waba as Record<string, unknown> | undefined)
        ? {
            id: normalizeString((snapshot?.waba as Record<string, unknown>).id),
            name: normalizeString((snapshot?.waba as Record<string, unknown>).name),
            currency: normalizeString((snapshot?.waba as Record<string, unknown>).currency),
            timezoneId: normalizeString((snapshot?.waba as Record<string, unknown>).timezoneId),
          }
        : refreshedConnection
          ? {
              id: refreshedConnection.wabaId,
              name: refreshedConnection.wabaName,
              currency: refreshedConnection.wabaCurrency,
              timezoneId: refreshedConnection.wabaTimezoneId,
            }
          : null),
    phoneNumber:
      syncResult?.phoneNumber ??
      ((snapshot?.phoneNumber as Record<string, unknown> | undefined)
        ? {
            id: normalizeString((snapshot?.phoneNumber as Record<string, unknown>).id),
            displayPhoneNumber: normalizeString(
              (snapshot?.phoneNumber as Record<string, unknown>).displayPhoneNumber,
            ),
            verifiedName: normalizeString(
              (snapshot?.phoneNumber as Record<string, unknown>).verifiedName,
            ),
            qualityRating: normalizeString(
              (snapshot?.phoneNumber as Record<string, unknown>).qualityRating,
            ),
            codeVerificationStatus: normalizeString(
              (snapshot?.phoneNumber as Record<string, unknown>).codeVerificationStatus,
            ),
          }
        : refreshedConnection
          ? {
              id: refreshedConnection.phoneNumberId,
              displayPhoneNumber: refreshedConnection.phoneDisplayNumber,
              verifiedName: refreshedConnection.phoneVerifiedName,
              qualityRating: refreshedConnection.phoneQualityRating,
              codeVerificationStatus: refreshedConnection.phoneCodeVerificationStatus,
            }
          : null),
    businessProfile:
      syncResult?.businessProfile ??
      ((snapshot?.businessProfile as Record<string, unknown> | undefined)
        ? {
            about: normalizeString((snapshot?.businessProfile as Record<string, unknown>).about),
            address: normalizeString((snapshot?.businessProfile as Record<string, unknown>).address),
            description: normalizeString(
              (snapshot?.businessProfile as Record<string, unknown>).description,
            ),
            email: normalizeString((snapshot?.businessProfile as Record<string, unknown>).email),
            profilePictureUrl: normalizeString(
              (snapshot?.businessProfile as Record<string, unknown>).profilePictureUrl,
            ),
            websites: toStringArray(
              (snapshot?.businessProfile as Record<string, unknown>).websites,
            ),
            vertical: normalizeString((snapshot?.businessProfile as Record<string, unknown>).vertical),
          }
        : null),
  };
  const templates =
    syncResult?.templates ??
    (Array.isArray(snapshot?.templates)
      ? (snapshot?.templates as Record<string, unknown>[]).map(mapTemplateSummary)
      : []);

  if (environment.missingServerVariables.length) {
    blockers.push(
      `Missing server variables: ${environment.missingServerVariables.join(", ")}.`,
    );
  }
  if (environment.missingPublicVariables.length) {
    blockers.push(
      `Missing public variables: ${environment.missingPublicVariables.join(", ")}.`,
    );
  }
  if (syncResult?.blockers.length) {
    blockers.push(...syncResult.blockers);
  }
  if (refreshedConnection?.lastSyncError) {
    blockers.push(`Connection reported lastSyncError: ${refreshedConnection.lastSyncError}`);
  }

  const dedupedBlockers = Array.from(new Set(blockers));
  const connectionSummary = refreshedConnection ? serializeConnectionSummary(refreshedConnection) : null;
  const capabilities = buildOverviewCapabilities({
    connection: refreshedConnection,
    syncResult,
    environment,
  });
  const onboarding = buildMetaOnboardingSummary({
    connection: connectionSummary,
    assets,
    templates,
    blockers: dedupedBlockers,
    recentMessagesCount: recentMessages.length,
    recentEventsCount: recentEvents.length,
    capabilities,
  });

  return {
    connection: connectionSummary,
    assets,
    templates,
    recentMessages: recentMessages.map(serializeRecentMessage),
    recentEvents: recentEvents.map(serializeRecentEvent),
    embeddedSignup: {
      legalUrls,
      recentSessions: recentEmbeddedSignupSessions,
    },
    blockers: dedupedBlockers,
    reviewerNotes: buildReviewerNotes({
      connection: refreshedConnection,
      syncResult,
      blockers: dedupedBlockers,
    }),
    capabilities,
    environment,
    onboarding,
  } satisfies MetaWhatsappOverview;
}

function buildTemplateComponents(bodyVariables: string[] | undefined) {
  const clean = (bodyVariables ?? []).map((item) => item.trim()).filter(Boolean);
  if (!clean.length) {
    return undefined;
  }

  return [
    {
      type: "body",
      parameters: clean.map((text) => ({ type: "text", text })),
    },
  ];
}

function buildOutboundPayload(to: string, payload: MetaSendPayload) {
  if (payload.type === "text") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: payload.text },
    };
  }

  if (payload.type === "template") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: payload.templateName,
        language: { code: payload.language },
        ...(buildTemplateComponents(payload.bodyVariables)
          ? { components: buildTemplateComponents(payload.bodyVariables) }
          : {}),
      },
    };
  }

  return {
    messaging_product: "whatsapp",
    to,
    type: payload.type,
    [payload.type]: {
      id: payload.mediaId,
      ...(payload.caption ? { caption: payload.caption } : {}),
      ...(payload.type === "document" && payload.filename
        ? { filename: payload.filename }
        : {}),
    },
  };
}

function deriveMessageText(payload: MetaSendPayload) {
  if (payload.type === "text") return payload.text;
  if (payload.type === "template") {
    return `Template: ${payload.templateName}${payload.bodyVariables?.length ? ` (${payload.bodyVariables.join(", ")})` : ""}`;
  }
  return payload.caption ?? `${payload.type.toUpperCase()} media`;
}

async function persistOutboundMessage(params: {
  connection: NonNullable<MetaConnectionRecord>;
  userId: string;
  payload: MetaSendPayload;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown> | null;
  contactId: string | null;
}) {
  const messages = Array.isArray(params.responsePayload?.messages)
    ? (params.responsePayload?.messages as Array<{ id?: string }>)
    : [];
  const metaMessageId = normalizeString(messages[0]?.id) ?? null;
  const now = new Date();

  const message = await prisma.metaWhatsappMessage.create({
    data: {
      ownerUserId: params.userId,
      connectionId: params.connection.id,
      contactId: params.contactId,
      metaMessageId,
      direction: "outbound",
      messageType: params.payload.type,
      templateName: params.payload.type === "template" ? params.payload.templateName : null,
      templateLanguage: params.payload.type === "template" ? params.payload.language : null,
      textBody: deriveMessageText(params.payload),
      mediaId:
        params.payload.type === "image" || params.payload.type === "document"
          ? params.payload.mediaId
          : null,
      mediaMimeType: null,
      mediaCaption:
        params.payload.type === "image" || params.payload.type === "document"
          ? params.payload.caption ?? null
          : null,
      externalStatus: "accepted",
      requestPayload: toJsonValue(params.requestPayload),
      responsePayload: params.responsePayload ? toJsonValue(params.responsePayload) : Prisma.JsonNull,
      sentAt: now,
    },
  });

  await prisma.metaWhatsappMessageEvent.create({
    data: {
      ownerUserId: params.userId,
      connectionId: params.connection.id,
      contactId: params.contactId,
      messageId: message.id,
      metaMessageId,
      eventType: "message_accepted",
      deliveryStatus: "accepted",
      payload: toJsonValue(params.responsePayload ?? params.requestPayload),
      eventAt: now,
    },
  });

  return message;
}

export async function sendWhatsAppCloudMessage(params: MetaSendParams) {
  const connection = await getConnectionOrThrow(params.userId);
  const accessToken = await ensureValidToken(connection);
  const graphApiVersion = connection.graphApiVersion || getMetaEnv().graphApiVersion;
  const phoneNumberId = normalizeString(params.phoneNumberId) ?? connection.phoneNumberId;

  if (!phoneNumberId) {
    throw new Error("Missing phoneNumberId. Complete Embedded Signup first.");
  }

  const outboundPayload = buildOutboundPayload(params.to, params.payload);
  const response = await fetch(metaGraphUrl(`${phoneNumberId}/messages`, graphApiVersion), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(outboundPayload),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    await prisma.userMetaWhatsappConnection.update({
      where: { id: connection.id },
      data: {
        status: "error",
        lastSyncError: formatGraphError(response.status, payload),
      },
    });
    throw new Error(formatGraphError(response.status, payload));
  }

  const contactRecord = await recordDirectWhatsappMessageForContact({
    userId: params.userId,
    to: params.to,
    message: deriveMessageText(params.payload),
    contactName: params.contactName,
    waId: params.waId,
    bsuid: params.bsuid,
    parentBsuid: params.parentBsuid,
    whatsappUsername: params.whatsappUsername,
    profilePictureUrl: params.profilePictureUrl,
    profileSource: params.profileSource ?? "meta_send",
    source: "meta_direct",
  });

  const message = await persistOutboundMessage({
    connection,
    userId: params.userId,
    payload: params.payload,
    requestPayload: outboundPayload as Record<string, unknown>,
    responsePayload: payload,
    contactId: contactRecord.id,
  });

  await prisma.userMetaWhatsappConnection.update({
    where: { id: connection.id },
    data: {
      status: "connected",
      lastSyncError: null,
    },
  });

  return {
    result: payload,
    contact: contactRecord,
    message,
  };
}

export async function uploadWhatsAppMedia(params: {
  userId: string;
  file: Blob;
  fileName: string;
  fileType: string;
  phoneNumberId?: string | null;
}) {
  const connection = await getConnectionOrThrow(params.userId);
  const accessToken = await ensureValidToken(connection);
  const graphApiVersion = connection.graphApiVersion || getMetaEnv().graphApiVersion;
  const phoneNumberId = normalizeString(params.phoneNumberId) ?? connection.phoneNumberId;

  if (!phoneNumberId) {
    throw new Error("Missing phoneNumberId. Media upload requires a connected phone number.");
  }

  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("type", params.fileType || "application/octet-stream");
  formData.append("file", params.file, params.fileName);

  const response = await fetch(metaGraphUrl(`${phoneNumberId}/media`, graphApiVersion), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as { id?: string } & GraphResponseError;
  if (!response.ok) {
    throw new Error(formatGraphError(response.status, payload));
  }

  const mediaId = normalizeString(payload.id);
  if (!mediaId) {
    throw new Error("Meta media upload did not return a media id.");
  }

  const metadata = await getWhatsAppMediaMetadata({
    userId: params.userId,
    mediaId,
  });

  const connectionId = connection.id;
  await prisma.metaWhatsappMessageEvent.create({
    data: {
      ownerUserId: params.userId,
      connectionId,
      eventType: "media_uploaded",
      payload: toJsonValue(metadata),
      eventAt: new Date(),
    },
  });

  return metadata;
}

export async function getWhatsAppMediaMetadata(params: { userId: string; mediaId: string }) {
  const connection = await getConnectionOrThrow(params.userId);
  const accessToken = await ensureValidToken(connection);
  const graphApiVersion = connection.graphApiVersion || getMetaEnv().graphApiVersion;

  const payload = await fetchGraphJson<Record<string, unknown>>({
    path: params.mediaId,
    accessToken,
    graphApiVersion,
    searchParams: new URLSearchParams({
      fields: "id,mime_type,sha256,file_size,messaging_product,url",
    }),
  });

  return {
    id: normalizeString(payload.id),
    mimeType: normalizeString(payload.mime_type),
    sha256: normalizeString(payload.sha256),
    fileSize: Number(payload.file_size ?? 0) || null,
    messagingProduct: normalizeString(payload.messaging_product),
    downloadUrl: normalizeString(payload.url),
  };
}

export async function downloadWhatsAppMedia(params: { userId: string; mediaId: string }) {
  const metadata = await getWhatsAppMediaMetadata(params);
  if (!metadata.downloadUrl) {
    throw new Error("Meta media metadata did not return a download URL.");
  }

  const connection = await getConnectionOrThrow(params.userId);
  const accessToken = await ensureValidToken(connection);

  const response = await fetch(metadata.downloadUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Media download failed (${response.status}): ${body.slice(0, 240)}`);
  }

  return {
    contentType:
      response.headers.get("content-type") ||
      metadata.mimeType ||
      "application/octet-stream",
    fileName: `${metadata.id ?? params.mediaId}`,
    arrayBuffer: await response.arrayBuffer(),
  };
}

function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const { appSecret } = getMetaEnv();
  if (!signature || !appSecret) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return signature.replace(/^sha256=/, "") === expected;
}

function resolveWebhookMessageText(message: Record<string, unknown>) {
  const type = normalizeString(message.type) ?? "unknown";
  if (type === "text") {
    return normalizeString((message.text as Record<string, unknown> | undefined)?.body);
  }

  if (type === "image" || type === "document") {
    const media = message[type] as Record<string, unknown> | undefined;
    return normalizeString(media?.caption) ?? `${type.toUpperCase()} message`;
  }

  return `${type.toUpperCase()} message`;
}

function resolveWebhookIdentity(params: {
  value: Record<string, unknown>;
  message: Record<string, unknown>;
}) {
  const contacts = Array.isArray(params.value.contacts)
    ? (params.value.contacts as Array<Record<string, unknown>>)
    : [];
  const waId = normalizeString(params.message.from) ?? null;
  const matchingContact =
    contacts.find((item) => normalizeString(item.wa_id) === waId) ?? contacts[0] ?? null;

  return {
    waId,
    phone: waId,
    bsuid:
      normalizeString(params.message.from_user_id) ??
      normalizeString(params.message.user_id) ??
      null,
    parentBsuid:
      normalizeString(params.message.from_parent_user_id) ??
      normalizeString(params.message.parent_user_id) ??
      null,
    whatsappUsername: normalizeString(params.message.from_username),
    contactName: normalizeString(
      (matchingContact?.profile as Record<string, unknown> | undefined)?.name,
    ),
    profileSource: "meta_webhook",
  } satisfies MetaWebhookIdentity;
}

async function touchContactActivity(params: {
  contactId: string | null;
  timestamp: Date;
  text: string | null;
}) {
  if (!params.contactId) return;
  await prisma.userContact.update({
    where: { id: params.contactId },
    data: {
      lastWhatsappMessageAt: params.timestamp,
      lastWhatsappMessageText: params.text,
    },
  });
}

async function createWebhookAuditEvent(params: {
  connection: NonNullable<MetaConnectionRecord>;
  payload: Record<string, unknown>;
  eventType: string;
  eventAt?: Date;
}) {
  await prisma.metaWhatsappMessageEvent.create({
    data: {
      ownerUserId: params.connection.userId,
      connectionId: params.connection.id,
      eventType: params.eventType,
      payload: toJsonValue(params.payload),
      eventAt: params.eventAt ?? new Date(),
    },
  });
}

async function findExistingMessageReceivedEvent(params: {
  ownerUserId: string;
  metaMessageId: string | null;
  eventAt: Date;
}) {
  if (!params.metaMessageId) {
    return null;
  }

  return prisma.metaWhatsappMessageEvent.findFirst({
    where: {
      ownerUserId: params.ownerUserId,
      metaMessageId: params.metaMessageId,
      eventType: "message_received",
      eventAt: params.eventAt,
    },
  });
}

async function processWebhookStatus(params: {
  connection: NonNullable<MetaConnectionRecord>;
  status: Record<string, unknown>;
}) {
  const timestampSeconds = Number(params.status.timestamp ?? 0) || Math.floor(Date.now() / 1000);
  const eventAt = new Date(timestampSeconds * 1000);
  const metaMessageId = normalizeString(params.status.id);
  const deliveryStatus = normalizeString(params.status.status);
  const recipientId = normalizeString(params.status.recipient_id);
  const contactLookup = await upsertMetaIdentityForUser(params.connection.userId, {
    phone: recipientId,
    waId: recipientId,
    profileSource: "meta_status",
    source: "meta_status",
  });

  const existingMessage = metaMessageId
    ? await prisma.metaWhatsappMessage.findFirst({
        where: {
          ownerUserId: params.connection.userId,
          metaMessageId,
        },
      })
    : null;

  const errorNode = Array.isArray(params.status.errors)
    ? ((params.status.errors[0] as Record<string, unknown> | undefined) ?? null)
    : null;
  const updateData: Prisma.MetaWhatsappMessageUncheckedUpdateInput = {
    externalStatus: deliveryStatus,
    conversationId: normalizeString(
      (params.status.conversation as Record<string, unknown> | undefined)?.id,
    ),
    pricingCategory: normalizeString(
      (params.status.pricing as Record<string, unknown> | undefined)?.category,
    ),
    responsePayload: toJsonValue(params.status),
    ...(contactLookup.contact?.id ? { contactId: contactLookup.contact.id } : {}),
  };

  if (deliveryStatus === "delivered") updateData.deliveredAt = eventAt;
  if (deliveryStatus === "read") updateData.readAt = eventAt;
  if (deliveryStatus === "failed") {
    updateData.failedAt = eventAt;
    updateData.errorCode = normalizeString(errorNode?.code);
    updateData.errorTitle = normalizeString(errorNode?.title);
    updateData.errorMessage = normalizeString(errorNode?.message);
  }
  if (deliveryStatus === "sent") updateData.sentAt = eventAt;

  const message = existingMessage
    ? await prisma.metaWhatsappMessage.update({
        where: { id: existingMessage.id },
        data: updateData,
      })
    : await prisma.metaWhatsappMessage.create({
        data: {
          ownerUserId: params.connection.userId,
          connectionId: params.connection.id,
          contactId: contactLookup.contact?.id ?? null,
          metaMessageId,
          direction: "outbound",
          messageType: "status",
          externalStatus: deliveryStatus,
          conversationId: normalizeString(
            (params.status.conversation as Record<string, unknown> | undefined)?.id,
          ),
          pricingCategory: normalizeString(
            (params.status.pricing as Record<string, unknown> | undefined)?.category,
          ),
          responsePayload: toJsonValue(params.status),
          ...(deliveryStatus === "delivered" ? { deliveredAt: eventAt } : {}),
          ...(deliveryStatus === "read" ? { readAt: eventAt } : {}),
          ...(deliveryStatus === "failed" ? { failedAt: eventAt } : {}),
          ...(deliveryStatus === "sent" ? { sentAt: eventAt } : {}),
        },
      });

  await prisma.metaWhatsappMessageEvent.create({
    data: {
      ownerUserId: params.connection.userId,
      connectionId: params.connection.id,
      contactId: contactLookup.contact?.id ?? null,
      messageId: message.id,
      metaMessageId,
      eventType: "status_update",
      deliveryStatus,
      payload: toJsonValue(params.status),
      eventAt,
    },
  });
}

async function processWebhookMessage(params: {
  connection: NonNullable<MetaConnectionRecord>;
  value: Record<string, unknown>;
  message: Record<string, unknown>;
}) {
  const timestampSeconds = Number(params.message.timestamp ?? 0) || Math.floor(Date.now() / 1000);
  const eventAt = new Date(timestampSeconds * 1000);
  const identity = resolveWebhookIdentity(params);
  const contactLookup = await upsertMetaIdentityForUser(params.connection.userId, identity);
  const messageType = normalizeString(params.message.type) ?? "unknown";
  const mediaNode =
    messageType === "image" || messageType === "document"
      ? ((params.message[messageType] as Record<string, unknown> | undefined) ?? null)
      : null;
  const textBody = resolveWebhookMessageText(params.message);
  const metaMessageId = normalizeString(params.message.id);
  const messageData: Prisma.MetaWhatsappMessageUncheckedUpdateInput = {
    connectionId: params.connection.id,
    ...(contactLookup.contact?.id ? { contactId: contactLookup.contact.id } : {}),
    direction: "inbound",
    messageType,
    textBody,
    mediaId: normalizeString(mediaNode?.id),
    mediaMimeType: normalizeString(mediaNode?.mime_type),
    mediaSha256: normalizeString(mediaNode?.sha256),
    mediaCaption: normalizeString(mediaNode?.caption),
    externalStatus: "received",
    responsePayload: toJsonValue(params.message),
    sentAt: eventAt,
  };

  const existingMessage = metaMessageId
    ? await prisma.metaWhatsappMessage.findFirst({
        where: {
          ownerUserId: params.connection.userId,
          metaMessageId,
        },
      })
    : null;

  const createdMessage = existingMessage
    ? await prisma.metaWhatsappMessage.update({
        where: { id: existingMessage.id },
        data: messageData,
      })
    : await prisma.metaWhatsappMessage.create({
        data: {
          ownerUserId: params.connection.userId,
          connectionId: params.connection.id,
          contactId: contactLookup.contact?.id ?? null,
          metaMessageId,
          direction: "inbound",
          messageType,
          textBody,
          mediaId: normalizeString(mediaNode?.id),
          mediaMimeType: normalizeString(mediaNode?.mime_type),
          mediaSha256: normalizeString(mediaNode?.sha256),
          mediaCaption: normalizeString(mediaNode?.caption),
          externalStatus: "received",
          responsePayload: toJsonValue(params.message),
          sentAt: eventAt,
        },
      });

  const existingReceivedEvent = await findExistingMessageReceivedEvent({
    ownerUserId: params.connection.userId,
    metaMessageId,
    eventAt,
  });
  if (!existingReceivedEvent) {
    await prisma.metaWhatsappMessageEvent.create({
      data: {
        ownerUserId: params.connection.userId,
        connectionId: params.connection.id,
        contactId: contactLookup.contact?.id ?? null,
        messageId: createdMessage.id,
        metaMessageId,
        eventType: "message_received",
        deliveryStatus: "received",
        payload: toJsonValue(params.message),
        eventAt,
      },
    });
  }

  await touchContactActivity({
    contactId: contactLookup.contact?.id ?? null,
    timestamp: eventAt,
    text: textBody,
  });

  return {
    messageId: createdMessage.id,
    warning: contactLookup.warning,
  };
}

async function resolveConnectionFromWebhookValue(value: Record<string, unknown>) {
  const metadata = (value.metadata as Record<string, unknown> | undefined) ?? {};
  const phoneNumberId = normalizeString(metadata.phone_number_id);
  if (phoneNumberId) {
    const connection = await prisma.userMetaWhatsappConnection.findFirst({
      where: { phoneNumberId },
    });
    if (connection) return connection;
  }

  const displayPhoneNumber = normalizeString(metadata.display_phone_number);
  if (displayPhoneNumber) {
    const connection = await prisma.userMetaWhatsappConnection.findFirst({
      where: {
        phoneDisplayNumber: displayPhoneNumber,
      },
    });
    if (connection) return connection;
  }

  return null;
}

export async function processMetaWebhook(rawBody: string) {
  const payload = (JSON.parse(rawBody) as Record<string, unknown>) ?? {};
  const entries = Array.isArray(payload.entry) ? (payload.entry as Array<Record<string, unknown>>) : [];
  const processed = {
    entries: entries.length,
    messages: 0,
    statuses: 0,
    warnings: [] as string[],
  };

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes)
      ? (entry.changes as Array<Record<string, unknown>>)
      : [];

    for (const change of changes) {
      const value = (change.value as Record<string, unknown> | undefined) ?? {};
      const connection = await resolveConnectionFromWebhookValue(value);
      if (!connection) {
        processed.warnings.push("Webhook event ignored because no stored connection matched its phone number metadata.");
        continue;
      }

      await prisma.userMetaWhatsappConnection.update({
        where: { id: connection.id },
        data: {
          lastWebhookAt: new Date(),
          status: "connected",
        },
      });

      await createWebhookAuditEvent({
        connection,
        payload: value,
        eventType: "webhook_delivery",
      });

      const statuses = Array.isArray(value.statuses)
        ? (value.statuses as Array<Record<string, unknown>>)
        : [];
      const messages = Array.isArray(value.messages)
        ? (value.messages as Array<Record<string, unknown>>)
        : [];

      for (const status of statuses) {
        await processWebhookStatus({ connection, status });
        processed.statuses += 1;
      }

      for (const message of messages) {
        const result = await processWebhookMessage({ connection, value, message });
        if (result.warning) {
          processed.warnings.push(result.warning);
        }
        processed.messages += 1;
      }
    }
  }

  return processed;
}

export function verifyMetaWebhookHandshake(params: {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
}) {
  const { webhookVerifyToken } = getMetaEnv();
  if (!webhookVerifyToken) {
    throw new Error("META_WEBHOOK_VERIFY_TOKEN is not configured.");
  }

  if (params.mode !== "subscribe" || params.verifyToken !== webhookVerifyToken) {
    throw new Error("Webhook verification token mismatch.");
  }

  return params.challenge ?? "";
}

export function assertMetaWebhookSignature(rawBody: string, signature: string | null) {
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new Error("Meta webhook signature verification failed.");
  }
}
