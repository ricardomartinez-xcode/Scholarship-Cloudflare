import { redirect } from "next/navigation";

import AdminChrome from "@/components/admin/AdminChrome";
import AdminTableExcelEnhancer from "@/components/admin/AdminTableExcelEnhancer";
import { requireAdminAccessUser } from "@/lib/admin-session";
import { auth } from "@/lib/auth/server";
import { getCampusIntegrity } from "@/lib/campus";
import {
  getActiveAnnouncementsByLocation,
  getUserOrganizationIds,
} from "@/lib/admin-announcements";
import {
  getAdminContentTopCtas,
  getAdminContentInsideCtas,
  getAdminHeaderBannerCtas,
  getAdminSidebarBottomCtas,
  getAdminSidebarTopCtas,
} from "@/lib/admin-public";
import { getUserCapabilitySet } from "@/lib/user-capabilities";

export const dynamic = "force-dynamic";

async function logoutAction() {
  "use server";
  await auth.signOut();
  redirect("/admin/auth");
}

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminAccessUser();
  let adminHeaderBannerAnnouncements: Awaited<
    ReturnType<typeof getActiveAnnouncementsByLocation>
  > = [];
  let adminHeaderBannerCtas: Awaited<ReturnType<typeof getAdminHeaderBannerCtas>> = [];
  let adminContentTopAnnouncements: typeof adminHeaderBannerAnnouncements = [];
  let adminContentTopCtas: Awaited<ReturnType<typeof getAdminContentTopCtas>> = [];
  let adminContentInsideAnnouncements: typeof adminHeaderBannerAnnouncements = [];
  let adminContentInsideCtas: Awaited<ReturnType<typeof getAdminContentInsideCtas>> = [];
  let adminSidebarTopAnnouncements: typeof adminHeaderBannerAnnouncements = [];
  let adminSidebarTopCtas: Awaited<ReturnType<typeof getAdminSidebarTopCtas>> = [];
  let adminSidebarBottomAnnouncements: typeof adminHeaderBannerAnnouncements = [];
  let adminSidebarBottomCtas: Awaited<ReturnType<typeof getAdminSidebarBottomCtas>> = [];
  const campusIntegrity = await getCampusIntegrity();

  try {
    const [organizationIds, userCapabilities] = await Promise.all([
      getUserOrganizationIds(admin.id),
      getUserCapabilitySet(admin.id),
    ]);

    [
      adminHeaderBannerAnnouncements,
      adminHeaderBannerCtas,
      adminContentTopAnnouncements,
      adminContentTopCtas,
      adminContentInsideAnnouncements,
      adminContentInsideCtas,
      adminSidebarTopAnnouncements,
      adminSidebarTopCtas,
      adminSidebarBottomAnnouncements,
      adminSidebarBottomCtas,
    ] = await Promise.all([
      getActiveAnnouncementsByLocation({
        location: "ADMIN_HEADER_BANNER",
        userOrganizationIds: organizationIds,
      }),
      getAdminHeaderBannerCtas({
        userId: admin.id,
        userOrganizationIds: organizationIds,
        roles: [admin.role],
        userCapabilities,
      }),
      getActiveAnnouncementsByLocation({
        location: "ADMIN_CONTENT_TOP",
        userOrganizationIds: organizationIds,
      }),
      getAdminContentTopCtas({
        userId: admin.id,
        userOrganizationIds: organizationIds,
        roles: [admin.role],
        userCapabilities,
      }),
      getActiveAnnouncementsByLocation({
        location: "ADMIN_CONTENT_INSIDE",
        userOrganizationIds: organizationIds,
      }),
      getAdminContentInsideCtas({
        userId: admin.id,
        userOrganizationIds: organizationIds,
        roles: [admin.role],
        userCapabilities,
      }),
      getActiveAnnouncementsByLocation({
        location: "ADMIN_SIDEBAR_TOP",
        userOrganizationIds: organizationIds,
      }),
      getAdminSidebarTopCtas({
        userId: admin.id,
        userOrganizationIds: organizationIds,
        roles: [admin.role],
        userCapabilities,
      }),
      getActiveAnnouncementsByLocation({
        location: "ADMIN_SIDEBAR_BOTTOM",
        userOrganizationIds: organizationIds,
      }),
      getAdminSidebarBottomCtas({
        userId: admin.id,
        userOrganizationIds: organizationIds,
        roles: [admin.role],
        userCapabilities,
      }),
    ]);
  } catch {
    // Render admin without configurable CTAs when DB is unavailable.
  }

  return (
    <AdminChrome
      adminEmail={admin.email}
      adminRole={admin.role}
      adminCapabilities={admin.capabilities}
      isSystemOwner={admin.isSystemOwner}
      campusIntegrity={campusIntegrity}
      logoutAction={logoutAction}
      headerBannerAnnouncements={adminHeaderBannerAnnouncements}
      headerBannerCtas={adminHeaderBannerCtas}
      contentTopAnnouncements={adminContentTopAnnouncements}
      contentTopCtas={adminContentTopCtas}
      contentInsideAnnouncements={adminContentInsideAnnouncements}
      contentInsideCtas={adminContentInsideCtas}
      sidebarTopAnnouncements={adminSidebarTopAnnouncements}
      sidebarTopCtas={adminSidebarTopCtas}
      sidebarBottomAnnouncements={adminSidebarBottomAnnouncements}
      sidebarBottomCtas={adminSidebarBottomCtas}
    >
      <AdminTableExcelEnhancer />
      {children}
    </AdminChrome>
  );
}
