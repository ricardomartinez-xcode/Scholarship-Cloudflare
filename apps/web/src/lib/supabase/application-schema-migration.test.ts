import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function prismaTableNames(schema: string) {
  return Array.from(schema.matchAll(/model\s+(\w+)\s+\{([\s\S]*?)\n\}/g), ([, model, body]) => {
    const mappedName = body.match(/@@map\("([^"]+)"\)/)?.[1];
    return mappedName ?? model;
  });
}

describe("Supabase application schema migration", () => {
  const schema = read("packages/db/prisma/schema.prisma");
  const migration = read(
    "supabase/migrations/20260712195500_recalc_application_schema.sql",
  );
  const seed = read(
    "supabase/migrations/20260712201000_seed_canonical_campuses.sql",
  );
  const fileMetadataMigration = read(
    "supabase/migrations/20260712200500_file_asset_metadata.sql",
  );
  const integrityMigration = read(
    "supabase/migrations/20260712200000_domain_integrity_constraints.sql",
  );
  const dataApiMigration = read(
    "supabase/migrations/20260712203000_expose_recalc_api_schema.sql",
  );
  const dataApiReloadMigration = read(
    "supabase/migrations/20260712203500_reload_postgrest_schema.sql",
  );
  const documentsBucketMigration = read(
    "supabase/migrations/20260712204000_align_documents_bucket_mime_types.sql",
  );
  const serviceRoleFoundationGrant = read(
    "supabase/migrations/20260712204500_grant_service_role_foundation.sql",
  );

  it("creates every Prisma model table and protects it with RLS", () => {
    const tableNames = prismaTableNames(schema);
    const protectedTableBlock = migration.match(
      /FOREACH target_table IN ARRAY ARRAY\[([\s\S]*?)\]\s+LOOP/,
    )?.[1];
    const protectedTables = new Set(
      Array.from(protectedTableBlock?.matchAll(/'([^']+)'/g) ?? [], (match) => match[1]),
    );

    expect(tableNames).toHaveLength(61);
    expect(protectedTables.size).toBe(tableNames.length);

    for (const tableName of tableNames) {
      expect(migration).toContain(
        `CREATE TABLE "recalc_admin"."${tableName}"`,
      );
      expect(protectedTables.has(tableName), tableName).toBe(true);
    }
  });

  it("does not contain destructive schema or data operations", () => {
    expect(migration).not.toMatch(
      /^\s*(DROP\s+(TABLE|SCHEMA)|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE.*DROP\s+(COLUMN|CONSTRAINT))/im,
    );
  });

  it("limits Realtime rows to authorized domain users", () => {
    expect(migration).toContain("current_domain_user_can_read_inbox_thread");
    expect(migration).toContain("current_domain_user_can_read_training_room");
    expect(migration).toContain("inbox_message_select_participant");
    expect(migration).toContain("training_message_select_authorized");
    expect(migration).toContain("ADD TABLE recalc_admin.inbox_message");
    expect(migration).toContain('ADD TABLE recalc_admin."TrainingMessage"');
  });

  it("includes the raw SQL metadata tables used by active file routes", () => {
    for (const tableName of ["file_asset", "file_share_link", "file_asset_usage"]) {
      expect(fileMetadataMigration).toContain(
        `CREATE TABLE recalc_admin.${tableName}`,
      );
      expect(fileMetadataMigration).toContain(
        `ALTER TABLE recalc_admin.${tableName} ENABLE ROW LEVEL SECURITY`,
      );
    }

    expect(fileMetadataMigration).toContain("object_key text NOT NULL UNIQUE");
    expect(fileMetadataMigration).toContain("TO service_role");
    expect(fileMetadataMigration).not.toContain("TO authenticated");
  });

  it("preserves domain constraints that Prisma cannot model", () => {
    expect(integrityMigration).toContain(
      "quote_scenario_single_draft_per_session_idx",
    );
    expect(integrityMigration).toContain(
      "whatsapp_template_default_official_unique_idx",
    );
    expect(integrityMigration).toContain(
      "admin_additional_benefit_values_valid",
    );
    expect(integrityMigration).toContain(
      "admin_price_override_new_price_nonnegative_ck",
    );
    expect(integrityMigration).toContain("quote_scenario_average_range_ck");
    expect(integrityMigration).toContain(
      "return_subject_price_values_positive_ck",
    );
  });

  it("seeds the 24 campuses and online catalog idempotently", () => {
    const campusCodes = Array.from(seed.matchAll(/^\s*\('([^']+)'/gm), (match) => match[1]);

    expect(campusCodes).toHaveLength(25);
    expect(new Set(campusCodes).size).toBe(25);
    expect(campusCodes).toContain("ONLINE");
    expect(seed).toContain("ON CONFLICT (code) DO UPDATE");
    expect(seed).toContain("campus_count <> 24 OR online_count <> 1");
  });

  it("exposes the custom schema without pushing unrelated Auth settings", () => {
    expect(dataApiMigration).toContain(
      "pgrst.db_schemas = 'public, graphql_public, recalc_admin'",
    );
    expect(dataApiMigration).toContain("NOTIFY pgrst, 'reload config'");
    expect(dataApiMigration).not.toContain("site_url");
    expect(dataApiMigration).not.toContain("config/auth");
    expect(dataApiReloadMigration).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it("keeps the documents bucket MIME rules aligned with the server adapter", () => {
    for (const mimeType of [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "video/mp4",
      "video/webm",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]) {
      expect(documentsBucketMigration).toContain(`'${mimeType}'`);
    }
  });

  it("allows service-role administration of the RLS foundation tables", () => {
    for (const tableName of [
      "profiles",
      "organizations",
      "organization_members",
      "file_assets",
      "inbox_messages",
      "training_messages",
      "migration_batches",
    ]) {
      expect(serviceRoleFoundationGrant).toContain(`recalc_admin.${tableName}`);
    }

    expect(serviceRoleFoundationGrant).toContain("TO service_role");
    expect(serviceRoleFoundationGrant).not.toContain("TO anon");
    expect(serviceRoleFoundationGrant).not.toContain("TO authenticated");
  });
});
