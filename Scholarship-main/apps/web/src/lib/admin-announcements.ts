import type { AdminPublicCtaLocation } from "@prisma/client";

import { resolveVisibilityRule } from "@/lib/admin-placement";
import { prisma } from "@/lib/prisma";
import type { CtaLocation } from "@/config/adminCatalogs";

export async function getUserOrganizationIds(userId: string) {
  try {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    return memberships.map((item) => item.organizationId);
  } catch {
    return [];
  }
}

export async function getActiveAnnouncementsByLocation({
  location,
  userOrganizationIds = [],
  newUser = false,
}: {
  location: CtaLocation;
  userOrganizationIds?: string[];
  newUser?: boolean;
}) {
  const orgFilter = userOrganizationIds.length
    ? [{ organizationId: null }, { organizationId: { in: userOrganizationIds } }]
    : [{ organizationId: null }];

  const newUserFilter = newUser
    ? undefined
    : { onlyNewUsers: false };

  try {
    const rows = await prisma.adminAnnouncement.findMany({
      where: {
        isActive: true,
        location: location as AdminPublicCtaLocation,
        OR: orgFilter,
        ...(newUserFilter ? newUserFilter : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        message: true,
        display: true,
        location: true,
        url: true,
        buttonLabel: true,
        variant: true,
        visibilityRule: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      visibilityRule: resolveVisibilityRule(row.visibilityRule),
    }));
  } catch {
    return [];
  }
}
