import { Prisma } from "@prisma/client";

import { writeBusinessEventSafe } from "@/lib/business-events";
import {
  claimD1ExtensionCampaignBatch,
  createD1ExtensionCampaign,
  deleteD1ExtensionCampaignForUser,
  getD1ExtensionRunnerHealth,
  listD1ExtensionCampaignsForUser,
  listD1ExtensionCampaignsWithRunnerHealthForUser,
  pauseD1ExtensionCampaign,
  recordD1ExtensionCampaignDispatch,
  resumeD1ExtensionCampaign,
} from "@/lib/cloudflare/extension-runtime-d1";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import { renderCampaignMessageTemplate } from "@/lib/extension-campaign-template";
import { prisma } from "@/lib/prisma";
import {
  recordCampaignDispatchForContacts,
  syncCampaignRecipientsToContacts,
} from "@/lib/user-contacts";

const DEFAULT_CAMPAIGN_DELAY_MS = 4_000;
const MAX_CAMPAIGN_DELAY_MS = 60_000;
const READY_CAMPAIGN_STATUSES = [
  "queued",
  "scheduled",
  "running",
  "processing",
  "waiting_runner",
] as const;
const PENDING_RECIPIENT_STATUSES = ["queued", "scheduled", "claimed"] as const;
const TERMINAL_CAMPAIGN_STATUSES = [
  "completed",
  "sent",
  "failed",
  "partial",
  "blocked",
] as const;
const RUNNER_HEALTH_EVENT_TYPES = [
  "runner_heartbeat",
  "campaign_claimed",
  "campaign_dispatch_recorded",
  "runner_started",
] as const;
const DEFAULT_RUNNER_STALE_AFTER_MS = 180_000;
const STALE_CLAIM_AFTER_MS = 20 * 60_000;
const PHONE_HEADER_ALIASES = [
  "numero",
  "numero_telefono",
  "numero_de_telefono",
  "nro",
  "nro_telefono",
  "cel",
  "celular",
  "movil",
  "telefono",
  "phone",
  "phone_number",
  "whatsapp",
  "wa",
];
const NAME_HEADER_ALIASES = [
  "nombre",
  "nombre_completo",
  "full_name",
  "contacto",
  "contact_name",
  "name",
];
export type ExtensionRecipientInput = {
  contactValue: string;
  contactName?: string | null;
  externalKey?: string | null;
  scheduledFor?: string | Date | null;
  payload?: Record<string, unknown> | null;
};

export type ExtensionCampaignInput = {
  userId: string;
  campaignName: string;
  channel?: ExtensionCampaignChannel | null;
  notes?: string | null;
  batchSize?: number | null;
  scheduleAt?: string | Date | null;
  recipients: ExtensionRecipientInput[];
  messageTemplate?: string | null;
  messageDelayMs?: number | null;
  mediaUrl?: string | null;
  meta?: Record<string, unknown> | null;
};

export type ExtensionCampaignChannel =
  | "extension_runner"
  | "whatsapp_web"
  | "test_mode"
  | "manual_review";

export type ExtensionRunnerHealth = {
  available: boolean;
  isHealthy: boolean;
  status: "online" | "stale" | "offline";
  staleAfterMs: number;
  lastHeartbeatAt: string | null;
  lastHeartbeatAgeMs: number | null;
  lastEventType: string | null;
  lastRunId: string | null;
  message: string;
};

export { renderCampaignMessageTemplate } from "@/lib/extension-campaign-template";

type ExtensionCampaignRecord = Prisma.ExtensionCampaignGetPayload<{
  include: {
    recipients: {
      orderBy: [{ createdAt: "asc" }];
    };
  };
}>;

type ExtensionCampaignRecipientRecord = ExtensionCampaignRecord["recipients"][number];

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeMultilineText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function normalizeContactValue(value: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  const looksLikePhone = /^[+\d\s().-]+$/.test(normalized);
  if (!looksLikePhone) {
    return normalized.replace(/\s+/g, " ");
  }

  const hasPlus = normalized.trim().startsWith("+");
  const digits = normalized.replace(/\D+/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

function normalizeScheduledAt(value?: string | Date | null) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDelayMs(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_CAMPAIGN_DELAY_MS;
  }

  return Math.min(Math.max(Math.round(value), 250), MAX_CAMPAIGN_DELAY_MS);
}

function normalizeMediaUrl(value?: string | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Solo se permiten URLs http/https.");
    }
    return url.toString();
  } catch {
    throw new Error("La imagen de la campaña debe ser una URL válida.");
  }
}

function resolveCampaignChannel(value: string | null | undefined): ExtensionCampaignChannel {
  const normalized = normalizeText(value);
  if (normalized === "test_mode") return "test_mode";
  if (normalized === "manual_review") return "manual_review";
  if (normalized === "extension_runner") return "extension_runner";
  if (normalized === "whatsapp_web") return "whatsapp_web";
  return "extension_runner";
}

function isRunnerCampaignChannel(channel: ExtensionCampaignChannel) {
  return channel === "extension_runner" || channel === "whatsapp_web";
}

function isTerminalCampaignStatus(status: string | null | undefined) {
  return TERMINAL_CAMPAIGN_STATUSES.includes(
    String(status ?? "").toLowerCase() as (typeof TERMINAL_CAMPAIGN_STATUSES)[number],
  );
}

function normalizeRunnerEventType(value: unknown) {
  const normalized = normalizeText(typeof value === "string" ? value : String(value ?? ""));
  return normalized.toLowerCase();
}

function readRunnerEventType(metadata: Prisma.JsonValue | null | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const raw = (metadata as Record<string, unknown>).eventType;
  const normalized = normalizeRunnerEventType(raw);
  return normalized || null;
}

function sanitizeRunnerStaleAfterMs(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return DEFAULT_RUNNER_STALE_AFTER_MS;
  const candidate = Math.round(Number(value));
  return Math.min(Math.max(candidate, 30_000), 30 * 60_000);
}

export function resolveExtensionCampaignCompletionStatus(params: {
  totalRecipients: number;
  sentRecipients: number;
  failedRecipients: number;
}) {
  if (params.totalRecipients <= 0) return "sent" as const;
  if (params.sentRecipients >= params.totalRecipients && params.failedRecipients === 0) {
    return "sent" as const;
  }
  if (params.failedRecipients >= params.totalRecipients && params.sentRecipients === 0) {
    return "failed" as const;
  }
  return "partial" as const;
}

export function resolveExtensionCampaignBusinessStatus(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "partial") return "completed_with_issues" as const;
  if (normalized === "sent" || normalized === "completed") return "completed" as const;
  if (!normalized) return "queued" as const;
  return normalized;
}

export function resolveExtensionCampaignBusinessStatusLabel(status: string | null | undefined) {
  const businessStatus = resolveExtensionCampaignBusinessStatus(status);
  switch (businessStatus) {
    case "completed":
      return "Completada";
    case "completed_with_issues":
      return "Completada con incidencias";
    case "waiting_runner":
      return "Esperando runner";
    case "processing":
      return "Procesando";
    case "queued":
      return "En cola";
    case "scheduled":
      return "Programada";
    case "paused":
      return "Pausada";
    case "failed":
      return "Fallida";
    case "blocked":
      return "Bloqueada";
    case "draft":
      return "Borrador";
    default:
      return businessStatus;
  }
}

async function readCampaignCompletionSnapshot(campaignId: string) {
  const [totalRecipients, sentRecipients, failedRecipients] = await Promise.all([
    prisma.extensionCampaignRecipient.count({
      where: { campaignId },
    }),
    prisma.extensionCampaignRecipient.count({
      where: { campaignId, status: "sent" },
    }),
    prisma.extensionCampaignRecipient.count({
      where: { campaignId, status: "failed" },
    }),
  ]);

  return {
    totalRecipients,
    sentRecipients,
    failedRecipients,
    status: resolveExtensionCampaignCompletionStatus({
      totalRecipients,
      sentRecipients,
      failedRecipients,
    }),
  };
}

export async function getExtensionRunnerHealth(
  userId: string,
  options?: { now?: Date; staleAfterMs?: number },
): Promise<ExtensionRunnerHealth> {
  if (isCloudflareRuntime()) {
    return getD1ExtensionRunnerHealth(userId, options);
  }

  const now = options?.now ?? new Date();
  const staleAfterMs = sanitizeRunnerStaleAfterMs(options?.staleAfterMs);
  const lookbackStart = new Date(
    now.getTime() - Math.max(staleAfterMs * 8, 24 * 60 * 60 * 1000),
  );

  const events = await prisma.businessEvent.findMany({
    where: {
      userId,
      type: "EXTENSION_RUN_EVENT",
      createdAt: { gte: lookbackStart },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 120,
    select: {
      createdAt: true,
      subjectId: true,
      metadata: true,
    },
  });

  const latestHeartbeat = events.find((event) => {
    const eventType = readRunnerEventType(event.metadata);
    return (
      Boolean(eventType) &&
      RUNNER_HEALTH_EVENT_TYPES.includes(
        eventType as (typeof RUNNER_HEALTH_EVENT_TYPES)[number],
      )
    );
  });

  if (!latestHeartbeat) {
    return {
      available: false,
      isHealthy: false,
      status: "offline",
      staleAfterMs,
      lastHeartbeatAt: null,
      lastHeartbeatAgeMs: null,
      lastEventType: null,
      lastRunId: null,
      message: "No se detectó actividad reciente del runner de extensión.",
    };
  }

  const lastHeartbeatAgeMs = Math.max(0, now.getTime() - latestHeartbeat.createdAt.getTime());
  const status = lastHeartbeatAgeMs <= staleAfterMs ? "online" : "stale";
  const lastEventType = readRunnerEventType(latestHeartbeat.metadata);

  return {
    available: status === "online",
    isHealthy: status === "online",
    status,
    staleAfterMs,
    lastHeartbeatAt: latestHeartbeat.createdAt.toISOString(),
    lastHeartbeatAgeMs,
    lastEventType,
    lastRunId: latestHeartbeat.subjectId ?? null,
    message:
      status === "online"
        ? "Runner de extensión operativo."
        : "Runner detectado, pero sin heartbeat reciente.",
  };
}

function toInputJson(value: Record<string, unknown> | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function normalizeHeaderKey(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function countDelimiterOccurrences(line: string, delimiter: string) {
  let quoted = false;
  let total = 0;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) total += 1;
  }

  return total;
}

function detectDelimiter(lines: string[]) {
  const sample = lines
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);

  if (!sample.length) return ",";

  let winner = ",";
  let winnerScore = Number.NEGATIVE_INFINITY;

  for (const delimiter of ["\t", ";", "|", ","]) {
    const counts = sample.map((line) => countDelimiterOccurrences(line, delimiter));
    const rowsWithDelimiter = counts.filter((count) => count > 0).length;
    const totalColumns = counts.reduce((sum, count) => sum + count, 0);
    const score = rowsWithDelimiter * 100 + totalColumns;

    if (score > winnerScore) {
      winner = delimiter;
      winnerScore = score;
    }
  }

  return winner;
}

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }

    if (!quoted && char === delimiter) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.filter(Boolean);
}

function readColumnByAliases(
  headerKeys: string[],
  columns: string[],
  aliases: string[],
) {
  const columnIndex = headerKeys.findIndex((key) => aliases.includes(key));
  if (columnIndex < 0) return "";
  return String(columns[columnIndex] ?? "").trim();
}

function resolveRecipientFromColumns(
  columns: string[],
  headerKeys: string[] | null,
): ExtensionRecipientInput | null {
  if (!columns.length) {
    return null;
  }

  if (headerKeys?.length) {
    const contactName =
      readColumnByAliases(headerKeys, columns, NAME_HEADER_ALIASES) || columns[0] || null;
    const contactValue =
      readColumnByAliases(headerKeys, columns, PHONE_HEADER_ALIASES) ||
      columns[columns.length - 1] ||
      "";

    return {
      contactName: normalizeText(contactName) || null,
      contactValue,
    } satisfies ExtensionRecipientInput;
  }

  if (columns.length === 1) {
    return {
      contactValue: columns[0],
      contactName: null,
    } satisfies ExtensionRecipientInput;
  }

  return {
    contactName: columns[0],
    contactValue: columns[columns.length - 1],
  } satisfies ExtensionRecipientInput;
}

function nextRecipientPendingStatus(
  recipient: { scheduledFor?: Date | null } | ExtensionCampaignRecipientRecord,
  now = new Date(),
) {
  const scheduledFor =
    recipient.scheduledFor instanceof Date
      ? recipient.scheduledFor
      : normalizeScheduledAt(recipient.scheduledFor);

  return scheduledFor && scheduledFor.getTime() > now.getTime()
    ? "scheduled"
    : "queued";
}

async function countCampaignPendingRecipients(campaignId: string, now = new Date()) {
  const totalPending = await prisma.extensionCampaignRecipient.count({
    where: {
      campaignId,
      status: { in: [...PENDING_RECIPIENT_STATUSES] },
    },
  });

  if (!totalPending) {
    return {
      totalPending,
      readyPending: 0,
    };
  }

  const readyPending = await prisma.extensionCampaignRecipient.count({
    where: {
      campaignId,
      status: { in: ["queued", "scheduled"] },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
  });

  return {
    totalPending,
    readyPending,
  };
}

export function parseCampaignRecipientText(value: string) {
  const lines = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines);
  const rows = lines
    .map((line) => splitDelimitedLine(line, delimiter))
    .filter((columns) => columns.length > 0);

  if (!rows.length) return [];

  const headerKeys = rows[0]?.map((column) => normalizeHeaderKey(column)) ?? [];
  const looksLikeHeader = headerKeys.some(
    (key) =>
      PHONE_HEADER_ALIASES.includes(key) || NAME_HEADER_ALIASES.includes(key),
  );
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;

  return dataRows
    .map((columns) =>
      resolveRecipientFromColumns(columns, looksLikeHeader ? headerKeys : null),
    )
    .filter((recipient): recipient is ExtensionRecipientInput =>
      Boolean(recipient && normalizeContactValue(recipient.contactValue)),
    );
}

export function sanitizeCampaignRecipients(recipients: ExtensionRecipientInput[]) {
  const unique = new Map<string, ExtensionRecipientInput>();

  for (const row of recipients) {
    const contactValue = normalizeContactValue(row.contactValue);
    if (!contactValue) continue;
    if (unique.has(contactValue)) continue;
    unique.set(contactValue, {
      ...row,
      contactValue,
      contactName: normalizeText(row.contactName) || null,
      externalKey: normalizeText(row.externalKey) || null,
    });
  }

  return Array.from(unique.values());
}

function campaignStats(campaign: ExtensionCampaignRecord) {
  const counts = campaign.recipients.reduce(
    (acc, recipient) => {
      acc.total += 1;
      acc[recipient.status] = (acc[recipient.status] ?? 0) + 1;
      return acc;
    },
    {
      total: 0,
      queued: 0,
      scheduled: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
    } as Record<string, number>,
  );

  return counts;
}

function serializeCampaign(campaign: ExtensionCampaignRecord) {
  const stats = campaignStats(campaign);
  const businessStatus = resolveExtensionCampaignBusinessStatus(campaign.status);
  const businessStatusLabel = resolveExtensionCampaignBusinessStatusLabel(campaign.status);

  return {
    id: campaign.id,
    campaignName: campaign.campaignName,
    channel: campaign.channel,
    status: campaign.status,
    businessStatus,
    businessStatusLabel,
    scheduleAt: campaign.scheduleAt?.toISOString() ?? null,
    batchSize: campaign.batchSize,
    messageTemplate: campaign.messageTemplate,
    messageDelayMs: campaign.messageDelayMs,
    mediaUrl: campaign.mediaUrl,
    notes: campaign.notes,
    meta: campaign.meta,
    completedAt: campaign.completedAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    stats,
    recipients: campaign.recipients.map((recipient) => ({
      id: recipient.id,
      contactValue: recipient.contactValue,
      contactName: recipient.contactName,
      externalKey: recipient.externalKey,
      scheduledFor: recipient.scheduledFor?.toISOString() ?? null,
      status: recipient.status,
      attemptedAt: recipient.attemptedAt?.toISOString() ?? null,
      sentAt: recipient.sentAt?.toISOString() ?? null,
      lastError: recipient.lastError,
      payload: recipient.payload,
      createdAt: recipient.createdAt.toISOString(),
      updatedAt: recipient.updatedAt.toISOString(),
      resolvedMessage: renderCampaignMessageTemplate(campaign.messageTemplate, recipient),
    })),
  };
}

export async function createExtensionCampaign(input: ExtensionCampaignInput) {
  if (isCloudflareRuntime()) {
    return createD1ExtensionCampaign(input);
  }

  const recipients = sanitizeCampaignRecipients(input.recipients);
  if (!recipients.length) {
    throw new Error("La campaña necesita al menos un destinatario válido.");
  }

  const now = new Date();
  const channel = resolveCampaignChannel(input.channel);
  const batchSize = Math.min(Math.max(input.batchSize ?? 25, 1), 200);
  const scheduleAt = normalizeScheduledAt(input.scheduleAt);
  const runnerHealth = isRunnerCampaignChannel(channel)
    ? await getExtensionRunnerHealth(input.userId, { now })
    : null;
  const initialStatus =
    channel === "test_mode"
      ? "draft"
      : channel === "manual_review"
        ? "blocked"
        : scheduleAt && scheduleAt.getTime() > now.getTime()
          ? "scheduled"
          : runnerHealth?.available
            ? "queued"
            : "waiting_runner";
  const messageTemplate = normalizeMultilineText(input.messageTemplate);
  const messageDelayMs = normalizeDelayMs(input.messageDelayMs);
  const mediaUrl = normalizeMediaUrl(input.mediaUrl);

  const campaign = await prisma.extensionCampaign.create({
    data: {
      ownerUserId: input.userId,
      campaignName: normalizeText(input.campaignName) || "Campaña extensión",
      channel,
      notes: normalizeMultilineText(input.notes) || null,
      batchSize,
      scheduleAt,
      status: initialStatus,
      messageTemplate: messageTemplate || null,
      messageDelayMs,
      mediaUrl,
      completedAt: isTerminalCampaignStatus(initialStatus) ? now : null,
      meta: toInputJson(input.meta),
      recipients: {
        create: recipients.map((recipient) => {
          const recipientSchedule = normalizeScheduledAt(recipient.scheduledFor) ?? scheduleAt;
          const recipientStatus =
            initialStatus === "draft"
              ? "queued"
              : initialStatus === "blocked"
                ? "queued"
                : recipientSchedule && recipientSchedule.getTime() > now.getTime()
                  ? "scheduled"
                  : "queued";

          return {
            contactValue: recipient.contactValue,
            contactName: recipient.contactName?.trim() || null,
            externalKey: recipient.externalKey?.trim() || null,
            scheduledFor: recipientSchedule,
            payload: toInputJson(recipient.payload),
            status: recipientStatus,
          };
        }),
      },
    },
    include: {
      recipients: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  await writeBusinessEventSafe({
    type: "EXTENSION_RUN_EVENT",
    userId: input.userId,
    subjectType: "extension_campaign",
    subjectId: campaign.id,
    metadata: {
      eventType: "campaign_created",
      campaignName: campaign.campaignName,
      recipientCount: recipients.length,
      status: campaign.status,
      channel: campaign.channel,
      hasMedia: Boolean(campaign.mediaUrl),
      delayMs: campaign.messageDelayMs,
      runnerStatus: runnerHealth?.status ?? null,
    },
  });

  await syncCampaignRecipientsToContacts({
    userId: input.userId,
    recipients,
    source: "extension_campaign",
  });

  return serializeCampaign(campaign);
}

export async function listExtensionCampaignsForUser(userId: string) {
  if (isCloudflareRuntime()) {
    return listD1ExtensionCampaignsForUser(userId);
  }

  const campaigns = await prisma.extensionCampaign.findMany({
    where: { ownerUserId: userId },
    orderBy: [{ createdAt: "desc" }],
    include: {
      recipients: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  return campaigns.map(serializeCampaign);
}

async function reconcileExtensionCampaignStatusesForUser(params: {
  userId: string;
  runner: ExtensionRunnerHealth;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const candidates = await prisma.extensionCampaign.findMany({
    where: {
      ownerUserId: params.userId,
      status: {
        in: ["queued", "scheduled", "running", "processing", "waiting_runner", "sent", "failed", "partial", "completed"],
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      status: true,
      scheduleAt: true,
      channel: true,
      completedAt: true,
    },
  });

  for (const campaign of candidates) {
    const pending = await countCampaignPendingRecipients(campaign.id, now);
    const channel = resolveCampaignChannel(campaign.channel);
    const currentStatus = String(campaign.status ?? "").trim().toLowerCase();
    let expectedStatus = currentStatus;

    if (!pending.totalPending) {
      const completion = await readCampaignCompletionSnapshot(campaign.id);
      expectedStatus = completion.status;
    } else if (campaign.scheduleAt && campaign.scheduleAt.getTime() > now.getTime() && pending.readyPending === 0) {
      expectedStatus = "scheduled";
    } else if (isRunnerCampaignChannel(channel)) {
      const claimedCount = await prisma.extensionCampaignRecipient.count({
        where: { campaignId: campaign.id, status: "claimed" },
      });
      expectedStatus = claimedCount > 0 ? "processing" : params.runner.available ? "queued" : "waiting_runner";
    }

    const expectsTerminal = isTerminalCampaignStatus(expectedStatus);
    const shouldUpdateStatus = expectedStatus !== currentStatus;
    const shouldUpdateCompletion =
      (expectsTerminal && !campaign.completedAt) || (!expectsTerminal && Boolean(campaign.completedAt));

    if (!shouldUpdateStatus && !shouldUpdateCompletion) {
      continue;
    }

    await prisma.extensionCampaign.update({
      where: { id: campaign.id },
      data: {
        status: expectedStatus,
        completedAt: expectsTerminal ? campaign.completedAt ?? now : null,
      },
    });
  }
}

export async function listExtensionCampaignsWithRunnerHealthForUser(userId: string) {
  if (isCloudflareRuntime()) {
    return listD1ExtensionCampaignsWithRunnerHealthForUser(userId);
  }

  const runner = await getExtensionRunnerHealth(userId);
  await reconcileExtensionCampaignStatusesForUser({ userId, runner });
  const campaigns = await listExtensionCampaignsForUser(userId);

  return {
    campaigns,
    runner,
  };
}

export async function claimExtensionCampaignBatch(params: {
  userId: string;
  campaignId?: string | null;
  now?: Date;
}) {
  if (isCloudflareRuntime()) {
    return claimD1ExtensionCampaignBatch(params);
  }

  const now = params.now ?? new Date();

  const campaign =
    params.campaignId
      ? await prisma.extensionCampaign.findFirst({
          where: {
            id: params.campaignId,
            ownerUserId: params.userId,
            status: { in: [...READY_CAMPAIGN_STATUSES] },
          },
        })
      : await prisma.extensionCampaign.findFirst({
          where: {
            ownerUserId: params.userId,
            status: { in: [...READY_CAMPAIGN_STATUSES] },
            OR: [{ scheduleAt: null }, { scheduleAt: { lte: now } }],
          },
          orderBy: [{ scheduleAt: "asc" }, { createdAt: "asc" }],
        });

  if (!campaign) return null;

  const channel = resolveCampaignChannel(campaign.channel);
  if (!isRunnerCampaignChannel(channel)) {
    return null;
  }

  let recipients = await prisma.extensionCampaignRecipient.findMany({
    where: {
      campaignId: campaign.id,
      status: { in: ["queued", "scheduled"] },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    take: campaign.batchSize,
  });

  if (!recipients.length) {
    const dynamicStaleClaimAfterMs = Math.max(
      STALE_CLAIM_AFTER_MS,
      Math.max(250, campaign.messageDelayMs ?? DEFAULT_CAMPAIGN_DELAY_MS) *
        Math.max(1, campaign.batchSize) *
        2,
    );
    const staleBefore = new Date(now.getTime() - dynamicStaleClaimAfterMs);
    const staleClaimed = await prisma.extensionCampaignRecipient.findMany({
      where: {
        campaignId: campaign.id,
        status: "claimed",
        OR: [{ attemptedAt: null }, { attemptedAt: { lte: staleBefore } }],
      },
      select: {
        id: true,
        scheduledFor: true,
      },
      take: 500,
    });

    if (staleClaimed.length > 0) {
      const queuedIds = staleClaimed
        .filter((recipient) => !recipient.scheduledFor || recipient.scheduledFor <= now)
        .map((recipient) => recipient.id);
      const scheduledIds = staleClaimed
        .filter((recipient) => recipient.scheduledFor && recipient.scheduledFor > now)
        .map((recipient) => recipient.id);

      await prisma.$transaction([
        ...(queuedIds.length
          ? [
              prisma.extensionCampaignRecipient.updateMany({
                where: { id: { in: queuedIds } },
                data: {
                  status: "queued",
                  attemptedAt: null,
                  lastError: null,
                },
              }),
            ]
          : []),
        ...(scheduledIds.length
          ? [
              prisma.extensionCampaignRecipient.updateMany({
                where: { id: { in: scheduledIds } },
                data: {
                  status: "scheduled",
                  attemptedAt: null,
                  lastError: null,
                },
              }),
            ]
          : []),
      ]);

      await writeBusinessEventSafe({
        type: "EXTENSION_RUN_EVENT",
        userId: params.userId,
        subjectType: "extension_campaign",
        subjectId: campaign.id,
        metadata: {
          eventType: "campaign_claims_released",
          campaignName: campaign.campaignName,
          releasedCount: staleClaimed.length,
          queuedCount: queuedIds.length,
          scheduledCount: scheduledIds.length,
          reason: "stale_claim_recovery",
        },
      });

      recipients = await prisma.extensionCampaignRecipient.findMany({
        where: {
          campaignId: campaign.id,
          status: { in: ["queued", "scheduled"] },
          OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
        },
        orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
        take: campaign.batchSize,
      });
    }
  }

  if (!recipients.length) {
    const { totalPending, readyPending } = await countCampaignPendingRecipients(campaign.id, now);

    if (totalPending === 0) {
      const completion = await readCampaignCompletionSnapshot(campaign.id);
      await prisma.extensionCampaign.update({
        where: { id: campaign.id },
        data: {
          status: completion.status,
          completedAt: now,
        },
      });
      return null;
    }

    if (
      campaign.scheduleAt &&
      campaign.scheduleAt.getTime() > now.getTime() &&
      readyPending === 0 &&
      campaign.status !== "scheduled"
    ) {
      await prisma.extensionCampaign.update({
        where: { id: campaign.id },
        data: { status: "scheduled", completedAt: null },
      });
    }

    return null;
  }

  await prisma.$transaction([
    prisma.extensionCampaign.update({
      where: { id: campaign.id },
      data: { status: "processing", completedAt: null },
    }),
    prisma.extensionCampaignRecipient.updateMany({
      where: { id: { in: recipients.map((recipient) => recipient.id) } },
      data: {
        status: "claimed",
        attemptedAt: now,
      },
    }),
  ]);

  await writeBusinessEventSafe({
    type: "EXTENSION_RUN_EVENT",
    userId: params.userId,
    subjectType: "extension_campaign",
    subjectId: campaign.id,
    metadata: {
      eventType: "campaign_claimed",
      campaignName: campaign.campaignName,
      batchSize: recipients.length,
      channel,
    },
  });

  return {
    campaign: {
      id: campaign.id,
      campaignName: campaign.campaignName,
      batchSize: campaign.batchSize,
      status: "processing",
      channel,
      messageTemplate: campaign.messageTemplate,
      messageDelayMs: campaign.messageDelayMs,
      mediaUrl: campaign.mediaUrl,
      scheduleAt: campaign.scheduleAt?.toISOString() ?? null,
      notes: campaign.notes,
      meta: campaign.meta,
    },
    recipients: recipients.map((recipient: ExtensionCampaignRecipientRecord) => ({
      id: recipient.id,
      contactValue: recipient.contactValue,
      contactName: recipient.contactName,
      externalKey: recipient.externalKey,
      scheduledFor: recipient.scheduledFor?.toISOString() ?? null,
      payload: recipient.payload,
      resolvedMessage: renderCampaignMessageTemplate(campaign.messageTemplate, recipient),
      messageDelayMs: campaign.messageDelayMs,
      mediaUrl: campaign.mediaUrl,
    })),
  };
}

function normalizeDispatchStep(value: unknown) {
  const normalized = normalizeText(typeof value === "string" ? value : String(value ?? ""));
  return normalized ? normalized.slice(0, 80) : null;
}

function normalizeDispatchDelayMs(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(10 * 60_000, Math.round(numeric)));
}

function normalizeMediaInsertionStrategy(value: unknown) {
  const normalized = normalizeText(typeof value === "string" ? value : String(value ?? ""));
  if (normalized === "preview_first" || normalized === "composer_first") return normalized;
  return normalized ? normalized.slice(0, 60) : null;
}

export async function recordExtensionCampaignDispatch(params: {
  userId: string;
  campaignId: string;
  results: Array<{
    recipientId: string;
    status: "sent" | "failed" | "queued";
    error?: string | null;
    step?: string | null;
    delayMs?: number | null;
    mediaInsertionStrategy?: string | null;
    attachmentSummary?: unknown;
    metaJson?: unknown;
  }>;
}) {
  if (isCloudflareRuntime()) {
    return recordD1ExtensionCampaignDispatch(params);
  }

  if (!params.results.length) {
    const campaign = await prisma.extensionCampaign.findUnique({
      where: { id: params.campaignId },
      include: {
        recipients: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    return campaign ? serializeCampaign(campaign) : null;
  }

  await prisma.$transaction(
    params.results.map((result) =>
      prisma.extensionCampaignRecipient.update({
        where: { id: result.recipientId },
        data: {
          status: result.status,
          sentAt: result.status === "sent" ? new Date() : null,
          lastError: result.error?.trim() || null,
        },
      }),
    ),
  );

  const [currentCampaign, pending] = await Promise.all([
    prisma.extensionCampaign.findUnique({
      where: { id: params.campaignId },
      select: {
        id: true,
        status: true,
        scheduleAt: true,
        channel: true,
      },
    }),
    countCampaignPendingRecipients(params.campaignId),
  ]);

  const channel = resolveCampaignChannel(currentCampaign?.channel);
  let nextStatus: string;

  if (!pending.totalPending) {
    const completion = await readCampaignCompletionSnapshot(params.campaignId);
    nextStatus = completion.status;
  } else if (currentCampaign?.status === "paused") {
    nextStatus = "paused";
  } else if (
    currentCampaign?.scheduleAt &&
    currentCampaign.scheduleAt.getTime() > Date.now() &&
    pending.readyPending === 0
  ) {
    nextStatus = "scheduled";
  } else if (isRunnerCampaignChannel(channel)) {
    const runner = await getExtensionRunnerHealth(params.userId);
    nextStatus = runner.available ? "processing" : "waiting_runner";
  } else {
    nextStatus = currentCampaign?.status ?? "queued";
  }

  const campaign = await prisma.extensionCampaign.update({
    where: { id: params.campaignId },
    data: {
      status: nextStatus,
      completedAt: isTerminalCampaignStatus(nextStatus) ? new Date() : null,
    },
    include: {
      recipients: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  await writeBusinessEventSafe({
    type: "EXTENSION_RUN_EVENT",
    userId: params.userId,
    subjectType: "extension_campaign",
    subjectId: params.campaignId,
    metadata: {
      eventType: "campaign_dispatch_recorded",
      campaignName: campaign.campaignName,
      completed: isTerminalCampaignStatus(nextStatus),
      status: nextStatus,
      sentCount: params.results.filter((item) => item.status === "sent").length,
      failedCount: params.results.filter((item) => item.status === "failed").length,
      results: params.results.map((item) => ({
        recipientId: item.recipientId,
        status: item.status,
        error: item.error ?? null,
        step: normalizeDispatchStep(item.step),
        delayMs: normalizeDispatchDelayMs(item.delayMs),
        mediaInsertionStrategy: normalizeMediaInsertionStrategy(item.mediaInsertionStrategy),
        attachmentSummary: item.attachmentSummary ?? null,
        metaJson: item.metaJson ?? null,
      })),
    },
  });

  await Promise.all(
    params.results.map((item) =>
      writeBusinessEventSafe({
        type: "EXTENSION_RUN_EVENT",
        userId: params.userId,
        subjectType: "extension_campaign_recipient",
        subjectId: item.recipientId,
        metadata: {
          eventType: "campaign_dispatch_result",
          campaignId: params.campaignId,
          campaignName: campaign.campaignName,
          status: item.status,
          error: item.error ?? null,
          step: normalizeDispatchStep(item.step),
          delayMs: normalizeDispatchDelayMs(item.delayMs),
          mediaInsertionStrategy: normalizeMediaInsertionStrategy(item.mediaInsertionStrategy),
          attachmentSummary: item.attachmentSummary ?? null,
          metaJson: item.metaJson ?? null,
        },
      }),
    ),
  );

  await recordCampaignDispatchForContacts({
    userId: params.userId,
    campaignId: params.campaignId,
    results: params.results,
    resolveMessage: (recipient) =>
      renderCampaignMessageTemplate(campaign.messageTemplate, recipient),
  });

  return serializeCampaign(campaign);
}

export async function pauseExtensionCampaign(params: {
  userId: string;
  campaignId: string;
  now?: Date;
  force?: boolean;
}) {
  if (isCloudflareRuntime()) {
    return pauseD1ExtensionCampaign(params);
  }

  const now = params.now ?? new Date();
  const campaign = await prisma.extensionCampaign.findFirst({
    where: {
      id: params.campaignId,
      ownerUserId: params.userId,
    },
    include: {
      recipients: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!campaign) {
    throw new Error("La campaña solicitada ya no existe.");
  }

  if (isTerminalCampaignStatus(campaign.status) || campaign.status === "draft") {
    return serializeCampaign(campaign);
  }

  if (campaign.status === "paused" && !params.force) {
    return serializeCampaign(campaign);
  }

  const claimedRecipients = campaign.recipients.filter(
    (recipient) => recipient.status === "claimed",
  );

  await prisma.$transaction([
    prisma.extensionCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "paused",
        completedAt: null,
      },
    }),
    ...(claimedRecipients.length
      ? [
          prisma.extensionCampaignRecipient.updateMany({
            where: {
              id: {
                in: claimedRecipients
                  .filter((recipient) => nextRecipientPendingStatus(recipient, now) === "queued")
                  .map((recipient) => recipient.id),
              },
            },
            data: {
              status: "queued",
              attemptedAt: null,
              lastError: null,
            },
          }),
          prisma.extensionCampaignRecipient.updateMany({
            where: {
              id: {
                in: claimedRecipients
                  .filter(
                    (recipient) => nextRecipientPendingStatus(recipient, now) === "scheduled",
                  )
                  .map((recipient) => recipient.id),
              },
            },
            data: {
              status: "scheduled",
              attemptedAt: null,
              lastError: null,
            },
          }),
        ]
      : []),
  ]);

  const refreshed = await prisma.extensionCampaign.findUnique({
    where: { id: campaign.id },
    include: {
      recipients: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!refreshed) {
    throw new Error("No fue posible refrescar la campaña pausada.");
  }

  await writeBusinessEventSafe({
    type: "EXTENSION_RUN_EVENT",
    userId: params.userId,
    subjectType: "extension_campaign",
    subjectId: campaign.id,
    metadata: {
      eventType: "campaign_paused",
      campaignName: refreshed.campaignName,
      revertedClaimedRecipients: claimedRecipients.length,
      forced: Boolean(params.force),
    },
  });

  return serializeCampaign(refreshed);
}

export async function forcePauseExtensionCampaign(params: {
  userId: string;
  campaignId: string;
  now?: Date;
}) {
  return pauseExtensionCampaign({
    userId: params.userId,
    campaignId: params.campaignId,
    now: params.now,
    force: true,
  });
}

export async function resumeExtensionCampaign(params: {
  userId: string;
  campaignId: string;
  now?: Date;
}) {
  if (isCloudflareRuntime()) {
    return resumeD1ExtensionCampaign(params);
  }

  const now = params.now ?? new Date();
  const campaign = await prisma.extensionCampaign.findFirst({
    where: {
      id: params.campaignId,
      ownerUserId: params.userId,
    },
    include: {
      recipients: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!campaign) {
    throw new Error("La campaña solicitada ya no existe.");
  }

  if (isTerminalCampaignStatus(campaign.status)) {
    return serializeCampaign(campaign);
  }

  const channel = resolveCampaignChannel(campaign.channel);
  if (!isRunnerCampaignChannel(channel)) {
    throw new Error(
      "La campaña usa un canal sin runner automático. Cambia el transporte desde la web para continuar.",
    );
  }

  const { totalPending, readyPending } = await countCampaignPendingRecipients(campaign.id, now);
  const runnerHealth = await getExtensionRunnerHealth(params.userId, { now });
  const nextStatus = !totalPending
    ? (await readCampaignCompletionSnapshot(campaign.id)).status
    : campaign.scheduleAt && campaign.scheduleAt.getTime() > now.getTime() && readyPending === 0
      ? "scheduled"
      : runnerHealth.available
        ? "queued"
        : "waiting_runner";

  const refreshed = await prisma.extensionCampaign.update({
    where: { id: campaign.id },
    data: {
      status: nextStatus,
      completedAt: isTerminalCampaignStatus(nextStatus) ? campaign.completedAt ?? now : null,
    },
    include: {
      recipients: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  await writeBusinessEventSafe({
    type: "EXTENSION_RUN_EVENT",
    userId: params.userId,
    subjectType: "extension_campaign",
    subjectId: campaign.id,
    metadata: {
      eventType: "campaign_resumed",
      campaignName: refreshed.campaignName,
      nextStatus,
      channel,
      runnerStatus: runnerHealth.status,
    },
  });

  return serializeCampaign(refreshed);
}

export async function deleteExtensionCampaignForUser(params: {
  userId: string;
  campaignId: string;
}) {
  if (isCloudflareRuntime()) {
    return deleteD1ExtensionCampaignForUser(params);
  }

  const campaign = await prisma.extensionCampaign.findFirst({
    where: {
      id: params.campaignId,
      ownerUserId: params.userId,
    },
    include: {
      recipients: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!campaign) {
    throw new Error("La campaña solicitada ya no existe.");
  }

  if (
    !["paused", "completed", "sent", "failed", "partial", "blocked", "draft"].includes(
      campaign.status,
    )
  ) {
    throw new Error(
      "Solo puedes eliminar campañas pausadas, bloqueadas o cerradas (sent/failed/partial).",
    );
  }

  await prisma.extensionCampaign.delete({
    where: { id: campaign.id },
  });

  await writeBusinessEventSafe({
    type: "EXTENSION_RUN_EVENT",
    userId: params.userId,
    subjectType: "extension_campaign",
    subjectId: campaign.id,
    metadata: {
      eventType: "campaign_deleted",
      campaignName: campaign.campaignName,
      recipientCount: campaign.recipients.length,
      previousStatus: campaign.status,
    },
  });

  return {
    id: campaign.id,
    campaignName: campaign.campaignName,
  };
}
