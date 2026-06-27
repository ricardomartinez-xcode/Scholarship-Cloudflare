import { AdminCapability, Role } from "@prisma/client";

import {
  canAccessAdminPanel,
  resolveAdminCapabilities,
} from "@/lib/admin-capabilities";
import { isSystemOwner } from "@/lib/system-roles";

export type CloudflareAdminSessionUser = {
  id: string;
  email: string;
  role?: unknown;
  isActive?: unknown;
};

export type CloudflareAdminAccessUser = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  isSystemOwner: boolean;
  capabilities: AdminCapability[];
  capabilityOverrides: Array<{
    capability: AdminCapability;
    enabled: boolean;
  }>;
  memberships: Array<{
    organizationId: string;
    role: "owner" | "admin" | "member";
  }>;
};

/**
 * Cloudflare auth stores the role as TEXT in D1. Keep the mapping explicit so
 * corrupted or legacy values cannot gain access accidentally.
 */
export function normalizeCloudflareRole(value: unknown): Role {
  switch (value) {
    case Role.owner:
      return Role.owner;
    case Role.admin_operativo:
      return Role.admin_operativo;
    case Role.editor_operativo:
      return Role.editor_operativo;
    case Role.user:
    default:
      return Role.user;
  }
}

/**
 * The first Cloudflare-native pass has system roles but no per-user capability
 * override table yet. The role map remains the source of truth until those
 * overrides are migrated to D1 in a dedicated change.
 */
export function resolveCloudflareAdminAccessUser(
  sessionUser: CloudflareAdminSessionUser,
): CloudflareAdminAccessUser | null {
  if (!sessionUser.id || !sessionUser.email || !Boolean(sessionUser.isActive)) {
    return null;
  }

  const role = normalizeCloudflareRole(sessionUser.role);
  const capabilities = Array.from(resolveAdminCapabilities(role, [])).sort();

  if (!canAccessAdminPanel(role, capabilities)) {
    return null;
  }

  return {
    id: sessionUser.id,
    email: sessionUser.email,
    role,
    isActive: true,
    isSystemOwner: isSystemOwner(role),
    capabilities,
    capabilityOverrides: [],
    memberships: [],
  };
}
