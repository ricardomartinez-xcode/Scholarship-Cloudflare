"use server";

import { revalidatePath } from "next/cache";
import { AdminCapability } from "@prisma/client";

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

export async function updateProgramUnidepAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(OFFERS_WRITE_CAPABILITY);

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false, error: "ID requerido." };

    const nameRaw = String(formData.get("name") ?? "").trim();
    const categoryRaw = String(formData.get("category") ?? "").trim() || null;
    const businessLineRaw = String(formData.get("businessLine") ?? "").trim() || null;
    const planPdfUrlRaw = String(formData.get("planPdfUrl") ?? "").trim() || null;
    const brochurePdfUrlRaw = String(formData.get("brochurePdfUrl") ?? "").trim() || null;

    const validLines = ["salud", "licenciatura", "prepa", "posgrado"] as const;
    const businessLine = validLines.find((l) => l === businessLineRaw) ?? null;

    const planPdfUrl = validateUrl(planPdfUrlRaw);
    const brochurePdfUrl = validateUrl(brochurePdfUrlRaw);

    if (planPdfUrlRaw && !planPdfUrl) {
      return { ok: false, error: "planPdfUrl debe ser una URL válida (http/https)." };
    }
    if (brochurePdfUrlRaw && !brochurePdfUrl) {
      return { ok: false, error: "brochurePdfUrl debe ser una URL válida (http/https)." };
    }

    await prisma.program.update({
      where: { id },
      data: {
        ...(nameRaw ? { name: nameRaw } : {}),
        category: categoryRaw,
        businessLine: businessLine ?? undefined,
        planPdfUrl,
        brochurePdfUrl,
        updatedAt: new Date(),
      },
    });

    const assetSlots = [
      ["study_plan_pdf", String(formData.get("r2StudyPlanFileId") ?? "").trim()],
      ["brochure_pdf", String(formData.get("r2BrochureFileId") ?? "").trim()],
      ["hero_image", String(formData.get("r2HeroImageFileId") ?? "").trim()],
    ] as const;

    for (const [slot, fileId] of assetSlots) {
      if (fileId) {
        await assignFileAssetUsage(fileId, {
          targetType: "program",
          targetId: id,
          slot,
          isPrimary: true,
          sortOrder: 0,
        });
      } else {
        await clearFileAssetUsage({
          targetType: "program",
          targetId: id,
          slot,
        });
      }
    }

    for (const p of REVALIDATE_PATHS) revalidatePath(p);
    revalidatePublicRouteTags([
      PUBLIC_ROUTE_CACHE_TAGS.oferta,
      PUBLIC_ROUTE_CACHE_TAGS.planes,
    ]);
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible actualizar el programa." };
  }
}

export async function deleteProgramAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(OFFERS_WRITE_CAPABILITY);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false, error: "ID requerido." };
    await prisma.program.delete({ where: { id } });
    for (const p of REVALIDATE_PATHS) revalidatePath(p);
    revalidatePublicRouteTags([
      PUBLIC_ROUTE_CACHE_TAGS.oferta,
      PUBLIC_ROUTE_CACHE_TAGS.planes,
    ]);
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible eliminar el programa." };
  }
}
