"use server";

import {
  AdminAnnouncementDisplay,
  AdminCapability,
  type AdminPublicCtaLocation,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { buildVisibilityRule, getPlacementForLegacyLocation } from "@/lib/admin-placement";
import { prisma } from "@/lib/prisma";
import { isCtaLocation } from "@/config/adminCatalogs";

function isValidAnnouncementUrl(url: string) {
  if (!url) return true;
  if (url.startsWith("/") || url.startsWith("#")) return true;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "mailto:" ||
      parsed.protocol === "tel:"
    );
  } catch {
    return false;
  }
}

const parseDisplay = (value: string): AdminAnnouncementDisplay | null => {
  if (value === "banner") return AdminAnnouncementDisplay.banner;
  if (value === "popout") return AdminAnnouncementDisplay.popout;
  return null;
};

export async function upsertAnnouncementAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
    const admin = await requireAdminCapabilityUser(AdminCapability.manage_ctas);

    const id = String(formData.get("id") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const locationRaw = String(formData.get("location") ?? "").trim();
    const displayRaw = String(formData.get("display") ?? "banner").trim();
    const organizationIdRaw = String(formData.get("organizationId") ?? "").trim();
    const onlyNewUsers = String(formData.get("onlyNewUsers") ?? "false") === "true";
    const url = String(formData.get("url") ?? "").trim() || null;
    const buttonLabel = String(formData.get("buttonLabel") ?? "").trim() || null;
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    const sortOrder = Number(formData.get("sortOrder") ?? 0);
    const variant = String(formData.get("variant") ?? "").trim() || null;
    const sessionStartOnly = String(formData.get("sessionStartOnly") ?? "false") === "true";
    const maxViewsRaw = String(formData.get("maxViews") ?? "").trim();
    const maxViews =
      maxViewsRaw && Number.isFinite(Number(maxViewsRaw)) && Number(maxViewsRaw) > 0
        ? Math.trunc(Number(maxViewsRaw))
        : null;

    if (!title) return { ok: false, error: "El título es requerido." };
    if (!message) return { ok: false, error: "El mensaje es requerido." };
    if (!isCtaLocation(locationRaw)) return { ok: false, error: "Ubicación inválida." };
    const location = locationRaw as AdminPublicCtaLocation;
    const placement = getPlacementForLegacyLocation(location);

    const display = parseDisplay(displayRaw);
    if (!display) return { ok: false, error: "Modo de visualización inválido." };

    if (!isValidAnnouncementUrl(url ?? "")) {
      return { ok: false, error: "URL inválida. Usa /ruta, #anchor, https://, mailto: o tel:." };
    }

    const data = {
      title,
      message,
      location,
      placementPage: placement.page,
      placementSection: placement.section,
      placementPanel: placement.panel,
      placementSlot: placement.slot,
      placementBreakpoint: placement.breakpoint,
      placementOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      display,
      organizationId: organizationIdRaw || null,
      onlyNewUsers,
      url,
      buttonLabel,
      isActive,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      variant,
      visibilityRule: buildVisibilityRule({
        organizationId: organizationIdRaw || null,
        newUserOnly: onlyNewUsers,
        sessionStartOnly,
        maxViews,
      }),
      updatedBy: admin.email,
    };

    if (id) {
      await prisma.adminAnnouncement.update({ where: { id }, data });
    } else {
      await prisma.adminAnnouncement.create({ data });
    }

    revalidatePath("/admin/comunicados");
    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/unidep");
    return { ok: true };
  } catch (err: unknown) {
    const maybeDigest = (err as { digest?: string })?.digest;
    if (typeof maybeDigest === "string" && maybeDigest.startsWith("NEXT_REDIRECT")) throw err;
    return { ok: false, error: "No fue posible guardar el comunicado." };
  }
}

export async function deleteAnnouncementAction(formData: FormData) {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  await requireAdminCapabilityUser(AdminCapability.manage_ctas);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.adminAnnouncement.delete({ where: { id } });
  revalidatePath("/admin/comunicados");
  revalidatePath("/");
  revalidatePath("/unidep");
}
