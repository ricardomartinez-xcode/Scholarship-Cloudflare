import { prisma } from "@/lib/prisma";
import { resolveCampus } from "@/lib/campus-resolver";
import { normalizeCanonicalModality } from "@/lib/pricing-normalize";

export type AdminMateriaRow = {
  plantel: string;
  modalidad: string;
  materias_count: number;
  costo: number;
};

function toStoredModality(raw: string) {
  return normalizeCanonicalModality(raw) === "online" ? "online" : "presencial";
}

export async function getCanonicalMateriaRows(sourceVersion = "canonical") {
  const rows = await prisma.returnSubjectPrice.findMany({
    where: { sourceVersion },
    orderBy: [
      { campus: { name: "asc" } },
      { modality: "asc" },
      { subjectCount: "asc" },
    ],
    select: {
      modality: true,
      subjectCount: true,
      priceMxn: true,
      legacyPlantelRaw: true,
      campus: {
        select: { metaKey: true, name: true },
      },
    },
  });

  return rows.map<AdminMateriaRow>((row) => ({
    plantel: row.legacyPlantelRaw ?? row.campus.metaKey ?? row.campus.name,
    modalidad: row.modality === "online" ? "online" : "presencial",
    materias_count: row.subjectCount,
    costo: Number(row.priceMxn),
  }));
}

export async function syncCanonicalMateriaRow(params: {
  plantelRaw: string;
  modalidadRaw: string;
  materiasCount: number;
  costo: number;
  origPlantel?: string;
  origModalidad?: string;
  origMaterias?: number;
  sourceVersion?: string;
}) {
  const sourceVersion = params.sourceVersion ?? "canonical";
  const campus = await resolveCampus(params.plantelRaw);
  if (!campus) {
    return {
      ok: false as const,
      reason: "campus_not_found",
      message: `No se pudo resolver el plantel canónico para "${params.plantelRaw}".`,
    };
  }

  const modality = toStoredModality(params.modalidadRaw);
  const originalCampus =
    params.origPlantel && params.origPlantel !== params.plantelRaw
      ? await resolveCampus(params.origPlantel)
      : campus;
  const originalModality = params.origModalidad
    ? toStoredModality(params.origModalidad)
    : modality;
  const originalSubjectCount = params.origMaterias ?? params.materiasCount;

  const originalRow =
    originalCampus &&
    Number.isFinite(originalSubjectCount)
      ? await prisma.returnSubjectPrice.findFirst({
          where: {
            campusId: originalCampus.id,
            modality: originalModality,
            subjectCount: originalSubjectCount,
            sourceVersion,
          },
          select: { id: true },
        })
      : null;

  if (originalRow) {
    await prisma.returnSubjectPrice.update({
      where: { id: originalRow.id },
      data: {
        campusId: campus.id,
        modality,
        subjectCount: params.materiasCount,
        priceMxn: params.costo,
        legacyPlantelRaw: params.plantelRaw,
        legacyModalityRaw: params.modalidadRaw,
      },
    });
    return { ok: true as const, reason: "updated" as const };
  }

  const existing = await prisma.returnSubjectPrice.findFirst({
    where: {
      campusId: campus.id,
      modality,
      subjectCount: params.materiasCount,
      sourceVersion,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.returnSubjectPrice.update({
      where: { id: existing.id },
      data: {
        priceMxn: params.costo,
        legacyPlantelRaw: params.plantelRaw,
        legacyModalityRaw: params.modalidadRaw,
      },
    });
    return { ok: true as const, reason: "updated" as const };
  }

  await prisma.returnSubjectPrice.create({
    data: {
      campusId: campus.id,
      modality,
      subjectCount: params.materiasCount,
      priceMxn: params.costo,
      legacyPlantelRaw: params.plantelRaw,
      legacyModalityRaw: params.modalidadRaw,
      sourceVersion,
    },
  });

  return { ok: true as const, reason: "created" as const };
}

export async function deleteCanonicalMateriaRow(params: {
  plantelRaw: string;
  modalidadRaw: string;
  materiasCount: number;
  sourceVersion?: string;
}) {
  const sourceVersion = params.sourceVersion ?? "canonical";
  const campus = await resolveCampus(params.plantelRaw);
  if (!campus) {
    return {
      ok: false as const,
      reason: "campus_not_found",
      message: `No se pudo resolver el plantel canónico para "${params.plantelRaw}".`,
    };
  }

  await prisma.returnSubjectPrice.deleteMany({
    where: {
      campusId: campus.id,
      modality: toStoredModality(params.modalidadRaw),
      subjectCount: params.materiasCount,
      sourceVersion,
    },
  });

  return { ok: true as const, reason: "deleted" as const };
}
