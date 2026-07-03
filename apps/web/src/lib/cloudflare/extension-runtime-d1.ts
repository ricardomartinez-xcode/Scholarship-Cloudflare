import { d1All, d1First, d1Run, parseD1Json, type D1Value } from "@/lib/cloudflare/d1";
import { renderCampaignMessageTemplate } from "@/lib/extension-campaign-template";

import type {
  ExtensionCampaignChannel,
  ExtensionCampaignInput,
  ExtensionRecipientInput,
  ExtensionRunnerHealth,
} from "@/lib/extension-automation";

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

type BusinessEventInput = {
  type: string;
  userId?: string | null;
  quoteSessionId?: string | null;
  quoteScenarioId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  metadata?: unknown;
};

type D1CampaignRow = {
  id: string;
  owner_user_id: string;
  campaign_name: string;
  channel: string;
  status: string;
  schedule_at: string | null;
  batch_size: number;
  message_template: string | null;
  message_delay_ms: number | null;
  media_url: string | null;
  notes: string | null;
  meta: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type D1RecipientRow = {
  id: string;
  campaign_id: string;
  external_key: string | null;
  contact_value: string;
  contact_name: string | null;
  payload: string | null;
  scheduled_for: string | null;
  status: string;
  attempted_at: string | null;
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type D1ExtensionCampaignAdminRow = {
  id: string;
  owner_user_id: string;
  owner_email: string | null;
  owner_display_name: string | null;
  campaign_name: string;
  channel: string;
  status: string;
  meta: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  total: number | null;
  queued: number | null;
  scheduled: number | null;
  claimed: number | null;
  sent: number | null;
  failed: number | null;
};

type D1ExtensionRunEventRow = {
  user_id: string | null;
  created_at: string;
  subject_id: string | null;
  metadata: string | null;
};

type D1CampaignRecord = ReturnType<typeof mapD1Campaign> & {
  recipients: ReturnType<typeof mapD1Recipient>[];
};

let extensionRuntimeSchemaPromise: Promise<void> | null = null;

function nowIso(date = new Date()) {
  return date.toISOString();
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function toIso(value: string | Date | null | undefined) {
  return toDate(value)?.toISOString() ?? null;
}

function json(value: unknown) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

function placeholders(values: unknown[]) {
  return values.map(() => "?").join(", ");
}

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
  if (!looksLikePhone) return normalized.replace(/\s+/g, " ");
  const hasPlus = normalized.startsWith("+");
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
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CAMPAIGN_DELAY_MS;
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
  const normalized = normalizeText(value).toLowerCase();
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

function resolveExtensionCampaignCompletionStatus(params: {
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

function resolveExtensionCampaignBusinessStatus(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "partial") return "completed_with_issues" as const;
  if (normalized === "sent" || normalized === "completed") return "completed" as const;
  if (!normalized) return "queued" as const;
  return normalized;
}

function resolveExtensionCampaignBusinessStatusLabel(status: string | null | undefined) {
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

function sanitizeCampaignRecipients(recipients: ExtensionRecipientInput[]) {
  const unique = new Map<string, ExtensionRecipientInput>();
  for (const row of recipients) {
    const contactValue = normalizeContactValue(row.contactValue);
    if (!contactValue || unique.has(contactValue)) continue;
    unique.set(contactValue, {
      ...row,
      contactValue,
      contactName: normalizeText(row.contactName) || null,
      externalKey: normalizeText(row.externalKey) || null,
    });
  }
  return Array.from(unique.values());
}

function mapD1Campaign(row: D1CampaignRow) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    campaignName: row.campaign_name,
    channel: row.channel,
    status: row.status,
    scheduleAt: toDate(row.schedule_at),
    batchSize: Number(row.batch_size ?? 25),
    messageTemplate: row.message_template,
    messageDelayMs: Number(row.message_delay_ms ?? DEFAULT_CAMPAIGN_DELAY_MS),
    mediaUrl: row.media_url,
    notes: row.notes,
    meta: parseD1Json<Record<string, unknown> | null>(row.meta, null),
    completedAt: toDate(row.completed_at),
    createdAt: toDate(row.created_at) ?? new Date(),
    updatedAt: toDate(row.updated_at) ?? new Date(),
  };
}

function mapD1Recipient(row: D1RecipientRow) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    externalKey: row.external_key,
    contactValue: row.contact_value,
    contactName: row.contact_name,
    payload: parseD1Json<Record<string, unknown> | null>(row.payload, null),
    scheduledFor: toDate(row.scheduled_for),
    status: row.status,
    attemptedAt: toDate(row.attempted_at),
    sentAt: toDate(row.sent_at),
    lastError: row.last_error,
    createdAt: toDate(row.created_at) ?? new Date(),
    updatedAt: toDate(row.updated_at) ?? new Date(),
  };
}

function campaignStats(campaign: D1CampaignRecord) {
  return campaign.recipients.reduce(
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
}

function serializeD1Campaign(campaign: D1CampaignRecord) {
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

function readRunnerEventType(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return normalizeText(String((metadata as Record<string, unknown>).eventType ?? "")).toLowerCase();
}

function sanitizeRunnerStaleAfterMs(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return DEFAULT_RUNNER_STALE_AFTER_MS;
  const candidate = Math.round(Number(value));
  return Math.min(Math.max(candidate, 30_000), 30 * 60_000);
}

function nextRecipientPendingStatus(
  recipient: Pick<ReturnType<typeof mapD1Recipient>, "scheduledFor">,
  now: Date,
) {
  return recipient.scheduledFor && recipient.scheduledFor.getTime() > now.getTime()
    ? "scheduled"
    : "queued";
}

function normalizeDispatchStep(value: unknown) {
  const normalized = normalizeText(typeof value === "string" ? value : String(value ?? ""));
  return normalized ? normalized.slice(0, 80) : null;
}

function normalizeDispatchDelayMs(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(Math.max(Math.round(numeric), 0), 30 * 60_000);
}

function normalizeMediaInsertionStrategy(value: unknown) {
  const normalized = normalizeText(typeof value === "string" ? value : String(value ?? ""));
  if (normalized === "preview_first" || normalized === "composer_first") return normalized;
  return normalized ? normalized.slice(0, 60) : null;
}

export async function ensureD1ExtensionRuntimeSchema() {
  extensionRuntimeSchemaPromise ??= (async () => {
    await d1Run(
      `CREATE TABLE IF NOT EXISTS business_event (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        user_id TEXT,
        quote_session_id TEXT,
        quote_scenario_id TEXT,
        subject_type TEXT,
        subject_id TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    await d1Run(
      "CREATE INDEX IF NOT EXISTS business_event_type_created_idx ON business_event(type, created_at)",
    );
    await d1Run(
      "CREATE INDEX IF NOT EXISTS business_event_user_created_idx ON business_event(user_id, created_at)",
    );
    await d1Run(
      "CREATE INDEX IF NOT EXISTS business_event_subject_created_idx ON business_event(subject_type, subject_id, created_at)",
    );
    await d1Run(
      `CREATE TABLE IF NOT EXISTS extension_campaign (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        campaign_name TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'whatsapp_web',
        status TEXT NOT NULL DEFAULT 'queued',
        schedule_at TEXT,
        batch_size INTEGER NOT NULL DEFAULT 25,
        message_template TEXT,
        message_delay_ms INTEGER NOT NULL DEFAULT 4000,
        media_url TEXT,
        notes TEXT,
        meta TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_user_id) REFERENCES cloudflare_auth_user(id) ON DELETE CASCADE
      )`,
    );
    await d1Run(
      "CREATE INDEX IF NOT EXISTS extension_campaign_owner_updated_idx ON extension_campaign(owner_user_id, updated_at)",
    );
    await d1Run(
      "CREATE INDEX IF NOT EXISTS extension_campaign_status_schedule_idx ON extension_campaign(status, schedule_at)",
    );
    await d1Run(
      `CREATE TABLE IF NOT EXISTS extension_campaign_recipient (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        external_key TEXT,
        contact_value TEXT NOT NULL,
        contact_name TEXT,
        payload TEXT,
        scheduled_for TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        attempted_at TEXT,
        sent_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES extension_campaign(id) ON DELETE CASCADE,
        UNIQUE (campaign_id, contact_value)
      )`,
    );
    await d1Run(
      "CREATE INDEX IF NOT EXISTS extension_campaign_recipient_claim_idx ON extension_campaign_recipient(campaign_id, status, scheduled_for)",
    );
  })();

  return extensionRuntimeSchemaPromise;
}

export async function writeD1BusinessEvent(params: BusinessEventInput) {
  await ensureD1ExtensionRuntimeSchema();
  await d1Run(
    `INSERT INTO business_event
      (id, type, user_id, quote_session_id, quote_scenario_id, subject_type, subject_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      params.type,
      params.userId ?? null,
      params.quoteSessionId ?? null,
      params.quoteScenarioId ?? null,
      params.subjectType ?? null,
      params.subjectId ?? null,
      json(params.metadata),
      nowIso(),
    ],
  );
}

async function getCampaignWithRecipients(campaignId: string) {
  await ensureD1ExtensionRuntimeSchema();
  const campaignRow = await d1First<D1CampaignRow>(
    "SELECT * FROM extension_campaign WHERE id = ? LIMIT 1",
    [campaignId],
  );
  if (!campaignRow) return null;
  const recipientRows = await d1All<D1RecipientRow>(
    "SELECT * FROM extension_campaign_recipient WHERE campaign_id = ? ORDER BY created_at ASC",
    [campaignId],
  );
  return {
    ...mapD1Campaign(campaignRow),
    recipients: recipientRows.map(mapD1Recipient),
  };
}

async function readCampaignCompletionSnapshot(campaignId: string) {
  await ensureD1ExtensionRuntimeSchema();
  const rows = await d1All<{ status: string; total: number }>(
    `SELECT status, COUNT(*) AS total
     FROM extension_campaign_recipient
     WHERE campaign_id = ?
     GROUP BY status`,
    [campaignId],
  );
  const count = (status: string) =>
    Number(rows.find((row) => row.status === status)?.total ?? 0);
  const totalRecipients = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const sentRecipients = count("sent");
  const failedRecipients = count("failed");
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

async function countCampaignPendingRecipients(campaignId: string, now = new Date()) {
  await ensureD1ExtensionRuntimeSchema();
  const totalPending = await d1First<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM extension_campaign_recipient
     WHERE campaign_id = ?
       AND status IN (${placeholders([...PENDING_RECIPIENT_STATUSES])})`,
    [campaignId, ...PENDING_RECIPIENT_STATUSES],
  );
  const readyPending = await d1First<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM extension_campaign_recipient
     WHERE campaign_id = ?
       AND status IN ('queued', 'scheduled')
       AND (scheduled_for IS NULL OR scheduled_for <= ?)`,
    [campaignId, nowIso(now)],
  );
  return {
    totalPending: Number(totalPending?.total ?? 0),
    readyPending: Number(readyPending?.total ?? 0),
  };
}

export async function getD1ExtensionRunnerHealth(
  userId: string,
  options?: { now?: Date; staleAfterMs?: number },
): Promise<ExtensionRunnerHealth> {
  await ensureD1ExtensionRuntimeSchema();
  const now = options?.now ?? new Date();
  const staleAfterMs = sanitizeRunnerStaleAfterMs(options?.staleAfterMs);
  const lookbackStart = new Date(
    now.getTime() - Math.max(staleAfterMs * 8, 24 * 60 * 60 * 1000),
  );

  const events = await d1All<{
    created_at: string;
    subject_id: string | null;
    metadata: string | null;
  }>(
    `SELECT created_at, subject_id, metadata
     FROM business_event
     WHERE user_id = ? AND type = 'EXTENSION_RUN_EVENT' AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT 120`,
    [userId, nowIso(lookbackStart)],
  );

  const latestHeartbeat = events.find((event) => {
    const eventType = readRunnerEventType(parseD1Json(event.metadata, null));
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

  const lastHeartbeatAt = toDate(latestHeartbeat.created_at) ?? now;
  const lastHeartbeatAgeMs = Math.max(0, now.getTime() - lastHeartbeatAt.getTime());
  const status = lastHeartbeatAgeMs <= staleAfterMs ? "online" : "stale";
  const lastEventType = readRunnerEventType(parseD1Json(latestHeartbeat.metadata, null));

  return {
    available: status === "online",
    isHealthy: status === "online",
    status,
    staleAfterMs,
    lastHeartbeatAt: lastHeartbeatAt.toISOString(),
    lastHeartbeatAgeMs,
    lastEventType,
    lastRunId: latestHeartbeat.subject_id ?? null,
    message:
      status === "online"
        ? "Runner de extensión operativo."
        : "Runner detectado, pero sin heartbeat reciente.",
  };
}

export async function createD1ExtensionCampaign(input: ExtensionCampaignInput) {
  await ensureD1ExtensionRuntimeSchema();
  const recipients = sanitizeCampaignRecipients(input.recipients);
  if (!recipients.length) {
    throw new Error("La campaña necesita al menos un destinatario válido.");
  }

  const now = new Date();
  const timestamp = nowIso(now);
  const channel = resolveCampaignChannel(input.channel);
  const batchSize = Math.min(Math.max(input.batchSize ?? 25, 1), 200);
  const scheduleAt = normalizeScheduledAt(input.scheduleAt);
  const runnerHealth = isRunnerCampaignChannel(channel)
    ? await getD1ExtensionRunnerHealth(input.userId, { now })
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
  const campaignId = crypto.randomUUID();
  const messageTemplate = normalizeMultilineText(input.messageTemplate);
  const messageDelayMs = normalizeDelayMs(input.messageDelayMs);
  const mediaUrl = normalizeMediaUrl(input.mediaUrl);

  await d1Run(
    `INSERT INTO extension_campaign
      (id, owner_user_id, campaign_name, channel, status, schedule_at, batch_size,
       message_template, message_delay_ms, media_url, notes, meta, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      campaignId,
      input.userId,
      normalizeText(input.campaignName) || "Campaña extensión",
      channel,
      initialStatus,
      toIso(scheduleAt),
      batchSize,
      messageTemplate || null,
      messageDelayMs,
      mediaUrl,
      normalizeMultilineText(input.notes) || null,
      json(input.meta),
      isTerminalCampaignStatus(initialStatus) ? timestamp : null,
      timestamp,
      timestamp,
    ],
  );

  for (const recipient of recipients) {
    const recipientSchedule = normalizeScheduledAt(recipient.scheduledFor) ?? scheduleAt;
    const recipientStatus =
      initialStatus === "draft" || initialStatus === "blocked"
        ? "queued"
        : recipientSchedule && recipientSchedule.getTime() > now.getTime()
          ? "scheduled"
          : "queued";

    await d1Run(
      `INSERT OR IGNORE INTO extension_campaign_recipient
        (id, campaign_id, external_key, contact_value, contact_name, payload, scheduled_for,
         status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        campaignId,
        recipient.externalKey?.trim() || null,
        recipient.contactValue,
        recipient.contactName?.trim() || null,
        json(recipient.payload),
        toIso(recipientSchedule),
        recipientStatus,
        timestamp,
        timestamp,
      ],
    );
  }

  const campaign = await getCampaignWithRecipients(campaignId);
  if (!campaign) throw new Error("No fue posible crear la campaña de extensión.");

  await writeD1BusinessEvent({
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

  return serializeD1Campaign(campaign);
}

export async function listD1ExtensionCampaignsForUser(userId: string) {
  await ensureD1ExtensionRuntimeSchema();
  const rows = await d1All<D1CampaignRow>(
    "SELECT * FROM extension_campaign WHERE owner_user_id = ? ORDER BY created_at DESC",
    [userId],
  );
  const campaigns = await Promise.all(rows.map((row) => getCampaignWithRecipients(row.id)));
  return campaigns
    .filter((campaign): campaign is D1CampaignRecord => Boolean(campaign))
    .map((campaign) => serializeD1Campaign(campaign));
}

async function reconcileD1ExtensionCampaignStatusesForUser(params: {
  userId: string;
  runner: ExtensionRunnerHealth;
  now?: Date;
}) {
  await ensureD1ExtensionRuntimeSchema();
  const now = params.now ?? new Date();
  const rows = await d1All<D1CampaignRow>(
    `SELECT *
     FROM extension_campaign
     WHERE owner_user_id = ?
       AND status IN ('queued', 'scheduled', 'running', 'processing', 'waiting_runner', 'sent', 'failed', 'partial', 'completed')
     ORDER BY updated_at DESC
     LIMIT 200`,
    [params.userId],
  );

  for (const campaign of rows.map(mapD1Campaign)) {
    const pending = await countCampaignPendingRecipients(campaign.id, now);
    const channel = resolveCampaignChannel(campaign.channel);
    const currentStatus = normalizeText(campaign.status).toLowerCase();
    let expectedStatus = currentStatus;

    if (!pending.totalPending) {
      expectedStatus = (await readCampaignCompletionSnapshot(campaign.id)).status;
    } else if (
      campaign.scheduleAt &&
      campaign.scheduleAt.getTime() > now.getTime() &&
      pending.readyPending === 0
    ) {
      expectedStatus = "scheduled";
    } else if (isRunnerCampaignChannel(channel)) {
      const claimedCount = await d1First<{ total: number }>(
        "SELECT COUNT(*) AS total FROM extension_campaign_recipient WHERE campaign_id = ? AND status = 'claimed'",
        [campaign.id],
      );
      expectedStatus =
        Number(claimedCount?.total ?? 0) > 0
          ? "processing"
          : params.runner.available
            ? "queued"
            : "waiting_runner";
    }

    const expectsTerminal = isTerminalCampaignStatus(expectedStatus);
    const shouldUpdateStatus = expectedStatus !== currentStatus;
    const shouldUpdateCompletion =
      (expectsTerminal && !campaign.completedAt) ||
      (!expectsTerminal && Boolean(campaign.completedAt));
    if (!shouldUpdateStatus && !shouldUpdateCompletion) continue;

    await d1Run(
      "UPDATE extension_campaign SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?",
      [
        expectedStatus,
        expectsTerminal ? toIso(campaign.completedAt ?? now) : null,
        nowIso(now),
        campaign.id,
      ],
    );
  }
}

export async function listD1ExtensionCampaignsWithRunnerHealthForUser(userId: string) {
  const runner = await getD1ExtensionRunnerHealth(userId);
  await reconcileD1ExtensionCampaignStatusesForUser({ userId, runner });
  const campaigns = await listD1ExtensionCampaignsForUser(userId);
  return { campaigns, runner };
}

export type D1ExtensionCampaignAdminSummary = {
  id: string;
  campaignName: string;
  ownerUserId: string;
  ownerEmail: string | null;
  ownerDisplayName: string | null;
  channel: string;
  status: string;
  businessStatus: string;
  businessStatusLabel: string;
  extensionVersion: string | null;
  lastHeartbeatAt: string | null;
  lastActivityAt: string;
  lastEventType: string | null;
  lastRunId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  stats: {
    total: number;
    queued: number;
    scheduled: number;
    claimed: number;
    sent: number;
    failed: number;
  };
};

function readExtensionVersion(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const value = (meta as Record<string, unknown>).extensionVersion;
  const normalized = normalizeText(typeof value === "string" ? value : String(value ?? ""));
  return normalized || null;
}

function mapLatestEventsByUser(events: D1ExtensionRunEventRow[]) {
  const latestByUser = new Map<string, {
    createdAt: string;
    eventType: string | null;
    runId: string | null;
    extensionVersion: string | null;
  }>();
  const latestHeartbeatByUser = new Map<string, string>();

  for (const event of events) {
    if (!event.user_id) continue;
    const metadata = parseD1Json<Record<string, unknown> | null>(event.metadata, null);
    const eventType = readRunnerEventType(metadata);
    if (!latestByUser.has(event.user_id)) {
      latestByUser.set(event.user_id, {
        createdAt: event.created_at,
        eventType,
        runId: event.subject_id,
        extensionVersion: readExtensionVersion(metadata),
      });
    }
    if (eventType === "runner_heartbeat" && !latestHeartbeatByUser.has(event.user_id)) {
      latestHeartbeatByUser.set(event.user_id, event.created_at);
    }
  }

  return { latestByUser, latestHeartbeatByUser };
}

export async function listD1ExtensionCampaignAdminRows(limit = 100) {
  await ensureD1ExtensionRuntimeSchema();
  const rows = await d1All<D1ExtensionCampaignAdminRow>(
    `SELECT
       c.id,
       c.owner_user_id,
       u.email AS owner_email,
       u.display_name AS owner_display_name,
       c.campaign_name,
       c.channel,
       c.status,
       c.meta,
       c.created_at,
       c.updated_at,
       c.completed_at,
       (SELECT COUNT(*) FROM extension_campaign_recipient r WHERE r.campaign_id = c.id) AS total,
       (SELECT COUNT(*) FROM extension_campaign_recipient r WHERE r.campaign_id = c.id AND r.status = 'queued') AS queued,
       (SELECT COUNT(*) FROM extension_campaign_recipient r WHERE r.campaign_id = c.id AND r.status = 'scheduled') AS scheduled,
       (SELECT COUNT(*) FROM extension_campaign_recipient r WHERE r.campaign_id = c.id AND r.status = 'claimed') AS claimed,
       (SELECT COUNT(*) FROM extension_campaign_recipient r WHERE r.campaign_id = c.id AND r.status = 'sent') AS sent,
       (SELECT COUNT(*) FROM extension_campaign_recipient r WHERE r.campaign_id = c.id AND r.status = 'failed') AS failed
     FROM extension_campaign c
     LEFT JOIN cloudflare_auth_user u ON u.id = c.owner_user_id
     ORDER BY c.updated_at DESC
     LIMIT ?`,
    [Math.min(Math.max(limit, 1), 250)],
  );

  const userIds = Array.from(new Set(rows.map((row) => row.owner_user_id).filter(Boolean)));
  const events = userIds.length
    ? await d1All<D1ExtensionRunEventRow>(
        `SELECT user_id, created_at, subject_id, metadata
           FROM business_event
          WHERE type = 'EXTENSION_RUN_EVENT'
            AND user_id IN (${placeholders(userIds)})
          ORDER BY created_at DESC
          LIMIT 500`,
        userIds,
      )
    : [];
  const { latestByUser, latestHeartbeatByUser } = mapLatestEventsByUser(events);

  return rows.map((row): D1ExtensionCampaignAdminSummary => {
    const campaignMeta = parseD1Json<Record<string, unknown> | null>(row.meta, null);
    const latestEvent = latestByUser.get(row.owner_user_id) ?? null;
    return {
      id: row.id,
      campaignName: row.campaign_name,
      ownerUserId: row.owner_user_id,
      ownerEmail: row.owner_email,
      ownerDisplayName: row.owner_display_name,
      channel: row.channel,
      status: row.status,
      businessStatus: resolveExtensionCampaignBusinessStatus(row.status),
      businessStatusLabel: resolveExtensionCampaignBusinessStatusLabel(row.status),
      extensionVersion:
        readExtensionVersion(campaignMeta) ?? latestEvent?.extensionVersion ?? null,
      lastHeartbeatAt: latestHeartbeatByUser.get(row.owner_user_id) ?? null,
      lastActivityAt: latestEvent?.createdAt ?? row.updated_at,
      lastEventType: latestEvent?.eventType ?? null,
      lastRunId: latestEvent?.runId ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      stats: {
        total: Number(row.total ?? 0),
        queued: Number(row.queued ?? 0),
        scheduled: Number(row.scheduled ?? 0),
        claimed: Number(row.claimed ?? 0),
        sent: Number(row.sent ?? 0),
        failed: Number(row.failed ?? 0),
      },
    };
  });
}

export async function claimD1ExtensionCampaignBatch(params: {
  userId: string;
  campaignId?: string | null;
  now?: Date;
}) {
  await ensureD1ExtensionRuntimeSchema();
  const now = params.now ?? new Date();
  const timestamp = nowIso(now);
  const readyStatuses = [...READY_CAMPAIGN_STATUSES];
  const values: D1Value[] = params.campaignId
    ? [params.campaignId, params.userId, ...readyStatuses]
    : [params.userId, ...readyStatuses, timestamp];
  const campaignRow = await d1First<D1CampaignRow>(
    params.campaignId
      ? `SELECT *
         FROM extension_campaign
         WHERE id = ? AND owner_user_id = ? AND status IN (${placeholders(readyStatuses)})
         LIMIT 1`
      : `SELECT *
         FROM extension_campaign
         WHERE owner_user_id = ? AND status IN (${placeholders(readyStatuses)})
           AND (schedule_at IS NULL OR schedule_at <= ?)
         ORDER BY COALESCE(schedule_at, created_at) ASC, created_at ASC
         LIMIT 1`,
    values,
  );
  if (!campaignRow) return null;

  const campaign = mapD1Campaign(campaignRow);
  const channel = resolveCampaignChannel(campaign.channel);
  if (!isRunnerCampaignChannel(channel)) return null;

  let recipients = await d1All<D1RecipientRow>(
    `SELECT *
     FROM extension_campaign_recipient
     WHERE campaign_id = ?
       AND status IN ('queued', 'scheduled')
       AND (scheduled_for IS NULL OR scheduled_for <= ?)
     ORDER BY COALESCE(scheduled_for, created_at) ASC, created_at ASC
     LIMIT ?`,
    [campaign.id, timestamp, campaign.batchSize],
  );

  if (!recipients.length) {
    const dynamicStaleClaimAfterMs = Math.max(
      STALE_CLAIM_AFTER_MS,
      Math.max(250, campaign.messageDelayMs ?? DEFAULT_CAMPAIGN_DELAY_MS) *
        Math.max(1, campaign.batchSize) *
        2,
    );
    const staleBefore = nowIso(new Date(now.getTime() - dynamicStaleClaimAfterMs));
    const staleClaimed = await d1All<D1RecipientRow>(
      `SELECT *
       FROM extension_campaign_recipient
       WHERE campaign_id = ?
         AND status = 'claimed'
         AND (attempted_at IS NULL OR attempted_at <= ?)
       LIMIT 500`,
      [campaign.id, staleBefore],
    );

    for (const recipient of staleClaimed.map(mapD1Recipient)) {
      await d1Run(
        `UPDATE extension_campaign_recipient
         SET status = ?, attempted_at = NULL, last_error = NULL, updated_at = ?
         WHERE id = ?`,
        [nextRecipientPendingStatus(recipient, now), timestamp, recipient.id],
      );
    }

    if (staleClaimed.length) {
      await writeD1BusinessEvent({
        type: "EXTENSION_RUN_EVENT",
        userId: params.userId,
        subjectType: "extension_campaign",
        subjectId: campaign.id,
        metadata: {
          eventType: "campaign_claims_released",
          campaignName: campaign.campaignName,
          releasedCount: staleClaimed.length,
          reason: "stale_claim_recovery",
        },
      });

      recipients = await d1All<D1RecipientRow>(
        `SELECT *
         FROM extension_campaign_recipient
         WHERE campaign_id = ?
           AND status IN ('queued', 'scheduled')
           AND (scheduled_for IS NULL OR scheduled_for <= ?)
         ORDER BY COALESCE(scheduled_for, created_at) ASC, created_at ASC
         LIMIT ?`,
        [campaign.id, timestamp, campaign.batchSize],
      );
    }
  }

  if (!recipients.length) {
    const pending = await countCampaignPendingRecipients(campaign.id, now);
    if (pending.totalPending === 0) {
      const completion = await readCampaignCompletionSnapshot(campaign.id);
      await d1Run(
        "UPDATE extension_campaign SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?",
        [completion.status, timestamp, timestamp, campaign.id],
      );
      return null;
    }

    if (
      campaign.scheduleAt &&
      campaign.scheduleAt.getTime() > now.getTime() &&
      pending.readyPending === 0 &&
      campaign.status !== "scheduled"
    ) {
      await d1Run(
        "UPDATE extension_campaign SET status = 'scheduled', completed_at = NULL, updated_at = ? WHERE id = ?",
        [timestamp, campaign.id],
      );
    }
    return null;
  }

  await d1Run(
    "UPDATE extension_campaign SET status = 'processing', completed_at = NULL, updated_at = ? WHERE id = ?",
    [timestamp, campaign.id],
  );
  for (const recipient of recipients) {
    await d1Run(
      "UPDATE extension_campaign_recipient SET status = 'claimed', attempted_at = ?, updated_at = ? WHERE id = ?",
      [timestamp, timestamp, recipient.id],
    );
  }

  await writeD1BusinessEvent({
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
    recipients: recipients.map((row) => {
      const recipient = mapD1Recipient(row);
      return {
        id: recipient.id,
        contactValue: recipient.contactValue,
        contactName: recipient.contactName,
        externalKey: recipient.externalKey,
        scheduledFor: recipient.scheduledFor?.toISOString() ?? null,
        payload: recipient.payload,
        resolvedMessage: renderCampaignMessageTemplate(campaign.messageTemplate, recipient),
        messageDelayMs: campaign.messageDelayMs,
        mediaUrl: campaign.mediaUrl,
        mediaDownloadUrl: campaign.mediaUrl ? `/api/ext/campaigns/media?campaignId=${campaign.id}` : null,
      };
    }),
  };
}

export async function recordD1ExtensionCampaignDispatch(params: {
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
  await ensureD1ExtensionRuntimeSchema();
  const timestamp = nowIso();
  if (!params.results.length) {
    const campaign = await getCampaignWithRecipients(params.campaignId);
    return campaign ? serializeD1Campaign(campaign) : null;
  }

  for (const result of params.results) {
    await d1Run(
      `UPDATE extension_campaign_recipient
       SET status = ?, sent_at = ?, last_error = ?, updated_at = ?
       WHERE id = ?`,
      [
        result.status,
        result.status === "sent" ? timestamp : null,
        result.error?.trim() || null,
        timestamp,
        result.recipientId,
      ],
    );
  }

  const currentCampaign = await d1First<D1CampaignRow>(
    "SELECT * FROM extension_campaign WHERE id = ? LIMIT 1",
    [params.campaignId],
  );
  const pending = await countCampaignPendingRecipients(params.campaignId);
  const channel = resolveCampaignChannel(currentCampaign?.channel);
  let nextStatus: string;

  if (!pending.totalPending) {
    nextStatus = (await readCampaignCompletionSnapshot(params.campaignId)).status;
  } else if (currentCampaign?.status === "paused") {
    nextStatus = "paused";
  } else if (
    currentCampaign?.schedule_at &&
    new Date(currentCampaign.schedule_at).getTime() > Date.now() &&
    pending.readyPending === 0
  ) {
    nextStatus = "scheduled";
  } else if (isRunnerCampaignChannel(channel)) {
    const runner = await getD1ExtensionRunnerHealth(params.userId);
    nextStatus = runner.available ? "processing" : "waiting_runner";
  } else {
    nextStatus = currentCampaign?.status ?? "queued";
  }

  await d1Run(
    "UPDATE extension_campaign SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?",
    [nextStatus, isTerminalCampaignStatus(nextStatus) ? timestamp : null, timestamp, params.campaignId],
  );
  const campaign = await getCampaignWithRecipients(params.campaignId);

  await writeD1BusinessEvent({
    type: "EXTENSION_RUN_EVENT",
    userId: params.userId,
    subjectType: "extension_campaign",
    subjectId: params.campaignId,
    metadata: {
      eventType: "campaign_dispatch_recorded",
      campaignName: campaign?.campaignName ?? null,
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
      writeD1BusinessEvent({
        type: "EXTENSION_RUN_EVENT",
        userId: params.userId,
        subjectType: "extension_campaign_recipient",
        subjectId: item.recipientId,
        metadata: {
          eventType: "campaign_dispatch_result",
          campaignId: params.campaignId,
          campaignName: campaign?.campaignName ?? null,
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

  return campaign ? serializeD1Campaign(campaign) : null;
}

export async function pauseD1ExtensionCampaign(params: {
  userId: string;
  campaignId: string;
  now?: Date;
  force?: boolean;
}) {
  await ensureD1ExtensionRuntimeSchema();
  const now = params.now ?? new Date();
  const timestamp = nowIso(now);
  const campaign = await getCampaignWithRecipients(params.campaignId);
  if (!campaign || campaign.ownerUserId !== params.userId) {
    throw new Error("La campaña solicitada ya no existe.");
  }
  if (isTerminalCampaignStatus(campaign.status) || campaign.status === "draft") {
    return serializeD1Campaign(campaign);
  }
  if (campaign.status === "paused" && !params.force) return serializeD1Campaign(campaign);

  const claimedRecipients = campaign.recipients.filter((recipient) => recipient.status === "claimed");
  await d1Run(
    "UPDATE extension_campaign SET status = 'paused', completed_at = NULL, updated_at = ? WHERE id = ?",
    [timestamp, campaign.id],
  );
  for (const recipient of claimedRecipients) {
    await d1Run(
      `UPDATE extension_campaign_recipient
       SET status = ?, attempted_at = NULL, last_error = NULL, updated_at = ?
       WHERE id = ?`,
      [nextRecipientPendingStatus(recipient, now), timestamp, recipient.id],
    );
  }

  const refreshed = await getCampaignWithRecipients(campaign.id);
  if (!refreshed) throw new Error("No fue posible refrescar la campaña pausada.");

  await writeD1BusinessEvent({
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

  return serializeD1Campaign(refreshed);
}

export async function resumeD1ExtensionCampaign(params: {
  userId: string;
  campaignId: string;
  now?: Date;
}) {
  await ensureD1ExtensionRuntimeSchema();
  const now = params.now ?? new Date();
  const campaign = await getCampaignWithRecipients(params.campaignId);
  if (!campaign || campaign.ownerUserId !== params.userId) {
    throw new Error("La campaña solicitada ya no existe.");
  }
  if (isTerminalCampaignStatus(campaign.status)) return serializeD1Campaign(campaign);

  const channel = resolveCampaignChannel(campaign.channel);
  if (!isRunnerCampaignChannel(channel)) {
    throw new Error(
      "La campaña usa un canal sin runner automático. Cambia el transporte desde la web para continuar.",
    );
  }

  const pending = await countCampaignPendingRecipients(campaign.id, now);
  const runnerHealth = await getD1ExtensionRunnerHealth(params.userId, { now });
  const nextStatus = !pending.totalPending
    ? (await readCampaignCompletionSnapshot(campaign.id)).status
    : campaign.scheduleAt && campaign.scheduleAt.getTime() > now.getTime() && pending.readyPending === 0
      ? "scheduled"
      : runnerHealth.available
        ? "queued"
        : "waiting_runner";
  await d1Run(
    "UPDATE extension_campaign SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?",
    [
      nextStatus,
      isTerminalCampaignStatus(nextStatus) ? toIso(campaign.completedAt ?? now) : null,
      nowIso(now),
      campaign.id,
    ],
  );

  const refreshed = await getCampaignWithRecipients(campaign.id);
  if (!refreshed) throw new Error("No fue posible refrescar la campaña reanudada.");

  await writeD1BusinessEvent({
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

  return serializeD1Campaign(refreshed);
}

export async function deleteD1ExtensionCampaignForUser(params: {
  userId: string;
  campaignId: string;
}) {
  await ensureD1ExtensionRuntimeSchema();
  const campaign = await getCampaignWithRecipients(params.campaignId);
  if (!campaign || campaign.ownerUserId !== params.userId) {
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

  await d1Run("DELETE FROM extension_campaign_recipient WHERE campaign_id = ?", [campaign.id]);
  await d1Run("DELETE FROM extension_campaign WHERE id = ?", [campaign.id]);
  await writeD1BusinessEvent({
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
