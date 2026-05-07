import { AdminCapability } from "@prisma/client";

import AnnouncementsClient from "@/components/admin/AnnouncementsClient";
import { resolveVisibilityRule } from "@/lib/admin-placement";
import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

import { deleteAnnouncementAction, upsertAnnouncementAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ComunicadosPage() {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  await requireAdminCapabilityUser(AdminCapability.manage_ctas);

  const [announcements, organizations] = await Promise.all([
    prisma.adminAnnouncement.findMany({
      orderBy: [{ location: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        message: true,
        display: true,
        location: true,
        organizationId: true,
        onlyNewUsers: true,
        url: true,
        buttonLabel: true,
        isActive: true,
        sortOrder: true,
        variant: true,
        visibilityRule: true,
      },
    }),
    prisma.organization.findMany({
      where: { isActive: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);

  const normalizedAnnouncements = announcements.map((announcement) => ({
    ...announcement,
    visibilityRule: resolveVisibilityRule(announcement.visibilityRule),
  }));

  return (
    <AnnouncementsClient
      announcements={normalizedAnnouncements}
      organizations={organizations}
      upsertAnnouncementAction={upsertAnnouncementAction}
      deleteAnnouncementAction={deleteAnnouncementAction}
    />
  );
}
