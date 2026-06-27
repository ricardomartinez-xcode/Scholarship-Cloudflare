import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const DEFAULT_OUTPUT = "apps/web/.tmp/d1-core-data.sql";

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function resolveDatabaseUrl() {
  const candidates = [
    process.env.DIRECT_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.DATABASE_URL,
  ].filter(Boolean) as string[];
  const url = candidates.find((candidate) => !candidate.startsWith("prisma+postgres://"));
  if (!url) {
    throw new Error(
      "Missing direct Postgres URL. Set DIRECT_URL, POSTGRES_URL_NON_POOLING, DATABASE_URL_UNPOOLED, POSTGRES_URL, POSTGRES_PRISMA_URL, or DATABASE_URL.",
    );
  }
  process.env.DATABASE_URL = url;
  return url;
}

function sql(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return sql(value.toISOString());
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insert(table: string, values: Record<string, unknown>) {
  const columns = Object.keys(values);
  return `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${columns
    .map((column) => sql(values[column]))
    .join(", ")});`;
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function readFileAssets(prisma: PrismaClient) {
  try {
    return await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id::text, object_key, bucket, file_name, mime_type, size_bytes,
              owner_user_id::text, visibility, created_at, updated_at
       FROM "recalc_admin"."file_asset"
       ORDER BY created_at ASC`,
    );
  } catch {
    return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id::text, r2_key AS object_key, bucket, file_name, mime_type, size_bytes,
              uploaded_by_user_id::text AS owner_user_id, status AS visibility, created_at, updated_at
       FROM "recalc_admin"."file_asset"
       ORDER BY created_at ASC`,
    );
  }
}

async function readFileAssetUsages(prisma: PrismaClient) {
  return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id::text, file_id::text, target_type, target_id, slot, sort_order,
            is_primary, created_at, updated_at
     FROM "recalc_admin"."file_asset_usage"
     ORDER BY created_at ASC`,
  ).catch(() => []);
}

async function main() {
  const outputPath = path.resolve(getArg("out") ?? DEFAULT_OUTPUT);
  const envFile = getArg("env-file");
  if (envFile) dotenv.config({ path: envFile });
  dotenv.config({ path: ".env.local" });
  dotenv.config();
  resolveDatabaseUrl();
  const prisma = new PrismaClient();

  try {
    const [
      campuses,
      programs,
      offerings,
      academicFees,
      campusAcademicFees,
      bulletins,
      priceOverrides,
      sidebarInfo,
      scholarshipRules,
      additionalBenefits,
      additionalBenefitCampuses,
      fileAssets,
      fileAssetUsages,
    ] = await Promise.all([
      prisma.campus.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      prisma.program.findMany({ orderBy: [{ name: "asc" }] }),
      prisma.programOffering.findMany({ orderBy: [{ createdAt: "asc" }] }),
      prisma.academicFee.findMany({ orderBy: [{ section: "asc" }, { concept: "asc" }] }),
      prisma.campusAcademicFee.findMany({ orderBy: [{ createdAt: "asc" }] }),
      prisma.bulletin.findMany({ orderBy: [{ createdAt: "asc" }] }),
      prisma.adminPriceOverride.findMany({ orderBy: [{ createdAt: "asc" }] }),
      prisma.adminSidebarInfo.findMany({ orderBy: [{ key: "asc" }] }),
      prisma.scholarshipRule.findMany({ orderBy: [{ createdAt: "asc" }] }),
      prisma.adminAdditionalBenefit.findMany({ orderBy: [{ createdAt: "asc" }] }),
      prisma.adminAdditionalBenefitCampus.findMany(),
      readFileAssets(prisma),
      readFileAssetUsages(prisma),
    ]);

    const lines: string[] = [
      "DELETE FROM file_asset_usage;",
      "DELETE FROM file_asset;",
      "DELETE FROM bulletin;",
      "DELETE FROM campus_academic_fee;",
      "DELETE FROM academic_fee;",
      "DELETE FROM admin_price_override;",
      "DELETE FROM admin_additional_benefit_campus;",
      "DELETE FROM admin_additional_benefit;",
      "DELETE FROM scholarship_rule;",
      "DELETE FROM program_offering;",
      "DELETE FROM program;",
      "DELETE FROM campus;",
      "DELETE FROM admin_sidebar_info;",
    ];

    for (const campus of campuses) {
      lines.push(insert("campus", {
        id: campus.id,
        code: campus.code,
        meta_key: campus.metaKey,
        name: campus.name,
        slug: campus.slug,
        tier: campus.tier,
        kind: campus.kind,
        is_active: campus.isActive,
        sort_order: campus.sortOrder,
        address: campus.address,
        phone: campus.phone,
        whatsapp: campus.whatsapp,
        created_at: iso(campus.createdAt),
        updated_at: iso(campus.updatedAt),
      }));
    }

    for (const program of programs) {
      lines.push(insert("program", {
        id: program.id,
        name: program.name,
        name_normalized: program.nameNormalized,
        level: program.level,
        category: program.category,
        plan_drive_file_id: program.planDriveFileId,
        plan_drive_link: program.planDriveLink,
        plan_url: program.planUrl,
        business_line: program.businessLine,
        plan_pdf_url: program.planPdfUrl,
        brochure_pdf_url: program.brochurePdfUrl,
        created_at: iso(program.createdAt),
        updated_at: iso(program.updatedAt),
      }));
    }

    for (const offering of offerings) {
      lines.push(insert("program_offering", {
        id: offering.id,
        campus_id: offering.campusId,
        program_id: offering.programId,
        cycle: offering.cycle,
        track: offering.track,
        delivery: offering.delivery,
        escolarizado: offering.escolarizado,
        ejecutivo: offering.ejecutivo,
        escolarizado_schedule: offering.escolarizadoSchedule,
        ejecutivo_schedule: offering.ejecutivoSchedule,
        line_of_business: offering.lineOfBusiness,
        pricing_plans: JSON.stringify(offering.pricingPlans ?? []),
        module_count: offering.moduleCount,
        subjects_by_module: offering.subjectsByModule,
        is_active: offering.isActive,
        archived_at: iso(offering.archivedAt),
        archived_reason: offering.archivedReason,
        updated_by: offering.updatedBy,
        created_at: iso(offering.createdAt),
        updated_at: iso(offering.updatedAt),
      }));
    }

    for (const fee of academicFees) {
      lines.push(insert("academic_fee", {
        id: fee.id,
        code: fee.code,
        concept: fee.concept,
        cost_mxn: fee.costMxn,
        section: fee.section,
        is_active: fee.isActive,
        created_at: iso(fee.createdAt),
        updated_at: iso(fee.updatedAt),
      }));
    }

    for (const link of campusAcademicFees) {
      lines.push(insert("campus_academic_fee", {
        id: link.id,
        campus_id: link.campusId,
        academic_fee_id: link.academicFeeId,
        is_active: link.isActive,
        override_cost_mxn: link.overrideCostMxn,
        created_at: iso(link.createdAt),
        updated_at: iso(link.updatedAt),
      }));
    }

    for (const bulletin of bulletins) {
      lines.push(insert("bulletin", {
        id: bulletin.id,
        campus_id: bulletin.campusId,
        cycle: bulletin.cycle,
        file_name: bulletin.fileName,
        file_path: bulletin.filePath,
        created_at: iso(bulletin.createdAt),
        updated_at: iso(bulletin.updatedAt),
      }));
    }

    for (const override of priceOverrides) {
      lines.push(insert("admin_price_override", {
        id: override.id,
        scope: override.scope,
        target_keys: JSON.stringify(override.targetKeys ?? {}),
        new_price: Number(override.newPrice),
        is_active: override.isActive,
        notes: override.notes,
        updated_by: override.updatedBy,
        created_at: iso(override.createdAt),
        updated_at: iso(override.updatedAt),
      }));
    }

    for (const info of sidebarInfo) {
      lines.push(insert("admin_sidebar_info", {
        key: info.key,
        value: info.value,
        is_active: info.isActive,
        updated_by: info.updatedBy,
        created_at: iso(info.createdAt),
        updated_at: iso(info.updatedAt),
      }));
    }

    for (const rule of scholarshipRules) {
      lines.push(insert("scholarship_rule", {
        id: rule.id,
        enrollment_type: rule.enrollmentType,
        business_line: rule.businessLine,
        modality: rule.modality,
        plan: rule.plan,
        campus_tier: rule.campusTier,
        region: rule.region,
        plantel: rule.plantel,
        programa_key: rule.programaKey,
        min_average: rule.minAverage === null ? null : Number(rule.minAverage),
        max_average: rule.maxAverage === null ? null : Number(rule.maxAverage),
        scholarship_percent:
          rule.scholarshipPercent === null ? null : Number(rule.scholarshipPercent),
        discounted_price_mxn:
          rule.discountedPriceMxn === null ? null : Number(rule.discountedPriceMxn),
        origin: rule.origin,
        source_version: rule.sourceVersion,
        created_at: iso(rule.createdAt),
        updated_at: iso(rule.updatedAt),
      }));
    }

    for (const benefit of additionalBenefits) {
      lines.push(insert("admin_additional_benefit", {
        id: benefit.id,
        applies_to_all: benefit.appliesToAll,
        benefit_type: benefit.benefitType,
        enrollment_type: benefit.enrollmentType,
        extra_percent: benefit.extraPercent,
        first_payment_amount: Number(benefit.firstPaymentAmount),
        is_active: benefit.isActive,
        notes: benefit.notes,
        business_line: benefit.businessLine,
        modality: benefit.modality,
        duration: benefit.duration,
        updated_by: benefit.updatedBy,
        created_at: iso(benefit.createdAt),
        updated_at: iso(benefit.updatedAt),
      }));
    }

    for (const link of additionalBenefitCampuses) {
      lines.push(insert("admin_additional_benefit_campus", {
        benefit_id: link.benefitId,
        campus_id: link.campusId,
      }));
    }

    for (const asset of fileAssets) {
      lines.push(insert("file_asset", {
        id: asset.id,
        object_key: asset.object_key,
        bucket: asset.bucket,
        file_name: asset.file_name,
        mime_type: asset.mime_type,
        size_bytes: asset.size_bytes,
        owner_user_id: asset.owner_user_id,
        visibility: asset.visibility,
        created_at: iso(asset.created_at as string | Date | null),
        updated_at: iso(asset.updated_at as string | Date | null),
      }));
    }

    for (const usage of fileAssetUsages) {
      lines.push(insert("file_asset_usage", {
        id: usage.id,
        file_id: usage.file_id,
        target_type: usage.target_type,
        target_id: usage.target_id,
        slot: usage.slot,
        sort_order: usage.sort_order,
        is_primary: usage.is_primary,
        created_at: iso(usage.created_at as string | Date | null),
        updated_at: iso(usage.updated_at as string | Date | null),
      }));
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
    console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
    console.log(
      `Rows: campus=${campuses.length}, program=${programs.length}, offering=${offerings.length}, fees=${academicFees.length}, priceOverrides=${priceOverrides.length}, fileAssets=${fileAssets.length}`,
      `Quote rows: scholarshipRules=${scholarshipRules.length}, additionalBenefits=${additionalBenefits.length}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
