import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envFile = process.argv[2] ?? ".env.local";
const envPath = path.resolve(projectRoot, envFile);

try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: envPath, override: false, quiet: true });
} catch {
  // dotenv is a project dependency; this keeps the script error focused on DB config.
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

const backupDir = path.join(
  projectRoot,
  "neon-cleanup-backups",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

try {
  await client.connect();
  await client.query("begin");

  const exists = await client.query(
    `
      select to_regclass('public.recalc_base_json') is not null as exists
    `,
  );

  if (!exists.rows[0]?.exists) {
    await client.query("commit");
    console.log(JSON.stringify({ ok: true, action: "none", reason: "recalc_base_json does not exist" }, null, 2));
    process.exit(0);
  }

  const backup = await client.query(`
    select *
    from public.recalc_base_json
    order by id
  `);

  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(
    path.join(backupDir, "recalc_base_json.backup.json"),
    JSON.stringify(backup.rows, null, 2),
  );

  await client.query("drop table public.recalc_base_json");
  await client.query("commit");

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: "dropped public.recalc_base_json",
        rowsBackedUp: backup.rows.length,
        backupDir,
        reason: "sql/000_init.sql documents recalc_base_json as a base JSON snapshot for control/audit, not used by UI; app code does not read it.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(error);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
