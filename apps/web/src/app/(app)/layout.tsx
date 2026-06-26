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
  clearCloudflareSessionCookieFromStore,
  signOutCloudflareSession,
} from "@/lib/cloudflare/auth";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import {
  getNavBannerCtas,
  getSidebarBottomCtas,
  getSidebarTopCtas,
  getSimulatorBottomCtas,
  getSimulatorTopCtas,
  getAuthWelcomeCtas,
  getAuthWelcomeInsideCtas,
  getUnidepPrimaryCtas,
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
  const isCloudflare = isCloudflareRuntime();
  const email = user.email;
  const displayName = user.displayName?.trim() || null;
  const adminOverrides = isCloudflare
    ? []
    : await prisma.adminUserCapability.findMany({
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
  let workspaceHeaderCtas: Awaited<ReturnType<typeof getUnidepPrimaryCtas>> = [];
  let workspaceHeaderNewUserCtas: Awaited<ReturnType<typeof getUnidepPrimaryCtas>> = [];
  let simulatorTopAnnouncements: typeof navAnnouncements = [];
  let simulatorTopCtas: Awaited<ReturnType<typeof getSimulatorTopCtas>> = [];
  let simulatorBottomAnnouncements: typeof navAnnouncements = [];
  let simulatorBottomCtas: Awaited<ReturnType<typeof getSimulatorBottomCtas>> = [];

  try {
    if (isCloudflare) {
      throw new Error("Configurable admin UI chrome is not loaded in Cloudflare runtime.");
    }
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
      workspaceHeaderCtas,
      workspaceHeaderNewUserCtas,
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
      Promise.all([
        getUnidepPrimaryCtas({
          userId: user.id,
          userOrganizationIds: organizationIds,
          roles: [user.role],
          userCapabilities,
        }),
        getAuthWelcomeCtas({
          userId: user.id,
          userOrganizationIds: organizationIds,
          roles: [user.role],
          userCapabilities,
        }),
        getAuthWelcomeInsideCtas({
          userId: user.id,
          userOrganizationIds: organizationIds,
          roles: [user.role],
          userCapabilities,
        }),
      ]).then((groups) => groups.flat()),
      Promise.all([
        getUnidepPrimaryCtas({
          userId: user.id,
          userOrganizationIds: organizationIds,
          roles: [user.role],
          newUser: true,
          userCapabilities,
        }),
        getAuthWelcomeCtas({
          userId: user.id,
          userOrganizationIds: organizationIds,
          roles: [user.role],
          newUser: true,
          userCapabilities,
        }),
        getAuthWelcomeInsideCtas({
          userId: user.id,
          userOrganizationIds: organizationIds,
          roles: [user.role],
          newUser: true,
          userCapabilities,
        }),
      ]).then((groups) => groups.flat()),
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
    if (isCloudflareRuntime()) {
      await signOutCloudflareSession();
      await clearCloudflareSessionCookieFromStore();
      redirect("/");
    }
    await auth.signOut();
    redirect("/");
  }

  return (
    <AppChrome
      userEmail={email}
      userDisplayName={displayName}
      isAdmin={canAccessAdminPanel(user.role, adminCapabilities)}
      signOutAction={signOutAction}
      navAnnouncements={navAnnouncements}
      navBannerCtas={navBannerCtas}
      sidebarTopAnnouncements={sidebarTopAnnouncements}
      sidebarTopCtas={sidebarTopCtas}
      sidebarBottomAnnouncements={sidebarBottomAnnouncements}
      sidebarBottomCtas={sidebarBottomCtas}
      workspaceHeaderCtas={workspaceHeaderCtas}
      workspaceHeaderNewUserCtas={workspaceHeaderNewUserCtas}
      simulatorTopAnnouncements={simulatorTopAnnouncements}
      simulatorTopCtas={simulatorTopCtas}
      simulatorBottomAnnouncements={simulatorBottomAnnouncements}
      simulatorBottomCtas={simulatorBottomCtas}
    >
      {children}
    </AppChrome>
  );
}
