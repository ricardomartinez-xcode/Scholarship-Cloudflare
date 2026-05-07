import { AdminCapability } from "@prisma/client";

import OrganizationsClient from "@/components/admin/OrganizationsClient";
import {
  adminHasCapability,
  requireAdminCapabilityUser,
} from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage() {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  const admin = await requireAdminCapabilityUser([
    AdminCapability.view_org_members,
    AdminCapability.manage_org_members,
  ]);
  let teams: { id: string; display_name: string; created_at_millis: number; memberCount: number }[] = [];
  let configError: string | null = null;

  try {
    const orgs = await prisma.organization.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    });
    teams = orgs.map((o) => ({
      id: o.id,
      display_name: o.displayName,
      created_at_millis: o.createdAt.getTime(),
      memberCount: o._count.members,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    configError = `Error al cargar organizaciones: ${msg}`;
  }

  return (
    <OrganizationsClient
      currentAdmin={{
        canManageOrganizations: adminHasCapability(
          admin,
          AdminCapability.manage_org_members,
        ),
      }}
      initialTeams={teams}
      configError={configError}
    />
  );
}
