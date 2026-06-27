import type { AppD1Database } from "./contracts";

const REQUIRED_TABLES = [
  "campus",
  "program",
  "program_offering",
  "academic_fee",
  "cloudflare_auth_user",
  "cloudflare_auth_session",
  "organization",
  "quote_session",
  "import_job",
  "oauth_connection",
  "conversation",
  "outbox_event",
] as const;

export interface D1PreflightResult {
  missingTables: string[];
  foreignKeyViolations: unknown[];
}

export async function runD1Preflight(db: AppD1Database): Promise<D1PreflightResult> {
  const placeholders = REQUIRED_TABLES.map(() => "?").join(", ");
  const tables = await db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`)
    .bind(...REQUIRED_TABLES)
    .all<{ name: string }>();

  const present = new Set((tables.results ?? []).map((row) => row.name));
  const fk = await db.prepare("PRAGMA foreign_key_check").all<Record<string, unknown>>();

  return {
    missingTables: REQUIRED_TABLES.filter((name) => !present.has(name)),
    foreignKeyViolations: fk.results ?? [],
  };
}
