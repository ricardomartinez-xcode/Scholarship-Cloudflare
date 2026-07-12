import { d1All, d1First, d1Run, getD1, parseD1Json } from "@/lib/cloudflare/d1";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_CAMPAIGNS_PER_PROFILE = 100;
const MAX_RECIPIENTS_PER_CAMPAIGN = 1_000;
const MAX_EVENT_RESULTS = 200;

export type CampaignSenderProfile = {
  id: string;
  senderPhone: string | null;
  senderLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignSenderCountry = {
  iso: string;
  label: string;
  dialCode: string;
  mobilePrefix: string;
  localLength: number;
};

export type CampaignSenderSettings = {
  messageDelayMs: number;
  batchSize: number;
  batchPauseMs: number;
  jitterMs: number;
};

export type CampaignSenderStats = { total: number; queued: number; sent: number; failed: number };

export type CampaignSenderCampaign = {
  id: string;
  profileId: string;
  campaignName: string;
  messageTemplate: string;
  senderPhone: string;
  country: CampaignSenderCountry;
  settings: CampaignSenderSettings;
  consentConfirmed: boolean;
  status: "queued" | "running" | "paused" | "completed" | "stopped";
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  stats: CampaignSenderStats;
};

export type CampaignSenderRecipient = {
  id: string;
  campaignId: string;
  contactName: string | null;
  contactValue: string;
  status: "queued" | "sent" | "failed";
  attemptedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProfileRow = {
  id: string;
  clientKeyHash: string;
  senderPhone: string | null;
  senderLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

type CampaignRow = {
  id: string;
  profileId: string;
  campaignName: string;
  messageTemplate: string;
  senderPhone: string;
  countryJson: string;
  settingsJson: string;
  consentConfirmed: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  total: number | null;
  queued: number | null;
  sent: number | null;
  failed: number | null;
};

type RecipientRow = {
  id: string;
  campaignId: string;
  contactName: string | null;
  contactValue: string;
  status: string;
  attemptedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export class PublicCampaignError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "campaign_error") {
    super(message);
    this.name = "PublicCampaignError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeMultilineText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim()
    .slice(0, maxLength);
}

function numeric(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSafeId(value: unknown) {
  return /^[A-Za-z0-9_-]{12,128}$/.test(String(value ?? "").trim());
}

function normalizeIdentifier(value: unknown, label: string) {
  const id = String(value ?? "").trim();
  if (!isSafeId(id)) throw new PublicCampaignError(`${label} inválido.`, 400, "invalid_identifier");
  return id;
}

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomUUID();
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function randomClientKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function normalizeSenderPhone(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (digits.length < 8 || digits.length > 18) {
    throw new PublicCampaignError("El número emisor no es válido.", 400, "invalid_sender_phone");
  }
  return `+${digits}`;
}

function normalizeSettings(value: unknown): CampaignSenderSettings {
  const candidate = asRecord(value);
  return {
    messageDelayMs: numeric(candidate.messageDelayMs, 6_000, 2_000, 120_000),
    batchSize: numeric(candidate.batchSize, 20, 1, 100),
    batchPauseMs: numeric(candidate.batchPauseMs, 60_000, 0, 900_000),
    jitterMs: numeric(candidate.jitterMs, 0, 0, 30_000),
  };
}

export function normalizeCountry(value: unknown): CampaignSenderCountry {
  const candidate = asRecord(value);
  const requestedIso = normalizeText(candidate.iso, 8).toUpperCase();
  const iso = requestedIso || "MX";
  const mexico = iso === "MX";
  const dialCode = String(candidate.dialCode ?? (mexico ? "52" : "")).replace(/\D+/g, "").slice(0, 4);
  const mobilePrefix = String(candidate.mobilePrefix ?? (mexico ? "1" : "")).replace(/\D+/g, "").slice(0, 4);
  const localLength = numeric(candidate.localLength, 10, 5, 15);
  const label = normalizeText(candidate.label, 48) || (mexico ? "México" : iso);
  if (!dialCode) throw new PublicCampaignError("Configura un código de país válido.", 400, "invalid_country");
  return { iso, label, dialCode, mobilePrefix, localLength };
}

export function normalizeCampaignPhone(value: unknown, country: CampaignSenderCountry) {
  let digits = String(value ?? "").replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);

  const internationalPrefix = `${country.dialCode}${country.mobilePrefix}`;
  let local = digits;
  if (internationalPrefix && local.startsWith(internationalPrefix)) {
    local = local.slice(internationalPrefix.length);
  } else if (country.dialCode && local.startsWith(country.dialCode)) {
    local = local.slice(country.dialCode.length);
    if (country.mobilePrefix && local.startsWith(country.mobilePrefix)) local = local.slice(country.mobilePrefix.length);
  }

  // México acepta diversas entradas históricas; se conserva siempre el número local de 10 dígitos.
  if (country.iso === "MX" && country.localLength === 10 && local.length >= 10) {
    local = local.slice(-10);
  } else if (local.length > country.localLength) {
    local = local.slice(-country.localLength);
  }

  if (local.length !== country.localLength) return null;
  return `+${country.dialCode}${country.mobilePrefix}${local}`;
}

function serializeCampaign(row: CampaignRow): CampaignSenderCampaign {
  const fallbackCountry: CampaignSenderCountry = {
    iso: "MX", label: "México", dialCode: "52", mobilePrefix: "1", localLength: 10,
  };
  const fallbackSettings: CampaignSenderSettings = {
    messageDelayMs: 6_000, batchSize: 20, batchPauseMs: 60_000, jitterMs: 0,
  };
  const status = ["running", "paused", "completed", "stopped"].includes(row.status) ? row.status : "queued";
  return {
    id: row.id,
    profileId: row.profileId,
    campaignName: row.campaignName,
    messageTemplate: row.messageTemplate,
    senderPhone: row.senderPhone,
    country: normalizeCountry(parseD1Json(row.countryJson, fallbackCountry)),
    settings: normalizeSettings(parseD1Json(row.settingsJson, fallbackSettings)),
    consentConfirmed: Boolean(row.consentConfirmed),
    status: status as CampaignSenderCampaign["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    stats: {
      total: numberValue(row.total),
      queued: numberValue(row.queued),
      sent: numberValue(row.sent),
      failed: numberValue(row.failed),
    },
  };
}

function serializeRecipient(row: RecipientRow): CampaignSenderRecipient {
  return {
    id: row.id,
    campaignId: row.campaignId,
    contactName: row.contactName,
    contactValue: row.contactValue,
    status: row.status === "sent" || row.status === "failed" ? row.status : "queued",
    attemptedAt: row.attemptedAt,
    sentAt: row.sentAt,
    failedAt: row.failedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const campaignSelect = `
  SELECT
    c.id,
    c.profile_id AS profileId,
    c.campaign_name AS campaignName,
    c.message_template AS messageTemplate,
    c.sender_phone AS senderPhone,
    c.country_json AS countryJson,
    c.settings_json AS settingsJson,
    c.consent_confirmed AS consentConfirmed,
    c.status,
    c.created_at AS createdAt,
    c.updated_at AS updatedAt,
    c.started_at AS startedAt,
    c.completed_at AS completedAt,
    (SELECT COUNT(*) FROM campaign_sender_recipient r WHERE r.campaign_id = c.id) AS total,
    (SELECT COUNT(*) FROM campaign_sender_recipient r WHERE r.campaign_id = c.id AND r.status = 'queued') AS queued,
    (SELECT COUNT(*) FROM campaign_sender_recipient r WHERE r.campaign_id = c.id AND r.status = 'sent') AS sent,
    (SELECT COUNT(*) FROM campaign_sender_recipient r WHERE r.campaign_id = c.id AND r.status = 'failed') AS failed
  FROM campaign_sender_campaign c
`;

async function loadProfile(profileId: string) {
  return d1First<ProfileRow>(
    `SELECT id, client_key_hash AS clientKeyHash, sender_phone AS senderPhone,
      sender_label AS senderLabel, created_at AS createdAt, updated_at AS updatedAt
     FROM campaign_sender_profile WHERE id = ? LIMIT 1`,
    [profileId],
  );
}

async function loadCampaign(profileId: string, campaignId: string) {
  const row = await d1First<CampaignRow>(
    `${campaignSelect} WHERE c.id = ? AND c.profile_id = ? LIMIT 1`,
    [campaignId, profileId],
  );
  return row ? serializeCampaign(row) : null;
}

export async function requireCampaignProfile(request: Request) {
  const profileId = request.headers.get("x-campaign-profile-id")?.trim() ?? "";
  const clientKey = request.headers.get("x-campaign-profile-key")?.trim() ?? "";
  if (!profileId || !clientKey) {
    throw new PublicCampaignError("Esta instalación no tiene una credencial de perfil válida.", 401, "profile_required");
  }
  if (!isSafeId(profileId) || clientKey.length < 24 || clientKey.length > 256) {
    throw new PublicCampaignError("La credencial de perfil es inválida.", 401, "invalid_profile_credentials");
  }
  const profile = await loadProfile(profileId);
  if (!profile) throw new PublicCampaignError("El perfil local ya no existe.", 401, "unknown_profile");
  if (!constantTimeEqual(profile.clientKeyHash, await sha256(clientKey))) {
    throw new PublicCampaignError("La credencial de perfil no coincide.", 403, "profile_forbidden");
  }
  return profile;
}

export async function createCampaignProfile(request: Request, body: unknown) {
  const ip = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  const limiter = await checkRateLimit(`public-campaign-profile:${ip}`, { limit: 12, windowMs: 10 * 60_000 });
  if (!limiter.ok) throw new PublicCampaignError("Espera un momento antes de crear otro perfil local.", 429, "rate_limited");

  const profileId = normalizeIdentifier(asRecord(body).profileId, "ID de perfil");
  const clientKey = randomClientKey();
  const now = nowIso();
  try {
    await d1Run(
      `INSERT INTO campaign_sender_profile
        (id, client_key_hash, sender_phone, sender_label, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, ?, ?)`,
      [profileId, await sha256(clientKey), now, now],
    );
  } catch {
    throw new PublicCampaignError(
      "Este ID de perfil ya está registrado. Restablece la extensión o crea un perfil nuevo.",
      409,
      "profile_exists",
    );
  }
  return {
    profile: { id: profileId, senderPhone: null, senderLabel: null, createdAt: now, updatedAt: now } satisfies CampaignSenderProfile,
    clientKey,
  };
}

export async function updateCampaignProfile(profile: ProfileRow, body: unknown) {
  const candidate = asRecord(body);
  const senderPhone = normalizeSenderPhone(candidate.senderPhone);
  const senderLabel = normalizeText(candidate.senderLabel, 80) || null;
  const now = nowIso();
  await d1Run(
    `UPDATE campaign_sender_profile SET sender_phone = ?, sender_label = ?, updated_at = ? WHERE id = ?`,
    [senderPhone, senderLabel, now, profile.id],
  );
  return { id: profile.id, senderPhone, senderLabel, createdAt: profile.createdAt, updatedAt: now } satisfies CampaignSenderProfile;
}

function normalizeRecipientInputs(value: unknown, country: CampaignSenderCountry) {
  if (!Array.isArray(value)) throw new PublicCampaignError("Los destinatarios deben enviarse como una lista.", 400, "invalid_recipients");
  if (value.length > MAX_RECIPIENTS_PER_CAMPAIGN) {
    throw new PublicCampaignError(`Una campaña admite hasta ${MAX_RECIPIENTS_PER_CAMPAIGN} destinatarios.`, 400, "recipient_limit");
  }
  const seen = new Set<string>();
  const recipients: Array<{ id: string; contactName: string | null; contactValue: string }> = [];
  let discardedInvalid = 0;
  let discardedDuplicates = 0;
  for (const item of value) {
    const record = asRecord(item);
    const contactValue = normalizeCampaignPhone(record.contactValue, country);
    if (!contactValue) { discardedInvalid += 1; continue; }
    if (seen.has(contactValue)) { discardedDuplicates += 1; continue; }
    seen.add(contactValue);
    recipients.push({
      id: createId(),
      contactName: normalizeText(record.contactName, 160) || null,
      contactValue,
    });
  }
  if (!recipients.length) {
    throw new PublicCampaignError("La campaña necesita al menos un destinatario con número válido.", 400, "no_valid_recipients");
  }
  return { recipients, discardedInvalid, discardedDuplicates };
}

export async function createCampaign(request: Request, profile: ProfileRow, body: unknown) {
  const limiter = await checkRateLimit(`public-campaign-create:${profile.id}`, { limit: 10, windowMs: 60_000 });
  if (!limiter.ok) throw new PublicCampaignError("Espera antes de crear otra campaña.", 429, "rate_limited");

  const candidate = asRecord(body);
  const campaignId = isSafeId(candidate.id) ? String(candidate.id).trim() : createId();
  const campaignName = normalizeText(candidate.campaignName, 120) || "Campaña WhatsApp";
  const messageTemplate = normalizeMultilineText(candidate.messageTemplate, 4096);
  const country = normalizeCountry(candidate.country);
  const settings = normalizeSettings(candidate.settings);
  const providedSenderPhone = normalizeSenderPhone(candidate.senderPhone);

  if (!messageTemplate) throw new PublicCampaignError("Escribe el mensaje de la campaña.", 400, "message_required");
  if (!candidate.consentConfirmed) {
    throw new PublicCampaignError("Confirma que cuentas con consentimiento para contactar a los destinatarios.", 400, "consent_required");
  }
  if (!profile.senderPhone) {
    throw new PublicCampaignError("Registra el número emisor del perfil antes de crear una campaña.", 400, "sender_required");
  }
  if (providedSenderPhone && providedSenderPhone !== profile.senderPhone) {
    throw new PublicCampaignError("El número emisor debe coincidir con el registrado en este perfil.", 403, "sender_mismatch");
  }

  const { recipients, discardedInvalid, discardedDuplicates } = normalizeRecipientInputs(candidate.recipients, country);
  const now = nowIso();
  const db = getD1();
  const statements = [
    db.prepare(
      `INSERT INTO campaign_sender_campaign
        (id, profile_id, campaign_name, message_template, sender_phone, country_json, settings_json,
         consent_confirmed, status, created_at, updated_at, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'queued', ?, ?, NULL, NULL)`,
    ).bind(campaignId, profile.id, campaignName, messageTemplate, profile.senderPhone, JSON.stringify(country), JSON.stringify(settings), now, now),
    ...recipients.map((recipient) => db.prepare(
      `INSERT INTO campaign_sender_recipient
        (id, campaign_id, contact_name, contact_value, status, attempted_at, sent_at, failed_at, last_error, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'queued', NULL, NULL, NULL, NULL, ?, ?)`,
    ).bind(recipient.id, campaignId, recipient.contactName, recipient.contactValue, now, now)),
    db.prepare(
      `INSERT INTO campaign_sender_event
        (id, campaign_id, profile_id, event_type, sender_phone, payload_json, created_at)
       VALUES (?, ?, ?, 'campaign_created', ?, ?, ?)`,
    ).bind(createId(), campaignId, profile.id, profile.senderPhone, JSON.stringify({
      recipientCount: recipients.length,
      discardedInvalid,
      discardedDuplicates,
      country,
      settings,
      extensionVersion: request.headers.get("x-extension-version")?.slice(0, 32) ?? null,
    }), now),
  ];

  try {
    await db.batch(statements);
  } catch {
    throw new PublicCampaignError("No se pudo guardar la campaña. Verifica que la migración de Campaign Sender esté aplicada.", 503, "campaign_storage_unavailable");
  }
  const campaign = await loadCampaign(profile.id, campaignId);
  if (!campaign) throw new PublicCampaignError("La campaña fue creada pero no pudo leerse.", 500, "campaign_read_failed");

  return {
    campaign,
    recipients: recipients.map((recipient) => ({
      id: recipient.id,
      campaignId,
      contactName: recipient.contactName,
      contactValue: recipient.contactValue,
      status: "queued" as const,
      attemptedAt: null,
      sentAt: null,
      failedAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    })),
    normalization: { discardedInvalid, discardedDuplicates },
  };
}

export async function listCampaigns(profile: ProfileRow, limitValue: unknown) {
  const rows = await d1All<CampaignRow>(
    `${campaignSelect} WHERE c.profile_id = ? ORDER BY c.created_at DESC LIMIT ?`,
    [profile.id, numeric(limitValue, 40, 1, MAX_CAMPAIGNS_PER_PROFILE)],
  );
  return rows.map(serializeCampaign);
}

export async function getCampaignDetail(profile: ProfileRow, campaignIdValue: unknown) {
  const campaignId = normalizeIdentifier(campaignIdValue, "ID de campaña");
  const campaign = await loadCampaign(profile.id, campaignId);
  if (!campaign) throw new PublicCampaignError("La campaña no existe en este perfil.", 404, "campaign_not_found");
  const rows = await d1All<RecipientRow>(
    `SELECT id, campaign_id AS campaignId, contact_name AS contactName, contact_value AS contactValue,
      status, attempted_at AS attemptedAt, sent_at AS sentAt, failed_at AS failedAt,
      last_error AS lastError, created_at AS createdAt, updated_at AS updatedAt
     FROM campaign_sender_recipient WHERE campaign_id = ? ORDER BY created_at ASC LIMIT ?`,
    [campaignId, MAX_RECIPIENTS_PER_CAMPAIGN],
  );
  return { campaign, recipients: rows.map(serializeRecipient) };
}

function normalizeEventType(value: unknown) {
  const eventType = String(value ?? "").trim().toLowerCase();
  const allowed = new Set(["campaign_started", "campaign_paused", "campaign_resumed", "campaign_completed", "campaign_stopped", "recipient_results"]);
  if (!allowed.has(eventType)) throw new PublicCampaignError("El evento de campaña no es válido.", 400, "invalid_event_type");
  return eventType;
}

function normalizeRecipientResults(value: unknown) {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_EVENT_RESULTS) {
    throw new PublicCampaignError(`Puedes registrar hasta ${MAX_EVENT_RESULTS} resultados por evento.`, 400, "event_result_limit");
  }
  const results = new Map<string, { recipientId: string; status: "sent" | "failed"; error: string | null }>();
  for (const item of value) {
    const record = asRecord(item);
    const recipientId = String(record.recipientId ?? "").trim();
    const status = String(record.status ?? "").trim().toLowerCase();
    if (!isSafeId(recipientId) || (status !== "sent" && status !== "failed")) continue;
    results.set(recipientId, { recipientId, status, error: normalizeText(record.error, 600) || null });
  }
  if (!results.size) throw new PublicCampaignError("El evento no contiene resultados válidos.", 400, "empty_event_results");
  return Array.from(results.values());
}

export async function recordCampaignEvent(request: Request, profile: ProfileRow, campaignIdValue: unknown, body: unknown) {
  const limiter = await checkRateLimit(`public-campaign-event:${profile.id}`, { limit: 360, windowMs: 60_000 });
  if (!limiter.ok) throw new PublicCampaignError("Demasiados eventos de campaña. Intenta nuevamente.", 429, "rate_limited");

  const campaignId = normalizeIdentifier(campaignIdValue, "ID de campaña");
  const campaign = await loadCampaign(profile.id, campaignId);
  if (!campaign) throw new PublicCampaignError("La campaña no existe en este perfil.", 404, "campaign_not_found");

  const candidate = asRecord(body);
  const eventType = normalizeEventType(candidate.eventType);
  const senderPhone = normalizeSenderPhone(candidate.senderPhone);
  if (senderPhone && senderPhone !== profile.senderPhone) {
    throw new PublicCampaignError("El número emisor del evento no coincide con el perfil.", 403, "sender_mismatch");
  }

  const now = nowIso();
  let nextStatus = campaign.status;
  let startedAt = campaign.startedAt;
  let completedAt = campaign.completedAt;
  const results = eventType === "recipient_results" ? normalizeRecipientResults(candidate.results) : [];

  if (eventType === "campaign_started" || eventType === "campaign_resumed") {
    nextStatus = "running";
    startedAt = campaign.startedAt ?? now;
    completedAt = null;
  } else if (eventType === "campaign_paused") {
    nextStatus = "paused";
    completedAt = null;
  } else if (eventType === "campaign_completed") {
    nextStatus = "completed";
    completedAt = now;
  } else if (eventType === "campaign_stopped") {
    nextStatus = "stopped";
    completedAt = now;
  } else if (campaign.status !== "paused") {
    nextStatus = "running";
    completedAt = null;
  }

  const db = getD1();
  const statements = [
    ...results.map((result) => db.prepare(
      `UPDATE campaign_sender_recipient
       SET status = ?, attempted_at = ?,
           sent_at = CASE WHEN ? = 'sent' THEN ? ELSE sent_at END,
           failed_at = CASE WHEN ? = 'failed' THEN ? ELSE failed_at END,
           last_error = CASE WHEN ? = 'failed' THEN ? ELSE NULL END,
           updated_at = ?
       WHERE id = ? AND campaign_id = ?`,
    ).bind(result.status, now, result.status, now, result.status, now, result.status, result.error, now, result.recipientId, campaignId)),
    db.prepare(
      `UPDATE campaign_sender_campaign
       SET status = ?, updated_at = ?, started_at = ?, completed_at = ?
       WHERE id = ? AND profile_id = ?`,
    ).bind(nextStatus, now, startedAt, completedAt, campaignId, profile.id),
    db.prepare(
      `INSERT INTO campaign_sender_event
        (id, campaign_id, profile_id, event_type, sender_phone, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(createId(), campaignId, profile.id, eventType, profile.senderPhone, JSON.stringify({
      senderPhone: profile.senderPhone,
      extensionVersion: request.headers.get("x-extension-version")?.slice(0, 32) ?? null,
      resultCount: results.length,
      results,
    }), now),
  ];

  try {
    await db.batch(statements);
  } catch {
    throw new PublicCampaignError("No se pudo registrar el evento de campaña.", 503, "campaign_event_storage_unavailable");
  }
  const refreshed = await loadCampaign(profile.id, campaignId);
  if (!refreshed) throw new PublicCampaignError("La campaña no pudo actualizarse.", 500, "campaign_read_failed");
  return refreshed;
}

export async function campaignHealth() {
  const row = await d1First<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'campaign_sender_profile' LIMIT 1`,
  );
  if (!row?.name) {
    throw new PublicCampaignError("La migración Campaign Sender aún no está aplicada en PostgreSQL.", 503, "campaign_migration_pending");
  }
  return { storage: "postgres", feature: "campaign-sender", media: false, authentication: "local-profile-key" };
}

export type CampaignSenderAdminRow = {
  id: string;
  campaignName: string;
  senderPhone: string;
  senderLabel: string | null;
  profileId: string;
  status: string;
  createdAt: string;
  sent: number;
  failed: number;
  total: number;
};

export async function listCampaignSenderAdminRows(limit = 100) {
  const adminSelect = campaignSelect
    .replace("FROM campaign_sender_campaign c", "FROM campaign_sender_campaign c INNER JOIN campaign_sender_profile p ON p.id = c.profile_id")
    .replace("c.completed_at AS completedAt,", "c.completed_at AS completedAt,\n    p.sender_label AS senderLabel,");
  const rows = await d1All<CampaignRow & { senderLabel: string | null }>(
    `${adminSelect} ORDER BY c.created_at DESC LIMIT ?`,
    [numeric(limit, 100, 1, 250)],
  );
  return rows.map((row) => {
    const campaign = serializeCampaign(row);
    return {
      id: campaign.id,
      campaignName: campaign.campaignName,
      senderPhone: campaign.senderPhone,
      senderLabel: row.senderLabel,
      profileId: campaign.profileId,
      status: campaign.status,
      createdAt: campaign.createdAt,
      ...campaign.stats,
    } satisfies CampaignSenderAdminRow;
  });
}
