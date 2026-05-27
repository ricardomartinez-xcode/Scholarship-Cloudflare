"use server";

import { AdminCapability } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  isCanonicalAliasType,
  normalizeAliasKey,
  type CanonicalAliasType,
} from "@/lib/admin-canonical-aliases";
import { getAdminUser } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

const ADMIN_ALIASES_PATH = "/admin/aliases";

type AliasActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireAliasEditor() {
  const user = await getAdminUser([
    AdminCapability.manage_prices,
    AdminCapability.manage_offers,
    AdminCapability.manage_benefits,
  ]);
  if (!user) {
    return null;
  }
  return user;
}

function requiredString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseAliasForm(formData: FormData) {
  const aliasTypeRaw = requiredString(formData, "aliasType");
  const canonicalValue = requiredString(formData, "canonicalValue");
  const aliasValue = requiredString(formData, "aliasValue");
  const notes = requiredString(formData, "notes") || null;
  const isActive = formData.get("isActive") !== "off";

  if (!isCanonicalAliasType(aliasTypeRaw)) {
    return { ok: false, error: "Tipo de alias inválido." } as const;
  }
  if (!canonicalValue) {
    return { ok: false, error: "El valor canónico es requerido." } as const;
  }
  if (!aliasValue) {
    return { ok: false, error: "El alias es requerido." } as const;
  }

  const canonicalNormalized = normalizeAliasKey(canonicalValue);
  const aliasNormalized = normalizeAliasKey(aliasValue);

  if (!canonicalNormalized || !aliasNormalized) {
    return { ok: false, error: "Alias y valor canónico deben contener texto válido." } as const;
  }

  return {
    ok: true,
    value: {
      aliasType: aliasTypeRaw as CanonicalAliasType,
      canonicalValue,
      canonicalNormalized,
      aliasValue,
      aliasNormalized,
      notes,
      isActive,
    },
  } as const;
}

export async function createCanonicalAliasAction(formData: FormData): Promise<AliasActionResult> {
  const user = await requireAliasEditor();
  if (!user) {
    return { ok: false, error: "No autorizado." };
  }

  const parsed = parseAliasForm(formData);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  try {
    await prisma.adminCanonicalAlias.upsert({
      where: {
        aliasType_aliasNormalized: {
          aliasType: parsed.value.aliasType,
          aliasNormalized: parsed.value.aliasNormalized,
        },
      },
      update: {
        canonicalValue: parsed.value.canonicalValue,
        canonicalNormalized: parsed.value.canonicalNormalized,
        aliasValue: parsed.value.aliasValue,
        isActive: parsed.value.isActive,
        notes: parsed.value.notes,
        updatedBy: user.email,
      },
      create: {
        ...parsed.value,
        updatedBy: user.email,
      },
    });

    revalidatePath(ADMIN_ALIASES_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[admin aliases] create error", error);
    return { ok: false, error: "No se pudo guardar el alias." };
  }
}

export async function updateCanonicalAliasAction(formData: FormData): Promise<AliasActionResult> {
  const user = await requireAliasEditor();
  if (!user) {
    return { ok: false, error: "No autorizado." };
  }

  const id = requiredString(formData, "id");
  if (!id) {
    return { ok: false, error: "Alias inválido." };
  }

  const parsed = parseAliasForm(formData);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  try {
    await prisma.adminCanonicalAlias.update({
      where: { id },
      data: {
        aliasType: parsed.value.aliasType,
        canonicalValue: parsed.value.canonicalValue,
        canonicalNormalized: parsed.value.canonicalNormalized,
        aliasValue: parsed.value.aliasValue,
        aliasNormalized: parsed.value.aliasNormalized,
        isActive: parsed.value.isActive,
        notes: parsed.value.notes,
        updatedBy: user.email,
      },
    });

    revalidatePath(ADMIN_ALIASES_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[admin aliases] update error", error);
    return { ok: false, error: "No se pudo actualizar el alias." };
  }
}

export async function toggleCanonicalAliasAction(formData: FormData): Promise<AliasActionResult> {
  const user = await requireAliasEditor();
  if (!user) {
    return { ok: false, error: "No autorizado." };
  }

  const id = requiredString(formData, "id");
  if (!id) {
    return { ok: false, error: "Alias inválido." };
  }

  try {
    const existing = await prisma.adminCanonicalAlias.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!existing) {
      return { ok: false, error: "Alias no encontrado." };
    }

    await prisma.adminCanonicalAlias.update({
      where: { id },
      data: {
        isActive: !existing.isActive,
        updatedBy: user.email,
      },
    });

    revalidatePath(ADMIN_ALIASES_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[admin aliases] toggle error", error);
    return { ok: false, error: "No se pudo cambiar el estado del alias." };
  }
}

export async function deleteCanonicalAliasAction(formData: FormData): Promise<AliasActionResult> {
  const user = await requireAliasEditor();
  if (!user) {
    return { ok: false, error: "No autorizado." };
  }

  const id = requiredString(formData, "id");
  if (!id) {
    return { ok: false, error: "Alias inválido." };
  }

  try {
    await prisma.adminCanonicalAlias.delete({ where: { id } });
    revalidatePath(ADMIN_ALIASES_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[admin aliases] delete error", error);
    return { ok: false, error: "No se pudo eliminar el alias." };
  }
}
