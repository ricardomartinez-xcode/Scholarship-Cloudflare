"use server";

import { revalidatePath } from "next/cache";
import { AdminCapability, ProgramOfferingDelivery } from "@prisma/client";

import { normalizeAcademicOfferCycle } from "@/config/academicOffer";
import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { normalizeBusinessLine } from "@/lib/pricing-normalize";
import { normalizeAcademicPricingPlans } from "@/lib/academic-offer-plans";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_ROUTE_CACHE_TAGS,
  revalidatePublicRouteTags,
} from "@/lib/public-route-cache";

const OFFERS_WRITE_CAPABILITY = AdminCapability.manage_offers;

const REVALIDATE_PATHS = [
  "/admin/oferta",
  "/api/public/oferta",
  "/api/public/planes",
  "/api/data/pricing-options",
  "/unidep",
] as const;

function revalidateOfferSurfaces() {
  for (const path of REVALIDATE_PATHS) revalidatePath(path);
  revalidatePublicRouteTags([
    PUBLIC_ROUTE_CACHE_TAGS.oferta,
    PUBLIC_ROUTE_CACHE_TAGS.planes,
  ]);
}

function formBoolean(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() === "true";
}

export async function upsertAcademicOfferAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminCapabilityUser(OFFERS_WRITE_CAPABILITY);

    const id = String(formData.get("id") ?? "").trim();
    const campusId = String(formData.get("campusId") ?? "").trim();
    const programId = String(formData.get("programId") ?? "").trim();
    const cycle = normalizeAcademicOfferCycle(String(formData.get("cycle") ?? ""));
    const deliveryRaw = String(formData.get("delivery") ?? "").trim();
    const delivery =
      deliveryRaw === ProgramOfferingDelivery.ONLINE
        ? ProgramOfferingDelivery.ONLINE
        : ProgramOfferingDelivery.CAMPUS;
    const lineRaw = String(formData.get("lineOfBusiness") ?? "").trim();
    const lineOfBusiness = normalizeBusinessLine(lineRaw) ?? null;
    const pricingPlans = normalizeAcademicPricingPlans(formData.get("pricingPlans"));
    const escolarizado =
      delivery === ProgramOfferingDelivery.ONLINE ? false : formBoolean(formData, "escolarizado");
    const ejecutivo =
      delivery === ProgramOfferingDelivery.ONLINE ? false : formBoolean(formData, "ejecutivo");
    const escolarizadoSchedule =
      delivery === ProgramOfferingDelivery.ONLINE
        ? null
        : String(formData.get("escolarizadoSchedule") ?? "").trim() || null;
    const ejecutivoSchedule =
      delivery === ProgramOfferingDelivery.ONLINE
        ? null
        : String(formData.get("ejecutivoSchedule") ?? "").trim() || null;
    const isActive = formBoolean(formData, "isActive");

    if (!campusId || !programId || !cycle) {
      return { ok: false, error: "Plantel, programa y ciclo son requeridos." };
    }
    if (delivery === ProgramOfferingDelivery.CAMPUS && !escolarizado && !ejecutivo) {
      return { ok: false, error: "Selecciona Escolarizado y/o Ejecutivo." };
    }

    const data = {
      campusId,
      programId,
      cycle,
      delivery,
      escolarizado,
      ejecutivo,
      escolarizadoSchedule,
      ejecutivoSchedule,
      lineOfBusiness,
      pricingPlans,
      isActive,
      archivedAt: isActive ? null : new Date(),
      archivedReason: isActive ? null : "manual_admin",
    };

    if (id) {
      await prisma.programOffering.update({
        where: { id },
        data,
      });
    } else {
      await prisma.programOffering.upsert({
        where: {
          campusId_programId_cycle: {
            campusId,
            programId,
            cycle,
          },
        },
        update: data,
        create: data,
      });
    }

    revalidateOfferSurfaces();
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible guardar la oferta." };
  }
}

export async function deleteAcademicOfferAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminCapabilityUser(OFFERS_WRITE_CAPABILITY);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false, error: "ID requerido." };

    await prisma.programOffering.delete({ where: { id } });
    revalidateOfferSurfaces();
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible eliminar la oferta." };
  }
}
