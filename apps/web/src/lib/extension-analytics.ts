import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const MAX_TEXT = 10_000;

export type ExtensionAnalyticsCampaignSnapshot = {
  id: string;
  campaignName: string;
  status?: string | null;
  messageTemplate?: string | null;
  scheduleAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  batchSize?: number | null;
  messageDelayMs?: number | null;
  batchDelayMs?: number | null;
  jitterMs?: number | null;
  hasMedia?: boolean | null;
  mediaType?: string | null;
  totalCount?: number | null;
  sentCount?: number | null;
  failedCount?: number | null;
  pendingCount?: number | null;
  invalidCount?: number | null;
  estimatedCostMxn?: number | null;
  country?: unknown;
  settings?: unknown;
  meta?: unknown;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ExtensionAnalyticsRecipientSnapshot = {
  id: string;
  campaignId: string;
  contactValue: string;
  contactName?: string | null;
  status?: string | null;
  resolvedMessage?: string | null;
  attemptedAt?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  lastError?: string | null;
  payload?: unknown;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ExtensionAnalyticsEventInput = {
  id: string;
  campaignId?: string | null;
  recipientId?: string | null;
  eventType: string;
  occurredAt?: string | null;
  payload?: unknown;
};

function normalizeText(value: unknown, max = MAX_TEXT) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeMultilineText(value: unknown, max = MAX_TEXT) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, max);
}

export function normalizeExtensionNameId(value: unknown) {
  const normalized = normalizeText(value, 80);
  if (normalized.length < 2) {
    throw new Error("El Name_ID debe tener al menos 2 caracteres.");
  }
  return normalized;
}

export function normalizeInstallationId(value: unknown) {
  const normalized = normalizeText(value, 64).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error("El identificador de instalación no es válido.");
  }
  return normalized;
}

function normalizeUuid(value: unknown, label: string) {
  const normalized = normalizeText(value, 64).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error(`${label} no es válido.`);
  }
  return normalized;
}

function normalizeProof(value: unknown) {
  const proof = String(value ?? "").trim();
  if (proof.length < 32 || proof.length > 256) {
    throw new Error("La prueba técnica de instalación no es válida.");
  }
  return proof;
}

function hashProof(proof: string) {
  return createHash("sha256").update(proof, "utf8").digest("hex");
}

function proofMatches(proof: string, expectedHash: string) {
  const actual = Buffer.from(hashProof(proof), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function toOptionalDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toRequiredDate(value: unknown, fallback = new Date()) {
  return toOptionalDate(value) ?? fallback;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeStatus(value: unknown, fallback = "queued") {
  const status = normalizeText(value, 40).toLowerCase();
  return status || fallback;
}

export async function registerExtensionAnalyticsInstallation(params: {
  installationId: unknown;
  installationProof: unknown;
  nameId: unknown;
  extensionVersion?: unknown;
  clientMeta?: unknown;
}) {
  const installationId = normalizeInstallationId(params.installationId);
  const installationProof = normalizeProof(params.installationProof);
  const nameId = normalizeExtensionNameId(params.nameId);
  const extensionVersion = normalizeText(params.extensionVersion, 40) || null;
  const proofHash = hashProof(installationProof);
  const now = new Date();

  const existing = await prisma.extensionAnalyticsInstallation.findUnique({
    where: { id: installationId },
  });

  if (existing && !proofMatches(installationProof, existing.proofHash)) {
    throw new Error("La instalación ya existe con otra prueba técnica.");
  }

  return prisma.extensionAnalyticsInstallation.upsert({
    where: { id: installationId },
    create: {
      id: installationId,
      nameId,
      proofHash,
      extensionVersion,
      clientMeta: toJson(params.clientMeta),
      firstSeenAt: now,
      lastSeenAt: now,
    },
    update: {
      nameId,
      extensionVersion,
      clientMeta: toJson(params.clientMeta),
      lastSeenAt: now,
    },
    select: {
      id: true,
      nameId: true,
      extensionVersion: true,
      firstSeenAt: true,
      lastSeenAt: true,
      lastSyncAt: true,
    },
  });
}

export async function authenticateExtensionAnalyticsInstallation(params: {
  installationId: unknown;
  installationProof: unknown;
}) {
  const installationId = normalizeInstallationId(params.installationId);
  const installationProof = normalizeProof(params.installationProof);
  const installation = await prisma.extensionAnalyticsInstallation.findUnique({
    where: { id: installationId },
  });
  if (!installation || !proofMatches(installationProof, installation.proofHash)) {
    throw new Error("Instalación no autorizada.");
  }
  return installation;
}

export async function syncExtensionAnalytics(params: {
  installationId: unknown;
  installationProof: unknown;
  nameId?: unknown;
  extensionVersion?: unknown;
  clientMeta?: unknown;
  campaigns?: ExtensionAnalyticsCampaignSnapshot[];
  recipients?: ExtensionAnalyticsRecipientSnapshot[];
  events?: ExtensionAnalyticsEventInput[];
}) {
  const installation = await authenticateExtensionAnalyticsInstallation(params);
  const nameId = params.nameId
    ? normalizeExtensionNameId(params.nameId)
    : installation.nameId;
  const extensionVersion = normalizeText(params.extensionVersion, 40) || installation.extensionVersion;
  const campaigns = Array.isArray(params.campaigns) ? params.campaigns.slice(0, 20) : [];
  const recipients = Array.isArray(params.recipients) ? params.recipients.slice(0, 500) : [];
  const events = Array.isArray(params.events) ? params.events.slice(0, 250) : [];
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.extensionAnalyticsInstallation.update({
      where: { id: installation.id },
      data: {
        nameId,
        extensionVersion,
        clientMeta: toJson(params.clientMeta ?? installation.clientMeta),
        lastSeenAt: now,
        lastSyncAt: now,
      },
    });

    for (const snapshot of campaigns) {
      const id = normalizeUuid(snapshot.id, "El id de campaña");
      const createdAt = toRequiredDate(snapshot.createdAt, now);
      const updatedAt = toRequiredDate(snapshot.updatedAt, now);
      const data = {
        installationId: installation.id,
        nameId,
        campaignName: normalizeText(snapshot.campaignName, 180) || "Campaña sin nombre",
        status: normalizeStatus(snapshot.status, "draft"),
        messageTemplate: normalizeMultilineText(snapshot.messageTemplate) || null,
        scheduleAt: toOptionalDate(snapshot.scheduleAt),
        startedAt: toOptionalDate(snapshot.startedAt),
        completedAt: toOptionalDate(snapshot.completedAt),
        batchSize: clampInteger(snapshot.batchSize, 25, 1, 500),
        messageDelayMs: clampInteger(snapshot.messageDelayMs, 4000, 0, 30 * 60_000),
        batchDelayMs: clampInteger(snapshot.batchDelayMs, 30_000, 0, 60 * 60_000),
        jitterMs: clampInteger(snapshot.jitterMs, 3000, 0, 5 * 60_000),
        hasMedia: Boolean(snapshot.hasMedia),
        mediaType: normalizeText(snapshot.mediaType, 120) || null,
        totalCount: clampInteger(snapshot.totalCount, 0, 0, 1_000_000),
        sentCount: clampInteger(snapshot.sentCount, 0, 0, 1_000_000),
        failedCount: clampInteger(snapshot.failedCount, 0, 0, 1_000_000),
        pendingCount: clampInteger(snapshot.pendingCount, 0, 0, 1_000_000),
        invalidCount: clampInteger(snapshot.invalidCount, 0, 0, 1_000_000),
        estimatedCostMxn: clampNumber(snapshot.estimatedCostMxn, 0, 0, 100_000_000),
        country: toJson(snapshot.country),
        settings: toJson(snapshot.settings),
        meta: toJson(snapshot.meta),
        updatedAt,
      };

      await tx.extensionAnalyticsCampaign.upsert({
        where: { id },
        create: { id, ...data, createdAt },
        update: data,
      });
    }

    for (const snapshot of recipients) {
      const id = normalizeUuid(snapshot.id, "El id del destinatario");
      const campaignId = normalizeUuid(snapshot.campaignId, "El id de campaña del destinatario");
      const campaign = await tx.extensionAnalyticsCampaign.findFirst({
        where: { id: campaignId, installationId: installation.id },
        select: { id: true },
      });
      if (!campaign) continue;

      const createdAt = toRequiredDate(snapshot.createdAt, now);
      const updatedAt = toRequiredDate(snapshot.updatedAt, now);
      const status = normalizeStatus(snapshot.status, "queued");
      const contactValue = normalizeText(snapshot.contactValue, 80);
      if (!contactValue) continue;
      const data = {
        campaignId,
        installationId: installation.id,
        nameId,
        contactValue,
        contactName: normalizeText(snapshot.contactName, 180) || null,
        status,
        resolvedMessage: normalizeMultilineText(snapshot.resolvedMessage) || null,
        attemptedAt: toOptionalDate(snapshot.attemptedAt),
        sentAt: toOptionalDate(snapshot.sentAt),
        failedAt: toOptionalDate(snapshot.failedAt),
        lastError: normalizeText(snapshot.lastError, 1000) || null,
        payload: toJson(snapshot.payload),
        updatedAt,
      };

      await tx.extensionAnalyticsRecipient.upsert({
        where: { id },
        create: { id, ...data, createdAt },
        update: data,
      });
    }

    if (events.length) {
      await tx.extensionAnalyticsEvent.createMany({
        data: events.map((event) => ({
          id: normalizeUuid(event.id, "El id del evento"),
          installationId: installation.id,
          campaignId: event.campaignId ? normalizeUuid(event.campaignId, "El id de campaña del evento") : null,
          recipientId: event.recipientId ? normalizeUuid(event.recipientId, "El id de destinatario del evento") : null,
          eventType: normalizeText(event.eventType, 80) || "unknown",
          occurredAt: toRequiredDate(event.occurredAt, now),
          payload: toJson(event.payload),
        })),
        skipDuplicates: true,
      });
    }

    return {
      campaignsAccepted: campaigns.length,
      recipientsAccepted: recipients.length,
      eventsAccepted: events.length,
    };
  });

  return {
    installationId: installation.id,
    nameId,
    syncedAt: now.toISOString(),
    ...result,
  };
}

export async function readExtensionAnalyticsAdmin(params?: {
  nameId?: string | null;
  campaignId?: string | null;
  limit?: number;
}) {
  const selectedNameId = normalizeText(params?.nameId, 80) || null;
  const selectedCampaignId = params?.campaignId
    ? normalizeUuid(params.campaignId, "El id de campaña")
    : null;
  const limit = clampInteger(params?.limit, 200, 1, 500);

  const [installationGroups, campaignGroups, totals, campaigns] = await Promise.all([
    prisma.extensionAnalyticsInstallation.groupBy({
      by: ["nameId"],
      _count: { _all: true },
      _max: { lastSeenAt: true, lastSyncAt: true },
      orderBy: { _max: { lastSeenAt: "desc" } },
    }),
    prisma.extensionAnalyticsCampaign.groupBy({
      by: ["nameId"],
      _count: { _all: true },
      _sum: {
        totalCount: true,
        sentCount: true,
        failedCount: true,
        pendingCount: true,
        invalidCount: true,
        estimatedCostMxn: true,
      },
      _max: { updatedAt: true },
      orderBy: { _max: { updatedAt: "desc" } },
    }),
    prisma.extensionAnalyticsCampaign.aggregate({
      _count: { _all: true },
      _sum: {
        totalCount: true,
        sentCount: true,
        failedCount: true,
        pendingCount: true,
        invalidCount: true,
        estimatedCostMxn: true,
      },
      _max: { updatedAt: true },
    }),
    prisma.extensionAnalyticsCampaign.findMany({
      where: {
        ...(selectedNameId ? { nameId: selectedNameId } : {}),
        ...(selectedCampaignId ? { id: selectedCampaignId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        installation: {
          select: {
            extensionVersion: true,
            lastSeenAt: true,
            lastSyncAt: true,
          },
        },
      },
    }),
  ]);

  const installationByName = new Map(
    installationGroups.map((row) => [row.nameId, row]),
  );
  const nameIds = Array.from(
    new Set([...installationGroups.map((row) => row.nameId), ...campaignGroups.map((row) => row.nameId)]),
  );
  const users = nameIds.map((nameId) => {
    const installation = installationByName.get(nameId);
    const campaign = campaignGroups.find((row) => row.nameId === nameId);
    return {
      nameId,
      installations: installation?._count._all ?? 0,
      campaigns: campaign?._count._all ?? 0,
      recipients: campaign?._sum.totalCount ?? 0,
      sent: campaign?._sum.sentCount ?? 0,
      failed: campaign?._sum.failedCount ?? 0,
      pending: campaign?._sum.pendingCount ?? 0,
      invalid: campaign?._sum.invalidCount ?? 0,
      estimatedCostMxn: campaign?._sum.estimatedCostMxn ?? 0,
      lastActivityAt:
        campaign?._max.updatedAt?.toISOString() ??
        installation?._max.lastSyncAt?.toISOString() ??
        installation?._max.lastSeenAt?.toISOString() ??
        null,
    };
  });

  const recipients = selectedCampaignId
    ? await prisma.extensionAnalyticsRecipient.findMany({
        where: { campaignId: selectedCampaignId },
        orderBy: [{ updatedAt: "desc" }, { contactValue: "asc" }],
        take: 1000,
      })
    : [];

  return {
    selectedNameId,
    selectedCampaignId,
    users,
    totals: {
      campaigns: totals._count._all,
      recipients: totals._sum.totalCount ?? 0,
      sent: totals._sum.sentCount ?? 0,
      failed: totals._sum.failedCount ?? 0,
      pending: totals._sum.pendingCount ?? 0,
      invalid: totals._sum.invalidCount ?? 0,
      estimatedCostMxn: totals._sum.estimatedCostMxn ?? 0,
      lastActivityAt: totals._max.updatedAt?.toISOString() ?? null,
    },
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      installationId: campaign.installationId,
      nameId: campaign.nameId,
      campaignName: campaign.campaignName,
      status: campaign.status,
      messageTemplate: campaign.messageTemplate,
      scheduleAt: campaign.scheduleAt?.toISOString() ?? null,
      startedAt: campaign.startedAt?.toISOString() ?? null,
      completedAt: campaign.completedAt?.toISOString() ?? null,
      batchSize: campaign.batchSize,
      messageDelayMs: campaign.messageDelayMs,
      batchDelayMs: campaign.batchDelayMs,
      jitterMs: campaign.jitterMs,
      hasMedia: campaign.hasMedia,
      mediaType: campaign.mediaType,
      total: campaign.totalCount,
      sent: campaign.sentCount,
      failed: campaign.failedCount,
      pending: campaign.pendingCount,
      invalid: campaign.invalidCount,
      estimatedCostMxn: campaign.estimatedCostMxn,
      country: campaign.country,
      settings: campaign.settings,
      meta: campaign.meta,
      extensionVersion: campaign.installation.extensionVersion,
      lastSeenAt: campaign.installation.lastSeenAt.toISOString(),
      lastSyncAt: campaign.installation.lastSyncAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    })),
    recipients: recipients.map((recipient) => ({
      id: recipient.id,
      campaignId: recipient.campaignId,
      nameId: recipient.nameId,
      contactValue: recipient.contactValue,
      contactName: recipient.contactName,
      status: recipient.status,
      resolvedMessage: recipient.resolvedMessage,
      attemptedAt: recipient.attemptedAt?.toISOString() ?? null,
      sentAt: recipient.sentAt?.toISOString() ?? null,
      failedAt: recipient.failedAt?.toISOString() ?? null,
      lastError: recipient.lastError,
      payload: recipient.payload,
      createdAt: recipient.createdAt.toISOString(),
      updatedAt: recipient.updatedAt.toISOString(),
    })),
  };
}

export async function listExtensionAnalyticsRecipientExport(params?: {
  nameId?: string | null;
  campaignId?: string | null;
  status?: string | null;
}) {
  const nameId = normalizeText(params?.nameId, 80) || null;
  const campaignId = params?.campaignId
    ? normalizeUuid(params.campaignId, "El id de campaña")
    : null;
  const status = normalizeText(params?.status, 40).toLowerCase() || null;

  return prisma.extensionAnalyticsRecipient.findMany({
    where: {
      ...(nameId ? { nameId } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { contactValue: "asc" }],
    take: 50_000,
    include: {
      campaign: {
        select: { campaignName: true },
      },
    },
  });
}
