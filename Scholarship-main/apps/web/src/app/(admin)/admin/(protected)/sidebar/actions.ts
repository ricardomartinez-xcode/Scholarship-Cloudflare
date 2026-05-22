"use server";

import {
  AdminCapability,
  AdminAuditAction,
  AdminConfigModule,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { isSidebarFieldKey } from "@/config/adminCatalogs";

const SIDEBAR_WRITE_CAPABILITY = AdminCapability.manage_sidebar;

async function loadSidebarAuditPayload(id: string) {
  return prisma.adminSidebarInfo.findUnique({
    where: { id },
    select: {
      id: true,
      key: true,
      value: true,
      isActive: true,
      updatedBy: true,
    },
  });
}

export async function upsertSidebarInfoAction(formData: FormData) {
  try {
    const admin = await requireAdminCapabilityUser(SIDEBAR_WRITE_CAPABILITY);

    const id = String(formData.get("id") ?? "").trim();
    const key = String(formData.get("key") ?? "").trim();
    const value = String(formData.get("value") ?? "").trim();
    const isActive = String(formData.get("isActive") ?? "true") === "true";

    if (!isSidebarFieldKey(key)) return { ok: false, error: "Campo inválido." };
    if (!key) return { ok: false, error: "Key es requerido." };
    if (!value) return { ok: false, error: "Value es requerido." };

    const inputType = String(formData.get("inputType") ?? "").trim();
    if (inputType === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { ok: false, error: "Correo inválido." };
      }
    }
    if (inputType === "url") {
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return { ok: false, error: "URL debe ser http/https." };
        }
      } catch {
        return { ok: false, error: "URL inválida." };
      }
    }
    if (inputType === "phone") {
      const compact = value.replace(/[^\d+]/g, "");
      if (compact.length < 7 || compact.length > 20) {
        return { ok: false, error: "Teléfono inválido." };
      }
    }

    const data = { key, value, isActive, updatedBy: admin.email };
    const before = id ? await loadSidebarAuditPayload(id) : null;
    let saved = null;
    if (id) {
      saved = await prisma.adminSidebarInfo.update({
        where: { id },
        data,
        select: {
          id: true,
          key: true,
          value: true,
          isActive: true,
          updatedBy: true,
        },
      });
    } else {
      saved = await prisma.adminSidebarInfo.create({
        data,
        select: {
          id: true,
          key: true,
          value: true,
          isActive: true,
          updatedBy: true,
        },
      });
    }

    if (saved) {
      await writeAdminAuditLog({
        module: AdminConfigModule.SIDEBAR,
        action: before ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
        actor: admin,
        entityType: "AdminSidebarInfo",
        entityId: saved.id,
        before,
        after: saved,
      });
    }

    revalidatePath("/admin/sidebar");
    revalidatePath("/");
    return { ok: true };
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "Key ya existe (debe ser único)." };
    }
    return { ok: false, error: "No fue posible guardar la información." };
  }
}

export async function deleteSidebarInfoAction(formData: FormData) {
  const admin = await requireAdminCapabilityUser(SIDEBAR_WRITE_CAPABILITY);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const before = await loadSidebarAuditPayload(id);
  await prisma.adminSidebarInfo.delete({ where: { id } });
  if (before) {
    await writeAdminAuditLog({
      module: AdminConfigModule.SIDEBAR,
      action: AdminAuditAction.DELETE,
      actor: admin,
      entityType: "AdminSidebarInfo",
      entityId: before.id,
      before,
      after: null,
    });
  }
  revalidatePath("/admin/sidebar");
  revalidatePath("/");
}
