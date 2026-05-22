import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const envFile = process.argv[2] ?? ".env.local";
const envLocalPath = path.resolve(projectRoot, envFile);
if (fs.existsSync(envLocalPath)) {
  const dotenv = await import("dotenv");
  dotenv.config({ path: envLocalPath, override: false, quiet: true });
}

const databaseUrl =
  process.env.DIRECT_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL_UNPOOLED ??
  (process.env.DATABASE_URL?.startsWith("prisma+postgres://")
    ? null
    : process.env.DATABASE_URL);

if (!databaseUrl) {
  console.error("Missing direct Postgres URL. Set DIRECT_URL or DATABASE_URL_UNPOOLED.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const query = async (text, values = []) => {
  const result = await client.query(text, values);
  return result.rows;
};

const expectedRecalcAdminTables = new Set([
  "campus",
  "program",
  "enrollment_format",
  "quote_session",
  "quote_scenario",
  "business_event",
  "program_asset_check",
  "program_offering",
  "directory_contact",
  "directory_contact_method",
  "bulletin",
  "user",
  "user_agenda_item",
  "user_contact",
  "extension_campaign",
  "extension_campaign_recipient",
  "extension_session_token",
  "user_google_connection",
  "user_push_subscription",
  "user_meta_whatsapp_connection",
  "meta_embedded_signup_session",
  "meta_whatsapp_message",
  "meta_whatsapp_message_event",
  "agenda_sync_preference",
  "agenda_external_sync",
  "admin_user_capability",
  "user_capability_assignment",
  "admin_ui_preference",
  "whatsapp_template",
  "whatsapp_template_preference",
  "invite",
  "admin_additional_benefit",
  "admin_additional_benefit_campus",
  "admin_price_override",
  "admin_public_cta",
  "admin_announcement",
  "admin_sidebar_info",
  "admin_audit_log",
  "TrainingRoom",
  "TrainingRoomMember",
  "TrainingMessage",
  "training_chat",
  "training_chat_participant",
  "training_feedback",
  "TrainingRoomPermission",
  "admin_config_version",
  "admin_published_config",
  "admin_import_session",
  "organization",
  "organization_member",
  "inbox_thread",
  "inbox_thread_participant",
  "inbox_message",
  "academic_fee",
  "campus_academic_fee",
  "scholarship_rule",
  "return_subject_price",
  "regreso_materias",
  "_prisma_migrations",
]);

const publicLegacyTables = [
  "recalc_base_json",
  "recalc_programa",
  "recalc_nivel",
  "recalc_modalidad",
  "recalc_plantel",
  "recalc_regla_beca",
  "recalc_regreso_materias",
  "recalc_meta",
];

const rows = await query(`
  select
    n.nspname as schema_name,
    c.relname as table_name,
    coalesce(s.n_live_tup, 0)::bigint as approx_rows,
    pg_total_relation_size(c.oid)::bigint as total_bytes
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where c.relkind = 'r'
    and n.nspname not in ('pg_catalog', 'information_schema')
  order by n.nspname, c.relname
`);

const exactCounts = [];
for (const row of rows) {
  const quotedSchema = row.schema_name.replaceAll('"', '""');
  const quotedTable = row.table_name.replaceAll('"', '""');
  const countRows = await query(`select count(*)::bigint as count from "${quotedSchema}"."${quotedTable}"`);
  exactCounts.push({ ...row, exact_rows: Number(countRows[0]?.count ?? 0) });
}

const runtimeRows = await query(
  `
  select key, value
  from (
    values
      ('PRICING_READ_MODE', $1::text),
      ('DIRECTORY_READ_MODE', $2::text),
      ('DIRECTORY_WRITE_MODE', $3::text),
      ('QUOTE_MODE', $4::text)
  ) as env(key, value)
`,
  [
    process.env.PRICING_READ_MODE ?? null,
    process.env.DIRECTORY_READ_MODE ?? null,
    process.env.DIRECTORY_WRITE_MODE ?? null,
    process.env.QUOTE_MODE ?? null,
  ],
);

const candidates = [];
for (const table of exactCounts) {
  if (table.schema_name === "public" && publicLegacyTables.includes(table.table_name)) {
    const reason =
      table.table_name === "recalc_meta"
        ? "KEEP_FOR_NOW: /api/data/meta still reads this table even when PRICING_READ_MODE=canonical."
        : table.table_name === "recalc_base_json"
          ? "DROP_CANDIDATE: JSON snapshot/control table, explicitly documented as not used by UI."
          : "DROP_CANDIDATE_AFTER_CANONICAL: legacy pricing table; only safe when PRICING_READ_MODE=canonical and parity is validated.";
    candidates.push({ ...table, reason });
    continue;
  }

  if (table.schema_name === "recalc_admin" && !expectedRecalcAdminTables.has(table.table_name)) {
    candidates.push({
      ...table,
      reason: "REVIEW_DROP_CANDIDATE: table is in recalc_admin but not present in Prisma schema.",
    });
    continue;
  }

  if (!["public", "recalc_admin", "realtime"].includes(table.schema_name)) {
    candidates.push({
      ...table,
      reason: "REVIEW_DROP_CANDIDATE: non-application schema found.",
    });
  }
}

const databaseInfo = await query(`
  select current_database() as database_name, current_user as database_user
`);

const summary = {
  database: databaseInfo[0],
  runtimeModes: Object.fromEntries(runtimeRows.map((row) => [row.key, row.value ?? "(default)"])),
  tableCount: exactCounts.length,
  totalRows: exactCounts.reduce((total, row) => total + row.exact_rows, 0),
  tables: exactCounts,
  candidates,
};

console.log(JSON.stringify(summary, null, 2));
await client.end();
