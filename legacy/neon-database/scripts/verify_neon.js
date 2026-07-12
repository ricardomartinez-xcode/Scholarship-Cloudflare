import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(projectRoot, ".env.local") });

const databaseUrl =
  process.env.DIRECT_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL_UNPOOLED ??
  (process.env.DATABASE_URL?.startsWith("prisma+postgres://")
    ? null
    : process.env.DATABASE_URL) ??
  null;

if (!databaseUrl) {
  console.error(
    "Se requiere DIRECT_URL, POSTGRES_URL_NON_POOLING, o DATABASE_URL (postgres://).",
  );
  process.exit(1);
}

const sql = neon(databaseUrl);

const expectedTables = [
  "admin_additional_benefit",
  "admin_additional_benefit_campus",
  "admin_price_override",
  "campus",
  "return_subject_price",
  "scholarship_rule",
];

const expectedConstraints = [
  "admin_additional_benefit_extra_percent_range_ck",
  "admin_price_override_new_price_nonnegative_ck",
  "return_subject_price_subject_count_positive_ck",
];

const reportPresence = (label, expectedValues, actualValues) => {
  const actualSet = new Set(actualValues);
  const missing = expectedValues.filter((value) => !actualSet.has(value));
  const ok = missing.length === 0;
  const status = ok ? "OK" : "MISMATCH";
  console.log(
    `${status} ${label}: expected ${expectedValues.length}, got ${actualValues.length}` +
      (missing.length ? ` (missing: ${missing.join(", ")})` : ""),
  );
  return ok;
};

const main = async () => {
  console.log("Validando tablas canónicas de Neon...");

  const [tables, constraints] = await Promise.all([
    sql`
      select table_name
      from information_schema.tables
      where table_schema = 'recalc_admin'
        and table_name = any(${expectedTables})
      order by table_name
    `,
    sql`
      select conname
      from pg_constraint
      where conname = any(${expectedConstraints})
      order by conname
    `,
  ]);

  const checks = [
    reportPresence(
      "canonical_tables",
      expectedTables,
      tables.map((row) => row.table_name),
    ),
    reportPresence(
      "canonical_constraints",
      expectedConstraints,
      constraints.map((row) => row.conname),
    ),
  ];

  if (checks.every(Boolean)) {
    console.log("Validación completa: Neon tiene las tablas canónicas requeridas.");
    return;
  }

  console.error("Faltan tablas o constraints canónicas.");
  process.exit(1);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
