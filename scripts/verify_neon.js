import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(projectRoot, ".env.local") });
const dataDir = path.join(projectRoot, "apps", "web", "public", "data");

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
    "Se requiere DIRECT_URL, POSTGRES_URL_NON_POOLING, o DATABASE_URL (postgres://)."
  );
  process.exit(1);
}

const sql = neon(databaseUrl);

const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf-8"));

const flatRules = readJson("costos_2026_flat_rules.json");
const meta = readJson("costos_2026_meta.json");
const regreso = readJson("regreso_materias.json");

const uniq = (items) => Array.from(new Set(items.filter(Boolean)));

const expected = {
  reglas: flatRules.length,
  programas: uniq(flatRules.map((r) => r.programa)).length,
  niveles: uniq(flatRules.map((r) => r.nivel)).length,
  modalidades: uniq(flatRules.map((r) => r.modalidad)).length,
  regresoMaterias: Object.entries(regreso.materias ?? {}).reduce(
    (total, [, modalidadesMap]) =>
      total +
      Object.values(modalidadesMap).reduce(
        (inner, materiasMap) => inner + Object.keys(materiasMap).length,
        0
      ),
    0
  ),
  canonicalTables: [
    "directory_contact_method",
    "return_subject_price",
    "scholarship_rule",
  ],
  businessEventEnumValues: [
    "QUOTE_GENERATED",
    "INVITE_CREATED",
    "INVITE_RESENT",
    "OFFER_PUBLISHED",
    "IMPORT_FAILED",
  ],
  constraints: [
    "admin_additional_benefit_extra_percent_range_ck",
    "admin_price_override_new_price_nonnegative_ck",
    "quote_scenario_average_range_ck",
    "quote_scenario_subject_count_positive_ck",
    "return_subject_price_subject_count_positive_ck",
    "quote_session_ownerUserId_fkey",
  ],
  indexes: ["quote_scenario_single_draft_per_session_idx"],
};

const getCount = async (query) => {
  const rows = await query;
  const count = rows?.[0]?.count;
  return typeof count === "string" ? Number(count) : Number(count ?? 0);
};

const report = (label, expectedValue, actualValue) => {
  const ok = expectedValue === actualValue;
  const status = ok ? "OK" : "MISMATCH";
  console.log(`${status} ${label}: expected ${expectedValue}, got ${actualValue}`);
  return ok;
};

const reportPresence = (label, expectedValues, actualValues) => {
  const actualSet = new Set(actualValues);
  const missing = expectedValues.filter((value) => !actualSet.has(value));
  const ok = missing.length === 0;
  const status = ok ? "OK" : "MISMATCH";
  console.log(
    `${status} ${label}: expected ${expectedValues.length}, got ${actualValues.length}` +
      (missing.length ? ` (missing: ${missing.join(", ")})` : "")
  );
  return ok;
};

const main = async () => {
  console.log("Validando Neon vs JSON...");

  const reglasCount = await getCount(
    sql`select count(*)::int as count from recalc_regla_beca`
  );
  const programasCount = await getCount(
    sql`select count(*)::int as count from recalc_programa`
  );
  const nivelesCount = await getCount(
    sql`select count(*)::int as count from recalc_nivel`
  );
  const modalidadesCount = await getCount(
    sql`select count(*)::int as count from recalc_modalidad`
  );
  const regresoCount = await getCount(
    sql`select count(*)::int as count from recalc_regreso_materias`
  );

  const baseJsonCounts = await sql`
    select kind, count(*)::int as count
    from recalc_base_json
    group by kind
  `;
  const baseJsonMap = Object.fromEntries(
    baseJsonCounts.map((row) => [row.kind, Number(row.count)])
  );

  const metaRows = await sql`
    select version from recalc_meta order by created_at desc limit 1
  `;
  const metaVersion = metaRows?.[0]?.version ?? null;

  const [canonicalTables, enumValues, constraints, indexes] = await Promise.all([
    sql`
      select table_name
      from information_schema.tables
      where table_schema = 'recalc_admin'
        and table_name = any(${expected.canonicalTables})
      order by table_name
    `,
    sql`
      select e.enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'recalc_admin'
        and t.typname = 'BusinessEventType'
        and e.enumlabel = any(${expected.businessEventEnumValues})
      order by e.enumlabel
    `,
    sql`
      select conname
      from pg_constraint
      where conname = any(${expected.constraints})
      order by conname
    `,
    sql`
      select indexname
      from pg_indexes
      where schemaname = 'recalc_admin'
        and indexname = any(${expected.indexes})
      order by indexname
    `,
  ]);

  const checks = [
    report("recalc_regla_beca", expected.reglas, reglasCount),
    report("recalc_programa", expected.programas, programasCount),
    report("recalc_nivel", expected.niveles, nivelesCount),
    report("recalc_modalidad", expected.modalidades, modalidadesCount),
    report("recalc_regreso_materias", expected.regresoMaterias, regresoCount),
    report(
      "base_json_flat_rules",
      1,
      baseJsonMap["costos_2026_flat_rules"] ?? 0
    ),
    report("base_json_meta", 1, baseJsonMap["costos_2026_meta"] ?? 0),
    report(
      "base_json_regreso",
      1,
      baseJsonMap["regreso_materias"] ?? 0
    ),
    report("meta_version", meta.version ?? null, metaVersion),
    reportPresence(
      "canonical_tables",
      expected.canonicalTables,
      canonicalTables.map((row) => row.table_name)
    ),
    reportPresence(
      "business_event_enum_values",
      expected.businessEventEnumValues,
      enumValues.map((row) => row.enumlabel)
    ),
    reportPresence(
      "constraints",
      expected.constraints,
      constraints.map((row) => row.conname)
    ),
    reportPresence(
      "indexes",
      expected.indexes,
      indexes.map((row) => row.indexname)
    ),
  ];

  if (checks.every(Boolean)) {
    console.log("Validación completa: Neon coincide con los JSON base.");
    return;
  }
  console.error("Se encontraron diferencias entre Neon y JSON.");
  process.exit(1);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
