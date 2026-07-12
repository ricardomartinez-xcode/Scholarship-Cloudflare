#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { neon } = require("@neondatabase/serverless");

const MIGRATION_NAME = "20260507_extension_session_tokens";
const USER_DISPLAY_NAME_MIGRATION = "20260523_user_display_name";
const SCHEMA = "recalc_admin";
const TABLE = "extension_session_token";
const FOREIGN_KEY = "extension_session_token_userId_fkey";

async function migrationStatus(sql, migrationName) {
  const queries = [
    {
      schema: "public",
      run: () => sql`
        SELECT "migration_name", "finished_at", "rolled_back_at"
        FROM "public"."_prisma_migrations"
        WHERE "migration_name" = ${migrationName}
        ORDER BY "started_at" DESC
        LIMIT 1
      `,
    },
    {
      schema: "recalc_admin",
      run: () => sql`
        SELECT "migration_name", "finished_at", "rolled_back_at"
        FROM "recalc_admin"."_prisma_migrations"
        WHERE "migration_name" = ${migrationName}
        ORDER BY "started_at" DESC
        LIMIT 1
      `,
    },
  ];

  for (const query of queries) {
    try {
      const rows = await query.run();
      if (rows[0]) return { ...rows[0], schema: query.schema };
    } catch (error) {
      if (String(error?.message ?? "").includes("_prisma_migrations")) {
        continue;
      }
      throw error;
    }
  }

  console.log("[vercel-build] No Prisma migration table found yet; skipping migration recovery.");
  return null;
}

async function hasExtensionSessionTokenObjects(sql) {
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

async function hasUserDisplayNameColumn(sql) {
  const rows = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = ${SCHEMA}
        AND table_name = 'user'
        AND column_name = 'displayName'
    ) AS "columnExists"
  `;
  return Boolean(rows[0]?.columnExists);
}

function resolveMigrationAsApplied(migrationName) {
  console.log(
    `[vercel-build] Resolving ${migrationName} as applied; database objects already exist.`,
  );
  const result = spawnSync(
    "prisma",
    [
      "migrate",
      "resolve",
      "--applied",
      migrationName,
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

async function recoverFailedMigration(sql, migrationName, verifyObjects) {
  const status = await migrationStatus(sql, migrationName);
  const hasFailed = status && status.finished_at === null;

  if (!hasFailed) {
    console.log(`[vercel-build] Migration ${migrationName} does not need recovery.`);
    return;
  }

  const expectedObjectsExist = await verifyObjects(sql);
  if (!expectedObjectsExist) {
    console.error(
      `[vercel-build] Migration ${migrationName} failed, but expected database objects are incomplete.`,
    );
    process.exit(1);
  }

  resolveMigrationAsApplied(migrationName);
}

async function main() {
  if (!process.env.DIRECT_URL) {
    console.log("[vercel-build] DIRECT_URL is not set; skipping migration recovery.");
    return;
  }

  const sql = neon(process.env.DIRECT_URL);
  await recoverFailedMigration(
    sql,
    MIGRATION_NAME,
    async () => {
      const objects = await hasExtensionSessionTokenObjects(sql);
      return Boolean(objects.tableExists && objects.foreignKeyExists);
    },
  );
  await recoverFailedMigration(
    sql,
    USER_DISPLAY_NAME_MIGRATION,
    () => hasUserDisplayNameColumn(sql),
  );
}

main().catch((error) => {
  console.error("[vercel-build] Failed to recover known migration state:", error.message);
  process.exit(1);
});
