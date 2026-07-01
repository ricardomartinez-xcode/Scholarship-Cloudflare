import { d1All } from "@/lib/cloudflare/d1";

export type CampaignSenderExportStatus = "queued" | "sent" | "failed";

export type CampaignSenderRecipientExportRow = {
  campaignId: string;
  campaignName: string;
  profileId: string;
  senderPhone: string;
  senderLabel: string | null;
  campaignStatus: string;
  recipientName: string | null;
  recipientPhone: string;
  recipientStatus: CampaignSenderExportStatus;
  createdAt: string;
  attemptedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  lastError: string | null;
};

function normalizeStatus(value: string | null): CampaignSenderExportStatus | null {
  return value === "queued" || value === "sent" || value === "failed" ? value : null;
}

export async function listCampaignSenderRecipientExports(options?: {
  campaignId?: string | null;
  status?: string | null;
  limit?: number;
}) {
  const campaignId = options?.campaignId?.trim() || null;
  const status = normalizeStatus(options?.status ?? null);
  const limit = Math.max(1, Math.min(50_000, Math.round(options?.limit ?? 10_000)));
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (campaignId) {
    clauses.push("r.campaign_id = ?");
    params.push(campaignId);
  }
  if (status) {
    clauses.push("r.status = ?");
    params.push(status);
  }

  params.push(limit);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return d1All<CampaignSenderRecipientExportRow>(
    `SELECT
      c.id AS campaignId,
      c.campaign_name AS campaignName,
      c.profile_id AS profileId,
      c.sender_phone AS senderPhone,
      p.sender_label AS senderLabel,
      c.status AS campaignStatus,
      r.contact_name AS recipientName,
      r.contact_value AS recipientPhone,
      r.status AS recipientStatus,
      r.created_at AS createdAt,
      r.attempted_at AS attemptedAt,
      r.sent_at AS sentAt,
      r.failed_at AS failedAt,
      r.last_error AS lastError
    FROM campaign_sender_recipient r
    INNER JOIN campaign_sender_campaign c ON c.id = r.campaign_id
    INNER JOIN campaign_sender_profile p ON p.id = c.profile_id
    ${where}
    ORDER BY c.created_at DESC, r.created_at ASC
    LIMIT ?`,
    params,
  );
}

function escapeCsvCell(value: unknown) {
  const normalized = String(value ?? "");
  return /[",\n\r]/.test(normalized)
    ? `"${normalized.replace(/"/g, '""')}"`
    : normalized;
}

export function campaignSenderRowsToCsv(rows: CampaignSenderRecipientExportRow[]) {
  const headers = [
    "campaña_id",
    "campaña",
    "perfil_id",
    "número_emisor",
    "etiqueta_emisor",
    "estado_campaña",
    "nombre_destinatario",
    "número_destinatario",
    "estado_envío",
    "registrado_en",
    "intentado_en",
    "enviado_en",
    "fallido_en",
    "error",
  ];
  const data = rows.map((row) => [
    row.campaignId,
    row.campaignName,
    row.profileId,
    row.senderPhone,
    row.senderLabel,
    row.campaignStatus,
    row.recipientName,
    row.recipientPhone,
    row.recipientStatus,
    row.createdAt,
    row.attemptedAt,
    row.sentAt,
    row.failedAt,
    row.lastError,
  ]);
  return `\uFEFF${[headers, ...data].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`;
}
