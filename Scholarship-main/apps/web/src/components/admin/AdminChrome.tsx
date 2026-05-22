"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

import AppFooter from "@/components/app/AppFooter";
import ApplyChangesButton from "@/components/admin/ApplyChangesButton";
import AnnouncementOutlet, {
  type Announcement,
} from "@/components/announcement/AnnouncementOutlet";
import ConfiguredCtaList from "@/components/cta/ConfiguredCtaList";
import EngagementZone from "@/components/engagement/EngagementZone";
import DashboardSidebarNav from "@/components/layout/DashboardSidebarNav";
import { DashboardIcon } from "@/components/layout/DashboardIcons";
import {
  adminNavGroups,
  filterNavGroupsByCapabilities,
  resolveDashboardBreadcrumbs,
  resolveDashboardTitle,
} from "@/config/dashboard-navigation";
import { SYSTEM_ROLES, getSystemRoleMeta } from "@/lib/system-roles";

type CampusIntegrity = {
  ok: boolean;
  activeCampus: number;
  activeOnline: number;
};

type PublicCta = {
  id: string;
  label: string;
  kind: "link" | "action";
  url: string | null;
  variant: string | null;
};

type AdminChromeProps = {
  adminEmail: string;
  adminRole: string;
  adminCapabilities: string[];
  isSystemOwner: boolean;
  campusIntegrity: CampusIntegrity;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
  headerBannerAnnouncements?: Announcement[];
  headerBannerCtas?: PublicCta[];
  contentTopAnnouncements?: Announcement[];
  contentTopCtas?: PublicCta[];
  contentInsideAnnouncements?: Announcement[];
  contentInsideCtas?: PublicCta[];
  sidebarTopAnnouncements?: Announcement[];
  sidebarTopCtas?: PublicCta[];
  sidebarBottomAnnouncements?: Announcement[];
  sidebarBottomCtas?: PublicCta[];
};

function AdminDrawerNav({
  adminCapabilities,
  roleLabel,
  isSystemOwner,
  pathname,
  onNavigate,
  sidebarTopAnnouncements,
  sidebarTopCtas,
  sidebarBottomAnnouncements,
  sidebarBottomCtas,
}: {
  adminCapabilities: string[];
  roleLabel: string;
  isSystemOwner: boolean;
  pathname: string;
  onNavigate: () => void;
  sidebarTopAnnouncements: Announcement[];
  sidebarTopCtas: PublicCta[];
  sidebarBottomAnnouncements: Announcement[];
  sidebarBottomCtas: PublicCta[];
}) {
  const groups = filterNavGroupsByCapabilities(adminNavGroups, adminCapabilities);

  return (
    <div className="ui-sidebar-stack">
      <section className="ui-sidebar-action-panel rounded-[24px] border p-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--ui-text-secondary)]">
          Acceso admin
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="ui-pill ui-pill--accent">{roleLabel}</span>
          {isSystemOwner ? <span className="ui-pill">Owner</span> : null}
        </div>
      </section>

      <AnnouncementOutlet
        announcements={sidebarTopAnnouncements}
        appearance="compact"
        className="grid gap-2"
      />
      {sidebarTopCtas.length ? (
        <ConfiguredCtaList
          ctas={sidebarTopCtas}
          className="grid gap-2"
          itemClassName="text-left"
          appearance="compact"
        />
      ) : null}

      <DashboardSidebarNav
        groups={groups}
        pathname={pathname}
        onLinkNavigate={onNavigate}
      />

      <AnnouncementOutlet
        announcements={sidebarBottomAnnouncements}
        appearance="compact"
        className="grid gap-2"
      />
      {sidebarBottomCtas.length ? (
        <ConfiguredCtaList
          ctas={sidebarBottomCtas}
          className="grid gap-2"
          itemClassName="text-left"
          appearance="compact"
        />
      ) : null}
    </div>
  );
}

export default function AdminChrome({
  adminEmail,
  adminRole,
  adminCapabilities,
  isSystemOwner,
  campusIntegrity,
  logoutAction,
  children,
  headerBannerAnnouncements = [],
  headerBannerCtas = [],
  contentTopAnnouncements = [],
  contentTopCtas = [],
  contentInsideAnnouncements = [],
  contentInsideCtas = [],
  sidebarTopAnnouncements = [],
  sidebarTopCtas = [],
  sidebarBottomAnnouncements = [],
  sidebarBottomCtas = [],
}: AdminChromeProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const roleLabel = SYSTEM_ROLES.includes(adminRole as never)
    ? getSystemRoleMeta(adminRole as never).label
    : adminRole;
  const breadcrumbs = resolveDashboardBreadcrumbs(pathname);
  const pageTitle = resolveDashboardTitle(pathname);
  const actionCenterAnnouncements = [
    ...headerBannerAnnouncements,
    ...contentTopAnnouncements,
  ];
  const actionCenterCtas = [...headerBannerCtas, ...contentTopCtas];

  return (
    <main className="min-h-screen overflow-x-clip text-[color:var(--ui-text-primary)]">
      <div className="ui-page-frame ui-page-grid grid-cols-1">
        <div className="ui-page-main grid-rows-[auto_auto_auto_1fr_auto]">
          <header className="ui-shell-header flex items-start justify-between gap-3 sm:items-center">
            <div className="flex min-w-0 items-center gap-2.5">
              <Dialog.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    className="ui-shell-icon-button h-9 w-9"
                    aria-label="Abrir menú"
                  >
                    <DashboardIcon name="menu" className="h-4 w-4" />
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
                  <Dialog.Content className="ui-shell-drawer fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[372px] flex-col overflow-hidden border-r p-3 shadow-2xl outline-none">
                    <Dialog.Title className="sr-only">Navegación admin</Dialog.Title>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        className="ui-shell-icon-button absolute right-3 top-3 h-9 w-9"
                        aria-label="Cerrar menú"
                      >
                        <DashboardIcon name="close" className="h-4 w-4" />
                      </button>
                    </Dialog.Close>
                    <div className="flex items-center gap-3 border-b border-[color:var(--ui-border)] px-2 py-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-secondary)]">
                        <Image
                          src="/branding/logo-recalc.png"
                          alt="ReCalc"
                          width={120}
                          height={40}
                          className="h-6 w-auto object-contain"
                        />
                      </div>
                      <div className="ui-shell-brand min-w-0">
                        <div className="ui-shell-brand__eyebrow">Scholarship</div>
                        <div className="ui-shell-brand__title">ReCalc Admin</div>
                      </div>
                    </div>
                    <div className="ui-scrollbar mt-3 flex-1 overflow-y-auto">
                      <AdminDrawerNav
                        adminCapabilities={adminCapabilities}
                        roleLabel={roleLabel}
                        isSystemOwner={isSystemOwner}
                        pathname={pathname}
                        onNavigate={() => setMobileNavOpen(false)}
                        sidebarTopAnnouncements={sidebarTopAnnouncements}
                        sidebarTopCtas={sidebarTopCtas}
                        sidebarBottomAnnouncements={sidebarBottomAnnouncements}
                        sidebarBottomCtas={sidebarBottomCtas}
                      />
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              <div className="min-w-0">
                <nav className="flex items-center gap-1.5 text-xs text-[color:var(--ui-text-secondary)]">
                  {breadcrumbs.map((crumb, index) => (
                    <span key={`${crumb}-${index}`} className="flex items-center gap-1.5">
                      {index > 0 ? (
                        <span className="text-[color:var(--ui-text-secondary)]">/</span>
                      ) : null}
                      <span
                        className={
                          index === breadcrumbs.length - 1
                            ? "font-semibold text-[color:var(--ui-text-primary)]"
                            : "text-[color:var(--ui-text-secondary)]"
                        }
                      >
                        {crumb}
                      </span>
                    </span>
                  ))}
                </nav>
                <div className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[color:var(--ui-text-primary)] sm:text-[1.35rem]">
                  {pageTitle}
                </div>
                <div className="mt-2 hidden flex-wrap gap-2 sm:flex">
                  <span className="ui-pill ui-pill--accent">{roleLabel}</span>
                  {isSystemOwner ? <span className="ui-pill">Owner</span> : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ApplyChangesButton />

              <Dialog.Root
                open={mobileActionsOpen}
                onOpenChange={setMobileActionsOpen}
              >
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    className="ui-shell-icon-button h-9 w-9"
                    aria-label="Abrir acciones"
                  >
                    <DashboardIcon name="more" className="h-4 w-4" />
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
                  <Dialog.Content className="ui-shell-drawer fixed right-4 top-20 z-50 w-[90vw] max-w-[360px] rounded-[22px] border p-4 shadow-2xl outline-none">
                    <Dialog.Title className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                      Acciones de sesión
                    </Dialog.Title>
                    <div className="mt-4 truncate text-sm font-semibold text-[color:var(--ui-text-primary)]">
                      {adminEmail}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="ui-pill ui-pill--accent">{roleLabel}</span>
                      {isSystemOwner ? <span className="ui-pill">Owner</span> : null}
                    </div>
                    <div className="mt-4 grid gap-2">
                      <form action={logoutAction}>
                        <button
                          type="submit"
                          className="ui-cta-secondary w-full justify-start px-4 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(120,190,33,0.3)]"
                        >
                          Cerrar sesión
                        </button>
                      </form>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          </header>

          <EngagementZone
            title="Centro de acción admin"
            description="Comunicados operativos y accesos directos para creación, administración y publicación."
            announcements={actionCenterAnnouncements}
            ctas={actionCenterCtas}
            variant="admin"
            emptyLabel="Sin acciones ni comunicados activos en este espacio."
          />

          <div className="min-w-0 grid content-start gap-[var(--ui-shell-gap)]">
            <AnnouncementOutlet
              announcements={contentInsideAnnouncements}
              className="grid gap-2"
            />
            {contentInsideCtas.length ? (
              <ConfiguredCtaList
                ctas={contentInsideCtas}
                className="grid gap-2 md:grid-cols-2 xl:grid-cols-3"
              />
            ) : null}
            {children}
          </div>

          {!campusIntegrity.ok ? (
            <div className="ui-note ui-note--info">
              <div className="text-xs uppercase tracking-[0.28em]">
                Aviso
              </div>
              <div className="mt-1 font-semibold">
                Catálogo de planteles incompleto
              </div>
              <div className="mt-1">
                Ejecuta <code className="rounded bg-black/30 px-1">npm run campus:seed</code>.
                {" "}
                Estado: campus {campusIntegrity.activeCampus}/24, online{" "}
                {campusIntegrity.activeOnline}/1.
              </div>
            </div>
          ) : null}

          <AppFooter />
        </div>
      </div>
    </main>
  );
}
