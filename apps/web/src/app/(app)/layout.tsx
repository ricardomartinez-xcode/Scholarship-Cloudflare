import { redirect } from "next/navigation";

import AppChrome from "@/components/app/AppChrome";
import {
  getActiveAnnouncementsByLocation,
  getUserOrganizationIds,
} from "@/lib/admin-announcements";
import { auth } from "@/lib/auth/server";
import { requireAuth } from "@/lib/authz";
import { canAccessAdminPanel, resolveAdminCapabilities } from "@/lib/admin-capabilities";
import {
  getNavBannerCtas,
  getSidebarBottomCtas,
  getSidebarTopCtas,
  getSimulatorBottomCtas,
  getSimulatorTopCtas,
} from "@/lib/admin-public";
import { getUserCapabilitySet } from "@/lib/user-capabilities";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuth();
  const email = user.email;
  const adminOverrides = await prisma.adminUserCapability.findMany({
    where: { userId: user.id },
    select: { capability: true, enabled: true },
  });
  const adminCapabilities = resolveAdminCapabilities(user.role, adminOverrides);

  let navAnnouncements: Awaited<ReturnType<typeof getActiveAnnouncementsByLocation>> = [];
  let navBannerCtas: Awaited<ReturnType<typeof getNavBannerCtas>> = [];
  let sidebarTopAnnouncements: typeof navAnnouncements = [];
  let sidebarTopCtas: Awaited<ReturnType<typeof getSidebarTopCtas>> = [];
  let sidebarBottomAnnouncements: typeof navAnnouncements = [];
  let sidebarBottomCtas: Awaited<ReturnType<typeof getSidebarBottomCtas>> = [];
  let simulatorTopAnnouncements: typeof navAnnouncements = [];
  let simulatorTopCtas: Awaited<ReturnType<typeof getSimulatorTopCtas>> = [];
  let simulatorBottomAnnouncements: typeof navAnnouncements = [];
  let simulatorBottomCtas: Awaited<ReturnType<typeof getSimulatorBottomCtas>> = [];

  try {
    const [organizationIds, userCapabilities] = await Promise.all([
      getUserOrganizationIds(user.id),
      getUserCapabilitySet(user.id),
    ]);
    [
      navAnnouncements,
      navBannerCtas,
      sidebarTopAnnouncements,
      sidebarTopCtas,
      sidebarBottomAnnouncements,
      sidebarBottomCtas,
      simulatorTopAnnouncements,
      simulatorTopCtas,
      simulatorBottomAnnouncements,
      simulatorBottomCtas,
    ] = await Promise.all([
      getActiveAnnouncementsByLocation({
        location: "NAV_BANNER",
        userOrganizationIds: organizationIds,
      }),
      getNavBannerCtas({
        userId: user.id,
        userOrganizationIds: organizationIds,
        roles: [user.role],
        userCapabilities,
      }),
      getActiveAnnouncementsByLocation({
        location: "SIDEBAR_TOP",
        userOrganizationIds: organizationIds,
      }),
      getSidebarTopCtas({
        userId: user.id,
        userOrganizationIds: organizationIds,
        roles: [user.role],
        userCapabilities,
      }),
      getActiveAnnouncementsByLocation({
        location: "SIDEBAR_BOTTOM",
        userOrganizationIds: organizationIds,
      }),
      getSidebarBottomCtas({
        userId: user.id,
        userOrganizationIds: organizationIds,
        roles: [user.role],
        userCapabilities,
      }),
      getActiveAnnouncementsByLocation({
        location: "SIMULATOR_TOP",
        userOrganizationIds: organizationIds,
      }),
      getSimulatorTopCtas({
        userId: user.id,
        userOrganizationIds: organizationIds,
        roles: [user.role],
        userCapabilities,
      }),
      getActiveAnnouncementsByLocation({
        location: "SIMULATOR_BOTTOM",
        userOrganizationIds: organizationIds,
      }),
      getSimulatorBottomCtas({
        userId: user.id,
        userOrganizationIds: organizationIds,
        roles: [user.role],
        userCapabilities,
      }),
    ]);
  } catch {
    // Render app without configurable CTAs when DB is unavailable.
  }

  async function signOutAction() {
    "use server";
    await auth.signOut();
    redirect("/");
  }

  return (
    <AppChrome
      userEmail={email}
      isAdmin={canAccessAdminPanel(user.role, adminCapabilities)}
      signOutAction={signOutAction}
      navAnnouncements={navAnnouncements}
      navBannerCtas={navBannerCtas}
      sidebarTopAnnouncements={sidebarTopAnnouncements}
      sidebarTopCtas={sidebarTopCtas}
      sidebarBottomAnnouncements={sidebarBottomAnnouncements}
      sidebarBottomCtas={sidebarBottomCtas}
      simulatorTopAnnouncements={simulatorTopAnnouncements}
      simulatorTopCtas={simulatorTopCtas}
      simulatorBottomAnnouncements={simulatorBottomAnnouncements}
      simulatorBottomCtas={simulatorBottomCtas}
    >
      {children}
    </AppChrome>
  );
}
