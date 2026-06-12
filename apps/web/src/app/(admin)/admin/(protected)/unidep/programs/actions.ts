"use server";

import { revalidatePath } from "next/cache";
import { AdminCapability } from "@prisma/client";
import { normalizeAcademicProgramName } from "@relead/db/program-name-normalization";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { assignFileAssetUsage, clearFileAssetUsage } from "@/lib/file-assets";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_ROUTE_CACHE_TAGS,
  revalidatePublicRouteTags,
} from "@/lib/public-route-cache";

const OFFERS_WRITE_CAPABILITY = AdminCapability.manage_offers;

function validateUrl(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return null;
  }
  return trimmed;
}

const REVALIDATE_PATHS = [
  "/admin/unidep/programs",
  "/api/public/oferta",
  "/api/public/planes",
  "/unidep",
] as const;

const VALID_LINES = ["salud", "licenciatura", "prepa", "posgrado"] as const;

function readProgramForm(formData: FormData) {
  const nameRaw = String(formData.get("name") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "").trim() || null;
  const levelRaw = String(formData.get("level") ?? "").trim() || null;
  const businessLineRaw = String(formData.get("businessLine") ?? "").trim() || null;
  const planPdfUrlRaw = String(formData.get("planPdfUrl") ?? "").trim() || null;
  const brochurePdfUrlRaw = String(formData.get("brochurePdfUrl") ?? "").trim() || null;
  const businessLine = VALID_LINES.find((line) => line === businessLineRaw) ?? null;
  const planPdfUrl = validateUrl(planPdfUrlRaw);
  const brochurePdfUrl = validateUrl(brochurePdfUrlRaw);

  return {
    nameRaw,
    categoryRaw,
    levelRaw,
    businessLine,
    planPdfUrlRaw,
    brochurePdfUrlRaw,
    planPdfUrl,
    brochurePdfUrl,
  };
}

async function syncProgramAssets(programId: string, formData: FormData) {
  const assetSlots = [
    ["study_plan_pdf", String(formData.get("r2StudyPlanFileId") ?? "").trim()],
    ["brochure_pdf", String(formData.get("r2BrochureFileId") ?? "").trim()],
    ["hero_image", String(formData.get("r2HeroImageFileId") ?? "").trim()],
    ["thumbnail_image", String(formData.get("r2ThumbnailImageFileId") ?? "").trim()],
  ] as const;

  for (const [slot, fileId] of assetSlots) {
    if (fileId) {
      await assignFileAssetUsage(fileId, {
        targetType: "program",
        targetId: programId,
        slot,
        isPrimary: true,
        sortOrder: 0,
      });
    } else {
      await clearFileAssetUsage({
        targetType: "program",
        targetId: programId,
        slot,
      });
    }
  }
}

function revalidateProgramSurfaces() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p);
  revalidatePublicRouteTags([
    PUBLIC_ROUTE_CACHE_TAGS.oferta,
    PUBLIC_ROUTE_CACHE_TAGS.planes,
  ]);
}

export async function updateProgramUnidepAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(OFFERS_WRITE_CAPABILITY);

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false, error: "ID requerido." };

    const {
      nameRaw,
      categoryRaw,
      levelRaw,
      businessLine,
      planPdfUrlRaw,
      brochurePdfUrlRaw,
      planPdfUrl,
      brochurePdfUrl,
    } = readProgramForm(formData);

    if (planPdfUrlRaw && !planPdfUrl) {
      return { ok: false, error: "planPdfUrl debe ser una URL válida (http/https)." };
    }
    if (brochurePdfUrlRaw && !brochurePdfUrl) {
      return { ok: false, error: "brochurePdfUrl debe ser una URL válida (http/https)." };
    }

    const normalizedName = nameRaw ? normalizeAcademicProgramName(nameRaw) : null;

    await prisma.program.update({
      where: { id },
      data: {
        ...(normalizedName ? { name: normalizedName.name, nameNormalized: normalizedName.nameNormalized } : {}),
        category: categoryRaw,
        level: levelRaw,
        businessLine,
        planPdfUrl,
        brochurePdfUrl,
        updatedAt: new Date(),
      },
    });

    await syncProgramAssets(id, formData);

    revalidateProgramSurfaces();
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible actualizar el programa." };
  }
}

export async function createProgramUnidepAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(OFFERS_WRITE_CAPABILITY);

    const {
      nameRaw,
      categoryRaw,
      levelRaw,
      businessLine,
      planPdfUrlRaw,
      brochurePdfUrlRaw,
      planPdfUrl,
      brochurePdfUrl,
    } = readProgramForm(formData);

    if (!nameRaw) {
      return { ok: false, error: "Nombre del programa requerido." };
    }
    if (planPdfUrlRaw && !planPdfUrl) {
      return { ok: false, error: "planPdfUrl debe ser una URL válida (http/https)." };
    }
    if (brochurePdfUrlRaw && !brochurePdfUrl) {
      return { ok: false, error: "brochurePdfUrl debe ser una URL válida (http/https)." };
    }

    const normalizedName = normalizeAcademicProgramName(nameRaw);
    const existing = await prisma.program.findUnique({
      where: { nameNormalized: normalizedName.nameNormalized },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, error: "Ya existe un programa con ese nombre." };
    }

    const created = await prisma.program.create({
      data: {
        name: normalizedName.name,
        nameNormalized: normalizedName.nameNormalized,
        category: categoryRaw,
        level: levelRaw,
        businessLine,
        planPdfUrl,
        brochurePdfUrl,
      },
      select: { id: true },
    });

    await syncProgramAssets(created.id, formData);
    revalidateProgramSurfaces();
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible crear el programa." };
  }
}

export async function deleteProgramAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(OFFERS_WRITE_CAPABILITY);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false, error: "ID requerido." };
    await prisma.program.delete({ where: { id } });
    revalidateProgramSurfaces();
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible eliminar el programa." };
  }
}
