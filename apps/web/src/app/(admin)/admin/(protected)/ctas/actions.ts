"use server";

import {
  AdminCapability,
  AdminAuditAction,
  AdminConfigModule,
  AdminPublicCtaKind,
  Role,
  type AdminPublicCtaLocation,
  type UserCapability,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { buildVisibilityRule, getPlacementForLegacyLocation } from "@/lib/admin-placement";
import { prisma } from "@/lib/prisma";
import { isCtaLocation } from "@/config/adminCatalogs";
import { isUserCapability } from "@/lib/user-capabilities";

function isValidLinkUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidActionUrl(url: string) {
  if (!url) return true; // optional for action
  // Allow absolute paths, anchors, http/https, mailto, tel
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

const parseCtaKind = (value: string): AdminPublicCtaKind | null => {
  if (value === "link") return AdminPublicCtaKind.link;
  if (value === "action") return AdminPublicCtaKind.action;
  return null;
};

const ROLE_SET = new Set(Object.values(Role));

function parseStringArrayField(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  const raw = value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed.map((item) => String(item ?? "").trim()).filter(Boolean),
      ),
    );
  } catch {
    return Array.from(
      new Set(
        raw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }
}

function parseRoleArrayField(value: FormDataEntryValue | null): Role[] {
  const items = parseStringArrayField(value);
  return items.filter((item): item is Role => ROLE_SET.has(item as Role));
}

function parseCapabilityArrayField(value: FormDataEntryValue | null): UserCapability[] {
  const items = parseStringArrayField(value);
  return items.filter((item): item is UserCapability => isUserCapability(item));
}

async function loadCtaAuditPayload(id: string) {
  return prisma.adminPublicCta.findUnique({
    where: { id },
    select: {
      id: true,
      label: true,
      kind: true,
      location: true,
      placementPage: true,
      placementSection: true,
      placementPanel: true,
      placementSlot: true,
      placementBreakpoint: true,
      placementOrder: true,
      url: true,
      isActive: true,
      sortOrder: true,
      variant: true,
      organizationId: true,
      onlyNewUsers: true,
      requiredCapability: true,
      visibilityRule: true,
      updatedBy: true,
    },
  });
}

export async function upsertPublicCtaAction(formData: FormData) {
  try {
    await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
    const admin = await requireAdminCapabilityUser(AdminCapability.manage_ctas);

    const id = String(formData.get("id") ?? "").trim();
    const label = String(formData.get("label") ?? "").trim();
    const kindRaw = String(formData.get("kind") ?? "").trim();
    const locationRaw = String(formData.get("location") ?? "").trim();
    const url = String(formData.get("url") ?? "").trim() || null;
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    const sortOrder = Number(formData.get("sortOrder") ?? 0);
    const variant = String(formData.get("variant") ?? "").trim() || null;
    const organizationId = String(formData.get("organizationId") ?? "").trim() || null;
    const onlyNewUsers = String(formData.get("onlyNewUsers") ?? "false") === "true";
    const requiredCapabilityRaw = String(formData.get("requiredCapability") ?? "").trim() || null;
    const requiredCapability: UserCapability | null =
      requiredCapabilityRaw && isUserCapability(requiredCapabilityRaw)
        ? requiredCapabilityRaw
        : null;
    const excludeOrganizationIds = parseStringArrayField(
      formData.get("excludeOrganizationIds"),
    );
    const excludeRoles = parseRoleArrayField(formData.get("excludeRoles"));
    const excludeCapabilities = parseCapabilityArrayField(
      formData.get("excludeCapabilities"),
    );
    const excludeUserIds = parseStringArrayField(formData.get("excludeUserIds"));

    if (!label) return { ok: false, error: "Label es requerido." };

    const kind = parseCtaKind(kindRaw);
    if (!kind) {
      return { ok: false, error: "Kind inválido." };
    }

    if (!isCtaLocation(locationRaw)) {
      return { ok: false, error: "Ubicación inválida." };
    }
    const location = locationRaw as AdminPublicCtaLocation;
    const placement = getPlacementForLegacyLocation(location);

    if (kind === AdminPublicCtaKind.link) {
      if (!url) return { ok: false, error: "URL es requerida cuando kind=link." };
      if (!isValidLinkUrl(url)) {
        return { ok: false, error: "URL debe ser http/https válida cuando kind=link." };
      }
    }

    if (kind === AdminPublicCtaKind.action) {
      if (url && !isValidActionUrl(url)) {
        return {
          ok: false,
          error: "URL inválida para kind=action. Usa /ruta, #anchor, https://, mailto: o tel:.",
        };
      }
    }

    const data = {
      label,
      kind,
      location,
      placementPage: placement.page,
      placementSection: placement.section,
      placementPanel: placement.panel,
      placementSlot: placement.slot,
      placementBreakpoint: placement.breakpoint,
      placementOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      url: kind === AdminPublicCtaKind.link ? url : (url || null),
      isActive,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      variant,
      organizationId,
      onlyNewUsers,
      requiredCapability,
      visibilityRule: buildVisibilityRule({
        organizationId,
        newUserOnly: onlyNewUsers,
        requiredCapability,
        excludeOrganizationIds,
        excludeRoles,
        excludeCapabilities,
        excludeUserIds,
      }),
      updatedBy: admin.email,
    };
    const before = id ? await loadCtaAuditPayload(id) : null;
    let saved = null;

    if (id) {
      saved = await prisma.adminPublicCta.update({
        where: { id },
        data,
        select: {
          id: true,
          label: true,
          kind: true,
          location: true,
          placementPage: true,
          placementSection: true,
          placementPanel: true,
          placementSlot: true,
          placementBreakpoint: true,
          placementOrder: true,
          url: true,
          isActive: true,
          sortOrder: true,
          variant: true,
          organizationId: true,
          onlyNewUsers: true,
          requiredCapability: true,
          visibilityRule: true,
          updatedBy: true,
        },
      });
    } else {
      saved = await prisma.adminPublicCta.create({
        data,
        select: {
          id: true,
          label: true,
          kind: true,
          location: true,
          placementPage: true,
          placementSection: true,
          placementPanel: true,
          placementSlot: true,
          placementBreakpoint: true,
          placementOrder: true,
          url: true,
          isActive: true,
          sortOrder: true,
          variant: true,
          organizationId: true,
          onlyNewUsers: true,
          requiredCapability: true,
          visibilityRule: true,
          updatedBy: true,
        },
      });
    }

    if (saved) {
      await writeAdminAuditLog({
        module: AdminConfigModule.CTAS,
        action: before ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
        actor: admin,
        entityType: "AdminPublicCta",
        entityId: saved.id,
        before,
        after: saved,
      });
    }

    revalidatePath("/admin/ctas");
    revalidatePath("/");
    revalidatePath("/unidep");
    return { ok: true };
  } catch (err: unknown) {
    // Re-throw Next.js internal redirects (digest starts with NEXT_REDIRECT)
    const maybeDigest = (err as unknown as { digest?: string }).digest;
    if (typeof maybeDigest === "string" && maybeDigest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "";
    if (
      message.includes("invalid input value for enum") ||
      message.includes("AdminPublicCtaLocation")
    ) {
      return {
        ok: false,
        error:
          "La ubicación seleccionada aún no existe en la base de datos. Ejecuta primero la migración Prisma/Neon para habilitar los nuevos slots de CTA.",
      };
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[upsertPublicCtaAction] error", err);
    }
    return { ok: false, error: "No fue posible guardar el CTA." };
  }
}

export async function deletePublicCtaAction(formData: FormData) {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  const admin = await requireAdminCapabilityUser(AdminCapability.manage_ctas);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const before = await loadCtaAuditPayload(id);
  await prisma.adminPublicCta.delete({ where: { id } });
  if (before) {
    await writeAdminAuditLog({
      module: AdminConfigModule.CTAS,
      action: AdminAuditAction.DELETE,
      actor: admin,
      entityType: "AdminPublicCta",
      entityId: before.id,
      before,
      after: null,
    });
  }
  revalidatePath("/admin/ctas");
  revalidatePath("/");
  revalidatePath("/unidep");
}
