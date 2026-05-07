import { AdminCapability } from "@prisma/client";

import InvitationsClient from "@/components/admin/InvitationsClient";
import {
  adminHasCapability,
  requireAdminCapabilityUser,
} from "@/lib/admin-session";
import { listInvites } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { getSmtpStatus } from "@/lib/smtp";
import { SYSTEM_ROLES, getSystemRoleMeta } from "@/lib/system-roles";

export const dynamic = "force-dynamic";

async function loadOrganizations(): Promise<{ id: string; display_name: string }[]> {
  try {
    const orgs = await prisma.organization.findMany({
      where: { isActive: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    });
    return orgs.map((o) => ({ id: o.id, display_name: o.displayName }));
  } catch {
    return [];
  }
}

export default async function AdminInvitationsPage() {
  const admin = await requireAdminCapabilityUser([
    AdminCapability.view_invites,
    AdminCapability.manage_invites,
  ]);
  const [smtp, invites, teams] = await Promise.all([
    getSmtpStatus(),
    listInvites(200),
    loadOrganizations(),
  ]);

  const rows = invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status as "pending" | "used" | "expired" | "cancelled",
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    usedAt: invite.usedAt ? invite.usedAt.toISOString() : null,
    cancelledAt: invite.cancelledAt ? invite.cancelledAt.toISOString() : null,
    createdByEmail: invite.createdBy?.email ?? "n/a",
    organizationId: invite.organization?.id ?? null,
    organizationName: invite.organization?.displayName ?? null,
  }));

  const roleOptions = SYSTEM_ROLES.map((role) => ({
    value: role,
    label: getSystemRoleMeta(role).label,
  }));

  return (
    <InvitationsClient
      currentAdmin={{
        canManageInvites: adminHasCapability(
          admin,
          AdminCapability.manage_invites,
        ),
      }}
      initialInvites={rows}
      initialSmtp={smtp.ok ? { ok: true } : { ok: false, missing: smtp.missing }}
      teams={teams}
      roleOptions={roleOptions}
    />
  );
}
