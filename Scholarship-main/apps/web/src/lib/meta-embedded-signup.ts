import { createCipheriv, createHash, randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";

import { getMetaLegalUrls } from "@/lib/meta-legal";
import { prisma } from "@/lib/prisma";

export type MetaEmbeddedSignupFlowType = "embedded_signup" | "whatsapp_api";

export type MetaEmbeddedSignupStatus =
  | "started"
  | "login_status"
  | "finish"
  | "cancelled"
  | "error"
  | "code_received"
  | "exchanged"
  | "exchange_failed";

export type MetaEmbeddedSignupSessionSummary = {
  id: string;
  clientSessionId: string;
  status: string;
  flowType: string | null;
  configId: string | null;
  facebookUserId: string | null;
  facebookLoginStatus: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  errorMessage: string | null;
  authorizationCodeReceivedAt: string | null;
  finishedAt: string | null;
  cancelledAt: string | null;
  exchangedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function getMetaIntegrationSecret() {
  const secret = process.env.META_INTEGRATION_SECRET?.trim();
  if (!secret) {
    throw new Error("META_INTEGRATION_SECRET is required to store Meta signup data securely.");
  }

  return createHash("sha256").update(secret).digest();
}

function encryptValue(value: string) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getMetaIntegrationSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function recordMetaEmbeddedSignupSession(params: {
  userId: string;
  clientSessionId: string;
  status: MetaEmbeddedSignupStatus;
  flowType?: MetaEmbeddedSignupFlowType | null;
  appId?: string | null;
  configId?: string | null;
  sessionInfoVersion?: number | null;
  graphApiVersion?: string | null;
  facebookUserId?: string | null;
  facebookLoginStatus?: string | null;
  authorizationCode?: string | null;
  wabaId?: string | null;
  phoneNumberId?: string | null;
  businessAccountId?: string | null;
  errorMessage?: string | null;
  payload?: unknown;
}) {
  const connection = await prisma.userMetaWhatsappConnection.findUnique({
    where: { userId: params.userId },
    select: { id: true },
  });
  const legalUrls = getMetaLegalUrls();
  const now = new Date();

  return prisma.metaEmbeddedSignupSession.upsert({
    where: { clientSessionId: params.clientSessionId },
    create: {
      ownerUserId: params.userId,
      connectionId: connection?.id ?? null,
      clientSessionId: params.clientSessionId,
      status: params.status,
      flowType: params.flowType ?? null,
      appId: params.appId ?? null,
      configId: params.configId ?? null,
      sessionInfoVersion: params.sessionInfoVersion ?? null,
      graphApiVersion: params.graphApiVersion ?? null,
      facebookUserId: params.facebookUserId ?? null,
      facebookLoginStatus: params.facebookLoginStatus ?? null,
      encryptedAuthorizationCode: params.authorizationCode
        ? encryptValue(params.authorizationCode)
        : null,
      authorizationCodeReceivedAt: params.authorizationCode ? now : null,
      wabaId: params.wabaId ?? null,
      phoneNumberId: params.phoneNumberId ?? null,
      businessAccountId: params.businessAccountId ?? null,
      cancelRedirectUrl: legalUrls.cancelAuthorizationUrl,
      dataDeletionRequestUrl: legalUrls.dataDeletionRequestUrl,
      dataDeletionCallbackUrl: legalUrls.dataDeletionCallbackUrl,
      errorMessage: params.errorMessage ?? null,
      payload: params.payload == null ? Prisma.JsonNull : toJsonValue(params.payload),
      finishedAt: params.status === "finish" ? now : null,
      cancelledAt: params.status === "cancelled" ? now : null,
      exchangedAt: params.status === "exchanged" ? now : null,
    },
    update: {
      connectionId: connection?.id ?? undefined,
      status: params.status,
      flowType: params.flowType ?? undefined,
      appId: params.appId ?? undefined,
      configId: params.configId ?? undefined,
      sessionInfoVersion: params.sessionInfoVersion ?? undefined,
      graphApiVersion: params.graphApiVersion ?? undefined,
      facebookUserId: params.facebookUserId ?? undefined,
      facebookLoginStatus: params.facebookLoginStatus ?? undefined,
      encryptedAuthorizationCode: params.authorizationCode
        ? encryptValue(params.authorizationCode)
        : undefined,
      authorizationCodeReceivedAt: params.authorizationCode ? now : undefined,
      wabaId: params.wabaId ?? undefined,
      phoneNumberId: params.phoneNumberId ?? undefined,
      businessAccountId: params.businessAccountId ?? undefined,
      cancelRedirectUrl: legalUrls.cancelAuthorizationUrl,
      dataDeletionRequestUrl: legalUrls.dataDeletionRequestUrl,
      dataDeletionCallbackUrl: legalUrls.dataDeletionCallbackUrl,
      errorMessage: params.errorMessage ?? undefined,
      payload: params.payload == null ? undefined : toJsonValue(params.payload),
      ...(params.status === "finish" ? { finishedAt: now } : {}),
      ...(params.status === "cancelled" ? { cancelledAt: now } : {}),
      ...(params.status === "exchanged" ? { exchangedAt: now } : {}),
    },
  });
}

export async function listRecentMetaEmbeddedSignupSessions(userId: string) {
  const sessions = await prisma.metaEmbeddedSignupSession.findMany({
    where: { ownerUserId: userId },
    orderBy: [{ updatedAt: "desc" }],
    take: 6,
  });

  return sessions.map((session) => ({
    id: session.id,
    clientSessionId: session.clientSessionId,
    status: session.status,
    flowType: session.flowType,
    configId: session.configId,
    facebookUserId: session.facebookUserId,
    facebookLoginStatus: session.facebookLoginStatus,
    wabaId: session.wabaId,
    phoneNumberId: session.phoneNumberId,
    businessAccountId: session.businessAccountId,
    errorMessage: session.errorMessage,
    authorizationCodeReceivedAt: toIsoString(session.authorizationCodeReceivedAt),
    finishedAt: toIsoString(session.finishedAt),
    cancelledAt: toIsoString(session.cancelledAt),
    exchangedAt: toIsoString(session.exchangedAt),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  })) satisfies MetaEmbeddedSignupSessionSummary[];
}
