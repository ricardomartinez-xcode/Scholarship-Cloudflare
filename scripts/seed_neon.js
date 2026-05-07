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

const main = async () => {
  console.log("Seeding Neon...");

  await sql`insert into recalc_base_json (kind, version, payload)
    values ('costos_2026_flat_rules', ${meta.version ?? null}, ${JSON.stringify(flatRules)})
    on conflict do nothing`;
  await sql`insert into recalc_base_json (kind, version, payload)
    values ('costos_2026_meta', ${meta.version ?? null}, ${JSON.stringify(meta)})
    on conflict do nothing`;
  await sql`insert into recalc_base_json (kind, version, payload)
    values ('regreso_materias', ${regreso.version ?? null}, ${JSON.stringify(regreso)})
    on conflict do nothing`;

  const programas = uniq(flatRules.map((r) => r.programa));
  const niveles = uniq(flatRules.map((r) => r.nivel));
  const modalidades = uniq(flatRules.map((r) => r.modalidad));

  for (const key of programas) {
    await sql`insert into recalc_programa (key) values (${key})
      on conflict (key) do nothing`;
  }
  for (const key of niveles) {
    await sql`insert into recalc_nivel (key) values (${key})
      on conflict (key) do nothing`;
  }
  for (const key of modalidades) {
    await sql`insert into recalc_modalidad (key) values (${key})
      on conflict (key) do nothing`;
  }

  for (const rule of flatRules) {
    await sql`
      insert into recalc_regla_beca (
        programa_key,
        nivel_key,
        modalidad_key,
        plan,
        tier,
        rango_min,
        rango_max,
        porcentaje,
        monto,
        origen
      )
      values (
        ${rule.programa},
        ${rule.nivel},
        ${rule.modalidad},
        ${rule.plan},
        ${rule.tier},
        ${rule.rango?.min ?? null},
        ${rule.rango?.max ?? null},
        ${rule.porcentaje ?? null},
        ${rule.monto ?? null},
        ${rule.origen ?? null}
      )
    `;
  }

  const planteles = Object.keys(regreso.materias ?? {});
  for (const name of planteles) {
    await sql`insert into recalc_plantel (name) values (${name})
      on conflict (name) do nothing`;
  }

  for (const [plantel, modalidadesMap] of Object.entries(regreso.materias ?? {})) {
    for (const [modalidad, materiasMap] of Object.entries(modalidadesMap)) {
      for (const [materiasCount, costo] of Object.entries(materiasMap)) {
        await sql`
          insert into recalc_regreso_materias (
            plantel,
            modalidad,
            materias_count,
            costo
          )
          values (
            ${plantel},
            ${modalidad},
            ${Number(materiasCount)},
            ${Number(costo)}
          )
        `;
      }
    }
  }

  await sql`
    insert into recalc_meta (
      version,
      generated_at_utc,
      fuentes,
      rango_promedio_a_beca,
      reglas_base,
      reglas_excepciones_por_plantel,
      disponibilidad,
      planteles,
      notas
    )
    values (
      ${meta.version ?? null},
      ${meta.generated_at_utc ?? null},
      ${JSON.stringify(meta.fuentes ?? {})},
      ${JSON.stringify(meta.rango_promedio_a_beca ?? {})},
      ${JSON.stringify(meta.reglas_base ?? {})},
      ${JSON.stringify(meta.reglas_excepciones_por_plantel ?? {})},
      ${JSON.stringify(meta.disponibilidad ?? {})},
      ${JSON.stringify(meta.planteles ?? {})},
      ${JSON.stringify(meta.notas ?? {})}
    )
  `;

  console.log("Seed complete.");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
