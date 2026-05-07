import { AdminCapability, Role } from "@prisma/client";
import { redirect } from "next/navigation";

import {
  canAccessAdminPanel,
  hasAnyAdminCapability,
  resolveAdminCapabilities,
} from "@/lib/admin-capabilities";
import { getSessionUser, type SessionUserState } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { isSystemOwner } from "@/lib/system-roles";

export type AdminAccessUser = {
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

export type AdminAccessState =
  | { status: Exclude<SessionUserState["status"], "ok"> | "no_admin_access"; user: null }
  | { status: "ok"; user: AdminAccessUser };

async function resolveAdminAccessUser(sessionUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      capabilityOverrides: {
        orderBy: [{ capability: "asc" }],
        select: {
          capability: true,
          enabled: true,
        },
      },
      orgMemberships: {
        orderBy: [{ organizationId: "asc" }],
        select: {
          organizationId: true,
          role: true,
        },
      },
    },
  });

  if (!user || !user.isActive) return null;

  const resolved = resolveAdminCapabilities(user.role, user.capabilityOverrides);
  if (!resolved.has(AdminCapability.view_admin) && resolved.size > 0) {
    resolved.add(AdminCapability.view_admin);
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    isSystemOwner: isSystemOwner(user.role),
    capabilities: Array.from(resolved).sort(),
    capabilityOverrides: user.capabilityOverrides,
    memberships: user.orgMemberships.map((membership) => ({
      organizationId: membership.organizationId,
      role: membership.role,
    })),
  } satisfies AdminAccessUser;
}

export async function getAdminAccessState(): Promise<AdminAccessState> {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return { status: session.status, user: null };
  }

  const adminUser = await resolveAdminAccessUser(session.user.id);
  if (!adminUser) {
    return { status: "inactive", user: null };
  }

  if (!canAccessAdminPanel(adminUser.role, adminUser.capabilities)) {
    return { status: "no_admin_access", user: null };
  }

  return { status: "ok", user: adminUser };
}

export function adminHasCapability(
  user: Pick<AdminAccessUser, "capabilities">,
  capability: AdminCapability | AdminCapability[],
) {
  const required = Array.isArray(capability) ? capability : [capability];
  return hasAnyAdminCapability(user.capabilities, required);
}

export async function getAdminUser(
  capability?: AdminCapability | AdminCapability[],
) {
  const state = await getAdminAccessState();
  if (state.status !== "ok") return null;
  if (capability && !adminHasCapability(state.user, capability)) {
    return null;
  }
  return state.user;
}

export async function requireAdminAccessUser() {
  const state = await getAdminAccessState();
  if (state.status === "ok") return state.user;
  if (state.status === "unauthenticated") redirect("/admin/auth");
  if (state.status === "forbidden") redirect("/auth/denied");
  if (state.status === "inactive") redirect("/auth/denied?reason=inactive");
  redirect("/auth/denied?reason=missing-admin-capability");
}

export async function requireAdminCapabilityUser(
  capability: AdminCapability | AdminCapability[],
) {
  const user = await requireAdminAccessUser();
  if (!adminHasCapability(user, capability)) {
    redirect("/auth/denied?reason=missing-admin-capability");
  }
  return user;
}

export async function requireAdminUser() {
  const user = await requireAdminAccessUser();
  if (!isSystemOwner(user.role)) {
    redirect("/auth/denied?reason=not-admin");
  }
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    capabilities: user.capabilities,
    isSystemOwner: user.isSystemOwner,
  };
}
