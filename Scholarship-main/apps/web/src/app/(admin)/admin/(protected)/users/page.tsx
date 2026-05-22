import { AdminCapability } from "@prisma/client";

import UsersClient from "@/components/admin/UsersClient";
import {
  ADMIN_CAPABILITIES,
  ADMIN_CAPABILITY_META,
  resolveAdminCapabilities,
} from "@/lib/admin-capabilities";
import {
  adminHasCapability,
  requireAdminCapabilityUser,
} from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { isRootAdminEmail } from "@/lib/domain";
import {
  ALL_USER_CAPABILITIES,
  INTERNAL_USER_CAPABILITIES,
  USER_CAPABILITIES,
  USER_CAPABILITY_META,
} from "@/lib/user-capabilities";
import {
  SYSTEM_ROLES,
  getSystemRoleMeta,
  isProtectedSystemRole,
} from "@/lib/system-roles";
import {
  bulkUpdateUsersAction,
  updateUserAction,
  deleteUserAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireAdminCapabilityUser([
    AdminCapability.view_users,
    AdminCapability.manage_users,
  ]);

  const [users, organizations] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
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
        orgMemberships: {
          orderBy: { organization: { displayName: "asc" } },
          select: {
            organizationId: true,
            role: true,
            organization: {
              select: { displayName: true },
            },
          },
        },
      },
    }),
    prisma.organization.findMany({
      where: { isActive: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);

  const capabilityCatalog = ADMIN_CAPABILITIES.map((capability) => ({
    key: capability,
    label: ADMIN_CAPABILITY_META[capability].label,
    description: ADMIN_CAPABILITY_META[capability].description,
  }));

  const userCapabilityCatalog = USER_CAPABILITIES.map((capability) => ({
    key: capability,
    label: USER_CAPABILITY_META[capability].label,
    description: USER_CAPABILITY_META[capability].description,
  }));

  const roleOptions = SYSTEM_ROLES.map((role) => ({
    value: role,
    label: getSystemRoleMeta(role).label,
    description: getSystemRoleMeta(role).description,
  }));

  const visualCapabilitySet = new Set(USER_CAPABILITIES);
  const internalCapabilitySet = new Set(INTERNAL_USER_CAPABILITIES);

  return (
    <UsersClient
      currentAdmin={{
        email: admin.email,
        role: admin.role,
        capabilities: admin.capabilities,
        canManageUsers: adminHasCapability(admin, AdminCapability.manage_users),
        canManageOrgMembers: adminHasCapability(
          admin,
          AdminCapability.manage_org_members,
        ),
      }}
      capabilityCatalog={capabilityCatalog}
      userCapabilityCatalog={userCapabilityCatalog}
      roleOptions={roleOptions}
      users={users.map((u) => ({
        ...u,
        isRootAdmin: isRootAdminEmail(u.email) || isProtectedSystemRole(u.role),
        isProtectedRole: isProtectedSystemRole(u.role),
        systemRoleLabel: getSystemRoleMeta(u.role).label,
        systemRoleDescription: getSystemRoleMeta(u.role).description,
        memberships: u.orgMemberships.map((membership) => ({
          organizationId: membership.organizationId,
          organizationName: membership.organization.displayName,
          role: membership.role as "owner" | "admin" | "member",
        })),
        capabilityOverrides: u.capabilityOverrides,
        userCapabilities: (
          u.role === "owner"
            ? ALL_USER_CAPABILITIES
            : u.userCapabilities.map((uc) => uc.capability)
        ).filter((capability) => visualCapabilitySet.has(capability)),
        internalUserCapabilities: (
          u.role === "owner"
            ? ALL_USER_CAPABILITIES
            : u.userCapabilities.map((uc) => uc.capability)
        ).filter((capability) => internalCapabilitySet.has(capability)),
        effectiveCapabilities: Array.from(
          resolveAdminCapabilities(u.role, u.capabilityOverrides),
        ).sort(),
      }))}
      organizations={organizations}
      bulkUpdateUsersAction={bulkUpdateUsersAction}
      updateUserAction={updateUserAction}
      deleteUserAction={deleteUserAction}
    />
  );
}
