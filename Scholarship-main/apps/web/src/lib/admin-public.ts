import {
  AdminConfigModule,
  Role,
  type AdminPublicCtaLocation,
  type UserCapability,
} from "@prisma/client";

import {
  getPublishedConfigSnapshot,
  type CtasDraftSnapshot,
  type SidebarDraftSnapshot,
} from "@/lib/admin-config-snapshots";
import { buildVisibilityRule } from "@/lib/admin-placement";
import { prisma } from "@/lib/prisma";
import { evaluateVisibilityRule } from "@/services/targetingVisibilityService";
import type { CtaLocation } from "@/config/adminCatalogs";

type CtaFilterOptions = {
  userId?: string;
  userOrganizationIds?: string[];
  roles?: Array<Role | string>;
  newUser?: boolean;
  userCapabilities?: Set<UserCapability>;
};

export async function getActivePublicCtas(
  location: CtaLocation,
  options: CtaFilterOptions = {},
) {
  const {
    userId,
    userOrganizationIds = [],
    roles = [],
    newUser = false,
    userCapabilities,
  } = options;

  const visibilityContext = {
    userId,
    organizationIds: userOrganizationIds,
    roles,
    newUser,
    capabilities: userCapabilities,
  };

  const published = await getPublishedConfigSnapshot(AdminConfigModule.CTAS);
  if (published) {
    return (published.snapshot as CtasDraftSnapshot).ctas
      .filter((cta) => {
        if (!cta.isActive) return false;
        if (cta.location !== (location as AdminPublicCtaLocation)) return false;

        const visibilityRule =
          cta.visibilityRule ??
          buildVisibilityRule({
            organizationId: cta.organizationId ?? null,
            newUserOnly: cta.onlyNewUsers ?? false,
            requiredCapability: cta.requiredCapability ?? null,
          });

        return evaluateVisibilityRule(visibilityRule, visibilityContext).visible;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((cta) => ({
        id: cta.id,
        label: cta.label,
        kind: cta.kind,
        location: cta.location as AdminPublicCtaLocation,
        url: cta.url,
        variant: cta.variant,
        placement: cta.location,
      }));
  }

  try {
    const rows = await prisma.adminPublicCta.findMany({
      where: {
        isActive: true,
        location: location as AdminPublicCtaLocation,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        kind: true,
        location: true,
        url: true,
        variant: true,
        organizationId: true,
        onlyNewUsers: true,
        requiredCapability: true,
        visibilityRule: true,
      },
    });
    return rows
      .filter((cta) => {
        const visibilityRule =
          cta.visibilityRule ??
          buildVisibilityRule({
            organizationId: cta.organizationId ?? null,
            newUserOnly: cta.onlyNewUsers ?? false,
            requiredCapability: cta.requiredCapability ?? null,
          });
        return evaluateVisibilityRule(visibilityRule, visibilityContext).visible;
      })
      .map((cta) => ({
        id: cta.id,
        label: cta.label,
        kind: cta.kind,
        location: cta.location,
        url: cta.url,
        variant: cta.variant,
        placement: cta.location,
      }));
  } catch {
    return [];
  }
}

export async function getActiveSidebarInfo() {
  const published = await getPublishedConfigSnapshot(AdminConfigModule.SIDEBAR);
  if (published) {
    return (published.snapshot as SidebarDraftSnapshot).items
      .filter((item) => item.isActive)
      .sort((left, right) => left.key.localeCompare(right.key, "es"))
      .map((item) => ({
        id: item.id,
        key: item.key,
        value: item.value,
      }));
  }

  try {
    return await prisma.adminSidebarInfo.findMany({
      where: { isActive: true },
      orderBy: [{ key: "asc" }],
      select: { id: true, key: true, value: true },
    });
  } catch {
    return [];
  }
}

export async function getAppResultsBelowCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("APP_RESULTS_BELOW", options);
}

export async function getAppResultsAboveCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("APP_RESULTS_ABOVE", options);
}

export async function getAppResultsInsideCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("APP_RESULTS_INSIDE", options);
}

export async function getUnidepPrimaryCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("UNIDEP_PRIMARY", options);
}

export async function getCalculatorFooterCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("CALCULATOR_FOOTER", options);
}

export async function getNavBannerCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("NAV_BANNER", options);
}

export async function getSidebarTopCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("SIDEBAR_TOP", options);
}

export async function getSidebarBottomCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("SIDEBAR_BOTTOM", options);
}

export async function getSimulatorTopCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("SIMULATOR_TOP", options);
}

export async function getSimulatorBottomCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("SIMULATOR_BOTTOM", options);
}

export async function getAuthWelcomeCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("AUTH_WELCOME", options);
}

export async function getAuthWelcomeInsideCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("AUTH_WELCOME_INSIDE", options);
}

export async function getAdminHeaderBannerCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("ADMIN_HEADER_BANNER", options);
}

export async function getAdminSidebarTopCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("ADMIN_SIDEBAR_TOP", options);
}

export async function getAdminSidebarBottomCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("ADMIN_SIDEBAR_BOTTOM", options);
}

export async function getAdminContentTopCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("ADMIN_CONTENT_TOP", options);
}

export async function getAdminContentInsideCtas(options?: CtaFilterOptions) {
  return getActivePublicCtas("ADMIN_CONTENT_INSIDE", options);
}

export async function getNavBannerAnnouncements() {
  const { getActiveAnnouncementsByLocation } = await import("@/lib/admin-announcements");
  return getActiveAnnouncementsByLocation({ location: "NAV_BANNER" });
}

export async function getSidebarTopAnnouncements() {
  const { getActiveAnnouncementsByLocation } = await import("@/lib/admin-announcements");
  return getActiveAnnouncementsByLocation({ location: "SIDEBAR_TOP" });
}

export async function getSimulatorTopAnnouncements() {
  const { getActiveAnnouncementsByLocation } = await import("@/lib/admin-announcements");
  return getActiveAnnouncementsByLocation({ location: "SIMULATOR_TOP" });
}

export async function getSimulatorBottomAnnouncements() {
  const { getActiveAnnouncementsByLocation } = await import("@/lib/admin-announcements");
  return getActiveAnnouncementsByLocation({ location: "SIMULATOR_BOTTOM" });
}

export async function getAppResultsBelowAnnouncements() {
  const { getActiveAnnouncementsByLocation } = await import("@/lib/admin-announcements");
  return getActiveAnnouncementsByLocation({ location: "APP_RESULTS_BELOW" });
}
