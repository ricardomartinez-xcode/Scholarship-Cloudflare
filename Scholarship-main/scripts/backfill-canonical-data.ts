import path from "node:path";

import dotenv from "dotenv";

import { syncDirectoryContactMethods } from "@/lib/directory-contact-sync";
import { getSql } from "@/lib/neon";
import { normalizeBusinessLine, normalizeCanonicalModality, normalizeTier } from "@/lib/pricing-normalize";
import { prisma } from "@/lib/prisma";
import { createComparisonSummary } from "@/lib/runtime-comparison";
import { syncCanonicalMateriaRow } from "@/lib/return-subject-price-admin";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const sql = getSql();
  const metaRows = await sql`
    select version
    from recalc_meta
    order by id desc
    limit 1
  `;
  const sourceVersion = String(metaRows[0]?.version ?? "legacy");

  const summary = createComparisonSummary();
  const mismatches: Array<Record<string, unknown>> = [];

  const scholarshipRows = await sql`
    select
      id,
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
    from recalc_regla_beca
    order by id
  `;

  for (const row of scholarshipRows) {
    summary.read += 1;
    const businessLine = normalizeBusinessLine(row.nivel_key);
    const modality = normalizeCanonicalModality(row.modalidad_key);
    if (!businessLine || !modality) {
      summary.rejected += 1;
      mismatches.push({
        channel: "scholarship_rule",
        legacyRowId: row.id,
        reason: "invalid_business_line_or_modality",
        nivel_key: row.nivel_key,
        modalidad_key: row.modalidad_key,
      });
      continue;
    }

    const nextData = {
      enrollmentType: row.programa_key,
      businessLine,
      modality,
      plan: Number(row.plan),
      campusTier: normalizeTier(row.tier),
      minAverage: row.rango_min,
      maxAverage: row.rango_max,
      scholarshipPercent: row.porcentaje,
      discountedPriceMxn: row.monto,
      origin: row.origen ? String(row.origen) : null,
      sourceVersion,
    } as const;

    const existing = await prisma.scholarshipRule.findUnique({
      where: { legacyRowId: BigInt(row.id) },
      select: {
        id: true,
        enrollmentType: true,
        businessLine: true,
        modality: true,
        plan: true,
        campusTier: true,
        minAverage: true,
        maxAverage: true,
        scholarshipPercent: true,
        discountedPriceMxn: true,
        origin: true,
        sourceVersion: true,
      },
    });

    if (!existing) {
      await prisma.scholarshipRule.create({
        data: {
          ...nextData,
          legacyRowId: BigInt(row.id),
        },
      });
      summary.created += 1;
      continue;
    }

    const current = JSON.stringify({
      ...existing,
      minAverage: existing.minAverage?.toString() ?? null,
      maxAverage: existing.maxAverage?.toString() ?? null,
      scholarshipPercent: existing.scholarshipPercent?.toString() ?? null,
      discountedPriceMxn: existing.discountedPriceMxn?.toString() ?? null,
    });
    const target = JSON.stringify({
      ...nextData,
      minAverage: nextData.minAverage?.toString() ?? null,
      maxAverage: nextData.maxAverage?.toString() ?? null,
      scholarshipPercent: nextData.scholarshipPercent?.toString() ?? null,
      discountedPriceMxn: nextData.discountedPriceMxn?.toString() ?? null,
    });

    if (current === target) {
      summary.skipped += 1;
      continue;
    }

    await prisma.scholarshipRule.update({
      where: { id: existing.id },
      data: nextData,
    });
    summary.updated += 1;
  }

  const legacyReturnRows = await sql`
    select plantel, modalidad, materias_count, costo
    from recalc_regreso_materias
    order by plantel, modalidad, materias_count
  `;

  for (const row of legacyReturnRows) {
    summary.read += 1;
    const result = await syncCanonicalMateriaRow({
      plantelRaw: String(row.plantel),
      modalidadRaw: String(row.modalidad),
      materiasCount: Number(row.materias_count),
      costo: Number(row.costo),
      sourceVersion,
    });

    if (!result.ok) {
      summary.rejected += 1;
      mismatches.push({
        channel: "return_subject_price",
        plantel: row.plantel,
        modalidad: row.modalidad,
        materias_count: row.materias_count,
        reason: result.reason,
        message: result.message,
      });
      continue;
    }

    if (result.reason === "created") summary.created += 1;
    else summary.updated += 1;
  }

  const directoryContacts = await prisma.directoryContact.findMany({
    select: {
      id: true,
      email: true,
      phone: true,
    },
  });

  for (const contact of directoryContacts) {
    summary.read += 1;
    const rawContact = [contact.email, contact.phone].filter(Boolean).join(" | ");
    const result = await syncDirectoryContactMethods(contact.id, rawContact);
    if (result.status === "created") summary.created += 1;
    else if (result.status === "updated") summary.updated += 1;
    else summary.skipped += 1;
  }

  console.log(
    JSON.stringify(
      {
        ok: mismatches.length === 0,
        sourceVersion,
        summary,
        mismatches,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
