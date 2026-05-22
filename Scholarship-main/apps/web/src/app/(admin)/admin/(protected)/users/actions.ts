"use server";

import { revalidatePath } from "next/cache";
import {
  AdminCapability,
  AdminConfigModule,
  AdminAuditAction,
  Role,
  UserCapability,
} from "@prisma/client";

import { adminHasCapability, requireAdminAccessUser } from "@/lib/admin-session";
import { isRootAdminEmail } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { isUserCapability, isVisualUserCapability } from "@/lib/user-capabilities";
import { getUserPrivilegeGuardError } from "@/lib/user-edit-guards";
import { isProtectedSystemRole, SYSTEM_ROLES } from "@/lib/system-roles";

type ActionResult = { ok: boolean; error?: string };
type MembershipInput = {
  organizationId: string;
  role: "owner" | "admin" | "member";
};
type CapabilityOverrideInput = {
  capability: AdminCapability;
  enabled: boolean;
};

function normalizeMemberships(memberships: MembershipInput[]) {
  return memberships
    .map((membership) => ({
      organizationId: membership.organizationId,
      role: membership.role,
    }))
    .sort((left, right) =>
      `${left.organizationId}:${left.role}`.localeCompare(
        `${right.organizationId}:${right.role}`,
      ),
    );
}

function normalizeCapabilityOverrides(overrides: CapabilityOverrideInput[]) {
  return overrides
    .map((override) => ({
      capability: override.capability,
      enabled: Boolean(override.enabled),
    }))
    .sort((left, right) => left.capability.localeCompare(right.capability));
}

function normalizeUserCapabilities(capabilities: UserCapability[]) {
  return Array.from(new Set(capabilities)).sort();
}

function parseMemberships(raw: string) {
  let memberships: MembershipInput[] = [];
  try {
    memberships = JSON.parse(raw) as MembershipInput[];
  } catch {
    return { ok: false as const, error: "Membresias invalidas." };
  }

  const validMembershipRoles = new Set(["owner", "admin", "member"]);
  const uniqueOrganizations = new Set<string>();
  for (const membership of memberships) {
    if (!membership.organizationId) {
      return { ok: false as const, error: "Cada membresia debe tener organizacion." };
    }
    if (!validMembershipRoles.has(membership.role)) {
      return { ok: false as const, error: "Rol de organizacion invalido." };
    }
    if (uniqueOrganizations.has(membership.organizationId)) {
      return {
        ok: false as const,
        error: "No dupliques organizaciones en la misma captura.",
      };
    }
    uniqueOrganizations.add(membership.organizationId);
  }

  return { ok: true as const, memberships: normalizeMemberships(memberships) };
}

function parseCapabilityOverrides(raw: string) {
  let overrides: CapabilityOverrideInput[] = [];
  try {
    overrides = JSON.parse(raw) as CapabilityOverrideInput[];
  } catch {
    return { ok: false as const, error: "Overrides de capacidades invalidos." };
  }

  const uniqueCapabilities = new Set<string>();
  for (const override of overrides) {
    if (!Object.values(AdminCapability).includes(override.capability)) {
      return { ok: false as const, error: "Capacidad invalida." };
    }
    if (uniqueCapabilities.has(override.capability)) {
      return {
        ok: false as const,
        error: "No dupliques capacidades en la misma captura.",
      };
    }
    uniqueCapabilities.add(override.capability);
  }

  return {
    ok: true as const,
    overrides: normalizeCapabilityOverrides(overrides),
  };
}

function parseUserCapabilities(raw: string): { ok: true; capabilities: UserCapability[] } | { ok: false; error: string } {
  let arr: string[] = [];
  try {
    arr = JSON.parse(raw) as string[];
  } catch {
    return { ok: false, error: "Permisos de usuario inválidos." };
  }
  const unique = new Set<string>();
  const result: UserCapability[] = [];
  for (const item of arr) {
    if (!isUserCapability(item)) {
      return { ok: false, error: `Permiso desconocido: ${item}` };
    }
    if (!isVisualUserCapability(item as UserCapability)) {
      return {
        ok: false,
        error: "Esta bandera interna ya no se administra desde la UI de usuarios.",
      };
    }
    if (unique.has(item)) {
      return { ok: false, error: "No repitas permisos de usuario." };
    }
    unique.add(item);
    result.push(item as UserCapability);
  }
  return { ok: true, capabilities: normalizeUserCapabilities(result) };
}

function isProtectedOwnerUser(input: { email: string; role: Role }) {
  return isProtectedSystemRole(input.role) || isRootAdminEmail(input.email);
}

export async function updateUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdminAccessUser();

    const id = String(formData.get("id") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim();
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    const membershipsRaw = String(formData.get("memberships") ?? "[]");
    const capabilityOverridesRaw = String(
      formData.get("capabilityOverrides") ?? "[]",
    );
    const userCapabilitiesRaw = String(formData.get("userCapabilities") ?? "[]");

    if (!id) return { ok: false, error: "Usuario invalido." };
    if (!SYSTEM_ROLES.includes(role as Role)) {
      return { ok: false, error: "Rol invalido." };
    }

    const membershipsResult = parseMemberships(membershipsRaw);
    if (!membershipsResult.ok) {
      return { ok: false, error: membershipsResult.error };
    }

    const overridesResult = parseCapabilityOverrides(capabilityOverridesRaw);
    if (!overridesResult.ok) {
      return { ok: false, error: overridesResult.error };
    }

    const userCapabilitiesResult = parseUserCapabilities(userCapabilitiesRaw);
    if (!userCapabilitiesResult.ok) {
      return { ok: false, error: userCapabilitiesResult.error };
    }

    const organizationIds = membershipsResult.memberships.map(
      (membership) => membership.organizationId,
    );
    if (organizationIds.length > 0) {
      const count = await prisma.organization.count({
        where: { id: { in: organizationIds }, isActive: true },
      });
      if (count !== organizationIds.length) {
        return { ok: false, error: "Alguna organizacion ya no existe." };
      }
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        orgMemberships: {
          orderBy: [{ organizationId: "asc" }],
          select: {
            organizationId: true,
            role: true,
          },
        },
        capabilityOverrides: {
          orderBy: [{ capability: "asc" }],
          select: {
            capability: true,
            enabled: true,
          },
        },
        userCapabilities: {
          orderBy: [{ capability: "asc" }],
          select: {
            capability: true,
          },
        },
      },
    });
    if (!target) return { ok: false, error: "Usuario no encontrado." };
    const normalizedCurrentMemberships = normalizeMemberships(
      target.orgMemberships.map((membership) => ({
        organizationId: membership.organizationId,
        role: membership.role,
      })),
    );
    const normalizedCurrentOverrides = normalizeCapabilityOverrides(
      target.capabilityOverrides,
    );
    const currentUserCapabilities = target.userCapabilities
      .map((uc) => uc.capability as UserCapability)
      .sort() as UserCapability[];
    const currentVisualUserCapabilities = normalizeUserCapabilities(
      currentUserCapabilities.filter(isVisualUserCapability),
    );
    const preservedInternalUserCapabilities = normalizeUserCapabilities(
      currentUserCapabilities.filter((capability) => !isVisualUserCapability(capability)),
    );
    const nextVisualUserCapabilities = normalizeUserCapabilities(
      userCapabilitiesResult.capabilities.filter(isVisualUserCapability),
    );
    const nextResolvedUserCapabilities = normalizeUserCapabilities([
      ...preservedInternalUserCapabilities,
      ...nextVisualUserCapabilities,
    ]);
    const actorIsOwner = admin.role === Role.owner;

    const userFieldsChanged =
      target.role !== role || Boolean(target.isActive) !== isActive;
    const membershipsChanged =
      JSON.stringify(normalizedCurrentMemberships) !==
      JSON.stringify(membershipsResult.memberships);
    const overridesChanged =
      JSON.stringify(normalizedCurrentOverrides) !==
      JSON.stringify(overridesResult.overrides);
    const userCapabilitiesChanged =
      JSON.stringify(currentVisualUserCapabilities) !==
      JSON.stringify(nextVisualUserCapabilities);

    if (
      (userFieldsChanged || overridesChanged || userCapabilitiesChanged) &&
      !adminHasCapability(admin, AdminCapability.manage_users)
    ) {
      return {
        ok: false,
        error: "No tienes permiso para editar usuarios o capacidades.",
      };
    }

    if (
      membershipsChanged &&
      !adminHasCapability(admin, AdminCapability.manage_org_members)
    ) {
      return {
        ok: false,
        error: "No tienes permiso para editar membresias de organizacion.",
      };
    }

    const privilegeGuardError = getUserPrivilegeGuardError({
      actorId: admin.id,
      actorRole: admin.role,
      targetId: target.id,
      targetRole: target.role,
      nextRole: role as Role,
      nextIsActive: isActive,
      userFieldsChanged,
      membershipsChanged,
      overridesChanged,
      userCapabilitiesChanged,
    });
    if (privilegeGuardError) {
      return {
        ok: false,
        error: privilegeGuardError,
      };
    }

    if (isProtectedOwnerUser(target)) {
      if (
        !actorIsOwner &&
        (
          role !== Role.owner ||
          !isActive ||
          membershipsChanged ||
          overridesChanged ||
          userCapabilitiesChanged
        )
      ) {
        return {
          ok: false,
          error: "La cuenta owner protegida no admite cambios operativos.",
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      if (userFieldsChanged) {
        await tx.user.update({
          where: { id },
          data: { role: role as Role, isActive },
        });
      }

      if (membershipsChanged) {
        await tx.organizationMember.deleteMany({ where: { userId: id } });
        for (const membership of membershipsResult.memberships) {
          await tx.organizationMember.create({
            data: {
              organizationId: membership.organizationId,
              userId: id,
              role: membership.role,
            },
          });
        }
      }

      if (overridesChanged) {
        await tx.adminUserCapability.deleteMany({ where: { userId: id } });
        if (overridesResult.overrides.length) {
          await tx.adminUserCapability.createMany({
            data: overridesResult.overrides.map((override) => ({
              userId: id,
              capability: override.capability,
              enabled: override.enabled,
              updatedByUserId: admin.id,
              updatedByEmail: admin.email,
            })),
          });
        }
      }

      if (userCapabilitiesChanged) {
        await tx.userCapabilityAssignment.deleteMany({ where: { userId: id } });
        if (nextResolvedUserCapabilities.length) {
          await tx.userCapabilityAssignment.createMany({
            data: nextResolvedUserCapabilities.map((capability) => ({
              userId: id,
              capability,
              grantedBy: admin.email,
            })),
          });
        }
      }
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.UPDATE,
      actor: admin,
      entityType: "user",
      entityId: id,
      before: {
        role: target.role,
        isActive: target.isActive,
        memberships: normalizedCurrentMemberships,
        capabilityOverrides: normalizedCurrentOverrides,
        userCapabilities: currentUserCapabilities,
      },
      after: {
        role,
        isActive,
        memberships: membershipsResult.memberships,
        capabilityOverrides: overridesResult.overrides,
        userCapabilities: nextResolvedUserCapabilities,
      },
      diffSummary: {
        userFieldsChanged,
        membershipsChanged,
        overridesChanged,
        userCapabilitiesChanged,
      },
      message: `Actualizacion operativa de usuario ${target.email}.`,
    });

    revalidatePath("/admin/users");
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible actualizar el usuario." };
  }
}

export async function bulkUpdateUsersAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdminAccessUser();
    if (!adminHasCapability(admin, AdminCapability.manage_users)) {
      return { ok: false, error: "No tienes permiso para acciones en lote." };
    }

    const idsRaw = String(formData.get("ids") ?? "[]");
    const operation = String(formData.get("operation") ?? "").trim();

    let ids: string[] = [];
    try {
      ids = JSON.parse(idsRaw) as string[];
    } catch {
      return { ok: false, error: "Seleccion invalida." };
    }

    ids = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
    if (!ids.length) return { ok: false, error: "Selecciona al menos un usuario." };

    if (!["activate", "deactivate"].includes(operation)) {
      return { ok: false, error: "Operacion invalida." };
    }

    const targets = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, role: true },
    });

    if (targets.some((user) => isProtectedOwnerUser(user))) {
      return {
        ok: false,
        error: "La selección incluye una cuenta owner protegida y no puede procesarse en lote.",
      };
    }

    await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { isActive: operation === "activate" },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.UPDATE,
      actor: admin,
      entityType: "user.bulk",
      before: { ids },
      after: { ids, isActive: operation === "activate" },
      diffSummary: {
        operation,
        count: ids.length,
      },
      message: `Accion en lote sobre ${ids.length} usuario(s).`,
    });

    revalidatePath("/admin/users");
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible ejecutar la accion en lote." };
  }
}

export async function deleteUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdminAccessUser();
    if (!adminHasCapability(admin, AdminCapability.manage_users)) {
      return { ok: false, error: "No tienes permiso para eliminar usuarios." };
    }

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false, error: "Usuario invalido." };

    const target = await prisma.user.findUnique({
      where: { id },
      select: { email: true, isActive: true, role: true },
    });
    if (!target) return { ok: false, error: "Usuario no encontrado." };
    if (isProtectedOwnerUser(target)) {
      return { ok: false, error: "La cuenta owner protegida no puede eliminarse." };
    }
    if (target.isActive) {
      return { ok: false, error: "Solo se pueden eliminar usuarios desactivados." };
    }

    await prisma.user.delete({ where: { id } });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.DELETE,
      actor: admin,
      entityType: "user",
      entityId: id,
      before: { email: target.email, isActive: target.isActive },
      message: `Se elimino el usuario ${target.email}.`,
    });

    revalidatePath("/admin/users");
    return { ok: true };
  } catch {
    return { ok: false, error: "No fue posible eliminar el usuario." };
  }
}
