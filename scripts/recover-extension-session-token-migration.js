#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { neon } = require("@neondatabase/serverless");

const MIGRATION_NAME = "20260507_extension_session_tokens";
const SCHEMA = "recalc_admin";
const TABLE = "extension_session_token";
const FOREIGN_KEY = "extension_session_token_userId_fkey";

async function migrationStatus(sql) {
  try {
    const rows = await sql`
      SELECT "migration_name", "finished_at", "rolled_back_at"
      FROM "recalc_admin"."_prisma_migrations"
      WHERE "migration_name" = ${MIGRATION_NAME}
      ORDER BY "started_at" DESC
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch (error) {
    if (String(error?.message ?? "").includes("_prisma_migrations")) {
      console.log("[vercel-build] No Prisma migration table found yet; skipping migration recovery.");
      return null;
    }
    throw error;
  }
}

async function hasExpectedObjects(sql) {
  const rows = await sql`
    SELECT
      to_regclass('"recalc_admin"."extension_session_token"') IS NOT NULL AS "tableExists",
      EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class rel ON rel.oid = c.conrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        WHERE ns.nspname = ${SCHEMA}
          AND rel.relname = ${TABLE}
          AND c.conname = ${FOREIGN_KEY}
      ) AS "foreignKeyExists"
  `;

  return rows[0] ?? { tableExists: false, foreignKeyExists: false };
}

async function main() {
  if (!process.env.DIRECT_URL) {
    console.log("[vercel-build] DIRECT_URL is not set; skipping migration recovery.");
    return;
  }

  const sql = neon(process.env.DIRECT_URL);
  const status = await migrationStatus(sql);
  const hasFailed =
    status &&
    status.finished_at === null &&
    status.rolled_back_at === null;

  if (!hasFailed) {
    console.log(`[vercel-build] Migration ${MIGRATION_NAME} does not need recovery.`);
    return;
  }

  const objects = await hasExpectedObjects(sql);
  if (!objects.tableExists || !objects.foreignKeyExists) {
    console.error(
      `[vercel-build] Migration ${MIGRATION_NAME} failed, but expected database objects are incomplete.`,
    );
    process.exit(1);
  }

  console.log(`[vercel-build] Resolving ${MIGRATION_NAME} as applied; database objects already exist.`);
  const result = spawnSync(
    "prisma",
    [
      "migrate",
      "resolve",
      "--applied",
      MIGRATION_NAME,
      "--schema",
      "packages/db/prisma/schema.prisma",
    ],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main().catch((error) => {
  console.error("[vercel-build] Failed to recover known migration state:", error.message);
  process.exit(1);
});
