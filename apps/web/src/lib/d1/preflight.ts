import type { AppD1Database } from "./contracts";

export const REQUIRED_D1_TABLES = [
  "campus",
  "program",
  "program_offering",
  "academic_fee",
  "campus_academic_fee",
  "admin_price_override",
  "admin_additional_benefit",
  "admin_additional_benefit_campus",
  "file_asset",
  "file_asset_usage",
  "cloudflare_auth_user",
  "cloudflare_auth_session",
  "organization",
  "quote_session",
  "quote_scenario",
  "quote_event",
  "import_job",
  "oauth_connection",
  "conversation",
  "conversation_member",
  "conversation_message",
  "business_event",
  "extension_campaign",
  "extension_campaign_recipient",
  "outbox_event",
  "campaign_sender_profile",
  "campaign_sender_campaign",
  "campaign_sender_recipient",
  "campaign_sender_event",
] as const;

export interface D1PreflightResult {
  missingTables: string[];
  foreignKeyViolations: unknown[];
}

export async function runD1Preflight(db: AppD1Database): Promise<D1PreflightResult> {
  const placeholders = REQUIRED_D1_TABLES.map(() => "?").join(", ");
  const tables = await db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`)
    .bind(...REQUIRED_D1_TABLES)
    .all<{ name: string }>();

  const present = new Set((tables.results ?? []).map((row) => row.name));
  const fk = await db.prepare("PRAGMA foreign_key_check").all<Record<string, unknown>>();

  return {
    missingTables: REQUIRED_D1_TABLES.filter((name) => !present.has(name)),
    foreignKeyViolations: fk.results ?? [],
  };
}
