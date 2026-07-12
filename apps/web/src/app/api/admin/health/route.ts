import { NextResponse } from "next/server";

import { d1All, d1First } from "@/lib/cloudflare/d1";

export const dynamic = "force-dynamic";

const CORE_TABLES = [
  "campus",
  "program",
  "program_offering",
  "academic_fee",
  "cloudflare_auth_user",
  "cloudflare_auth_session",
] as const;

const FOUNDATION_TABLES = [
  "organization",
  "quote_session",
  "import_job",
  "oauth_connection",
  "google_oauth_state",
  "conversation",
  "outbox_event",
  "cloudflare_auth_rate_limit",
] as const;

type TableRow = { name: string };

async function listPresentTables(names: readonly string[]) {
  const placeholders = names.map(() => "?").join(", ");
  const rows = await d1All<TableRow>(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table' AND name IN (${placeholders})`,
    [...names],
  );
  return new Set(rows.map((row) => row.name));
}

function missingTables(expected: readonly string[], present: Set<string>) {
  return expected.filter((name) => !present.has(name));
}

/**
 * Read-only deployment health endpoint for the Vercel/Supabase migration.
 * It deliberately avoids external network calls and secret values. This
 * endpoint is intentionally available without a session, so it reports only
 * aggregate status and never exposes resource identifiers or row counts.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const ping = await d1First<{ ok: number }>("SELECT 1 AS ok");
    const present = await listPresentTables([...CORE_TABLES, ...FOUNDATION_TABLES]);
    const coreMissing = missingTables(CORE_TABLES, present);
    const foundationMissing = missingTables(FOUNDATION_TABLES, present);

    const results = {
      runtime: {
        ok: true,
        detail: "Runtime Next.js Node activo.",
      },
      database: {
        ok: ping?.ok === 1 && coreMissing.length === 0,
        detail:
          coreMissing.length === 0
            ? "PostgreSQL responde y el esquema núcleo está disponible."
            : "PostgreSQL responde, pero el esquema núcleo está incompleto.",
      },
      domainAuth: {
        ok: coreMissing.length === 0,
        detail:
          coreMissing.length === 0
            ? "El esquema de identidad de dominio está disponible."
            : "No se pudo validar identidad de dominio porque falta el esquema núcleo.",
      },
      migrationFoundation: {
        ok: foundationMissing.length === 0,
        requiredForCurrentRuntime: false,
        detail:
          foundationMissing.length === 0
            ? "Las tablas de migración 0003–0010 están disponibles."
            : "Las tablas de la siguiente fase de migración todavía no están aplicadas.",
      },
      legacyProviders: {
        ok: true,
        detail: "Este diagnóstico no imprime secretos ni datos de usuario.",
      },
    };

    return NextResponse.json(
      {
        ok: results.runtime.ok && results.database.ok && results.domainAuth.ok,
        timestamp,
        results,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        timestamp,
        results: {
          runtime: {
            ok: true,
            detail: "Runtime Next.js Node activo.",
          },
          database: {
            ok: false,
            detail: "No fue posible consultar PostgreSQL.",
          },
        },
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
