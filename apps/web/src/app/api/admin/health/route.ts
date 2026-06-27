import { NextResponse } from "next/server";

import { d1All, d1First } from "@/lib/cloudflare/d1";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";

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
  "conversation",
  "outbox_event",
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
 * Read-only deployment health endpoint for the Cloudflare cutover.
 * It deliberately avoids Neon, Prisma, Supabase and secret values. This
 * endpoint is intentionally available without a session, so it reports only
 * aggregate status and never exposes resource identifiers or row counts.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  if (!isCloudflareRuntime()) {
    return NextResponse.json(
      {
        ok: false,
        timestamp,
        results: {
          runtime: {
            ok: false,
            detail: "Este diagnóstico sólo se ejecuta dentro del runtime Cloudflare.",
          },
        },
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const ping = await d1First<{ ok: number }>("SELECT 1 AS ok");
    const present = await listPresentTables([...CORE_TABLES, ...FOUNDATION_TABLES]);
    const coreMissing = missingTables(CORE_TABLES, present);
    const foundationMissing = missingTables(FOUNDATION_TABLES, present);

    const results = {
      runtime: {
        ok: true,
        detail: "Cloudflare Worker runtime activo.",
      },
      d1: {
        ok: ping?.ok === 1 && coreMissing.length === 0,
        detail:
          coreMissing.length === 0
            ? "D1 responde y el esquema núcleo está disponible."
            : "D1 responde, pero el esquema núcleo está incompleto.",
      },
      cloudflareAuth: {
        ok: coreMissing.length === 0,
        detail:
          coreMissing.length === 0
            ? "El esquema de autenticación D1 está disponible."
            : "No se pudo validar autenticación D1 porque falta el esquema núcleo.",
      },
      migrationFoundation: {
        ok: foundationMissing.length === 0,
        requiredForCurrentRuntime: false,
        detail:
          foundationMissing.length === 0
            ? "Las tablas de migración 0003–0008 están disponibles."
            : "Las tablas de la siguiente fase de migración todavía no están aplicadas.",
      },
      legacyProviders: {
        ok: true,
        detail: "Neon, Prisma y Supabase no se consultan por diseño en este diagnóstico.",
      },
    };

    return NextResponse.json(
      {
        ok: results.runtime.ok && results.d1.ok && results.cloudflareAuth.ok,
        timestamp,
        results,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        timestamp,
        results: {
          runtime: {
            ok: true,
            detail: "Cloudflare Worker runtime activo.",
          },
          d1: {
            ok: false,
            detail: "No fue posible consultar D1.",
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
