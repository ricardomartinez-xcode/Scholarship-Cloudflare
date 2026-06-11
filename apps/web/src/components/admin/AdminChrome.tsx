"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import AppFooter from "@/components/app/AppFooter";
import ApplyChangesButton from "@/components/admin/ApplyChangesButton";
import AnnouncementOutlet, { type Announcement } from "@/components/announcement/AnnouncementOutlet";
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
import { SYSTEM_ROLES, getSystemRoleMeta } from "@/lib/system-roles.shared";

import styles from "./AdminChrome.module.css";

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
  children: ReactNode;
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

type VisibleNavGroups = ReturnType<typeof filterNavGroupsByCapabilities>;

function getRoleLabel(adminRole: string) {
  const knownRole = (SYSTEM_ROLES as readonly string[]).includes(adminRole);
  return knownRole ? getSystemRoleMeta(adminRole as (typeof SYSTEM_ROLES)[number]).label : adminRole;
}

function AdminBrand() {
  return (
    <div className={styles.brand}>
      <div className={styles.brandBadge}>Admin</div>
      <div className={styles.brandCopy}>
        <div className={styles.brandEyebrow}>Scholarship</div>
        <div className={styles.brandTitleRow}>
          <Image src="/icons/icon48.png" alt="" width={28} height={28} className={styles.brandLogo} />
          <div className={styles.brandCopy}>
            <div className={styles.brandEyebrow}>Panel</div>
            <div className={styles.brandTitle}>ADMINISTRADOR</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "accent" | "warning" | "success" }) {
  return (
    <div className={`${styles.statusPill} ${styles[`statusPill_${tone}`]}`}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusValue}>{value}</span>
    </div>
  );
}

function AdminNavPanel({
  navGroups,
  pathname,
  onNavigate,
  sidebarTopAnnouncements,
  sidebarTopCtas,
  sidebarBottomAnnouncements,
  sidebarBottomCtas,
}: {
  navGroups: VisibleNavGroups;
  pathname: string;
  onNavigate: () => void;
  sidebarTopAnnouncements: Announcement[];
  sidebarTopCtas: PublicCta[];
  sidebarBottomAnnouncements: Announcement[];
  sidebarBottomCtas: PublicCta[];
}) {
  return (
    <div className={styles.sidebarStack}>
      <div className={styles.sidebarTopSlot}>
        <AnnouncementOutlet announcements={sidebarTopAnnouncements} appearance="compact" className={styles.sidebarMessages} />
        {sidebarTopCtas.length ? (
          <ConfiguredCtaList ctas={sidebarTopCtas} className={styles.sidebarCtas} itemClassName={styles.sidebarCtaItem} appearance="compact" />
        ) : null}
      </div>

      <div className={`${styles.navScrollArea} ui-scrollbar`}>
        <DashboardSidebarNav groups={navGroups} pathname={pathname} onLinkNavigate={onNavigate} collapsed={false} />
      </div>

      <div className={styles.sidebarBottomSlot}>
        <AnnouncementOutlet announcements={sidebarBottomAnnouncements} appearance="compact" className={styles.sidebarMessages} />
        {sidebarBottomCtas.length ? (
          <ConfiguredCtaList ctas={sidebarBottomCtas} className={styles.sidebarCtas} itemClassName={styles.sidebarCtaItem} appearance="compact" />
        ) : null}
      </div>
    </div>
  );
}

function CampusIntegrityNotice({ campusIntegrity }: { campusIntegrity: CampusIntegrity }) {
  if (campusIntegrity.ok) return null;
  return (
    <div className={styles.integrityNotice} role="status">
      <div className={styles.sectionKicker}>Aviso operativo</div>
      <div className={styles.noticeTitle}>Catálogo de planteles incompleto</div>
      <p className={styles.noticeText}>
        Ejecuta <code>npm run campus:seed</code>. Estado actual: campus {campusIntegrity.activeCampus}/24, online {campusIntegrity.activeOnline}/1.
      </p>
    </div>
  );
}

function SessionActionsDialog({
  adminEmail,
  roleLabel,
  logoutAction,
  open,
  onOpenChange,
}: {
  adminEmail: string;
  roleLabel: string;
  logoutAction: () => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button type="button" className={`${styles.iconButton} ${styles.mobileOnly}`} aria-label="Abrir acciones de sesión">
          <DashboardIcon name="more" className={styles.icon} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content className={styles.actionsDialog}>
          <Dialog.Title className={styles.dialogTitle}>Acciones de sesión</Dialog.Title>
          <Dialog.Description className={styles.dialogDescription}>Gestiona tu sesión administrativa actual.</Dialog.Description>
          <div className={styles.sessionIdentity}>
            <span className={styles.sessionEmail}>{adminEmail}</span>
            <span className={styles.sessionRole}>{roleLabel}</span>
          </div>
          <form action={logoutAction} className={styles.dialogActionGroup}>
            <button type="submit" className={styles.secondaryActionButton}>Cerrar sesión</button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
  const [navOpen, setNavOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

  const roleLabel = getRoleLabel(adminRole);
  const roleStatusLabel = isSystemOwner ? `${roleLabel} · Owner` : roleLabel;
  const breadcrumbs = resolveDashboardBreadcrumbs(pathname);
  const pageTitle = resolveDashboardTitle(pathname);

  const navGroups = useMemo(
    () => filterNavGroupsByCapabilities(adminNavGroups, adminCapabilities),
    [adminCapabilities],
  );

  const actionCenterAnnouncements = [...headerBannerAnnouncements, ...contentTopAnnouncements];
  const actionCenterCtas = [...headerBannerCtas, ...contentTopCtas];
  const hasActionCenterContent = actionCenterAnnouncements.length > 0 || actionCenterCtas.length > 0;
  const hasInsideContent = contentInsideAnnouncements.length > 0 || contentInsideCtas.length > 0;

  const closeMobileNav = () => setNavOpen(false);

  return (
    <div className={styles.shell}>
      <div className={styles.layout}>
        <aside className={styles.desktopSidebar} aria-label="Navegación admin">
          <AdminBrand />
          <AdminNavPanel
            navGroups={navGroups}
            pathname={pathname}
            onNavigate={() => undefined}
            sidebarTopAnnouncements={sidebarTopAnnouncements}
            sidebarTopCtas={sidebarTopCtas}
            sidebarBottomAnnouncements={sidebarBottomAnnouncements}
            sidebarBottomCtas={sidebarBottomCtas}
          />
        </aside>

        <Dialog.Root open={navOpen} onOpenChange={setNavOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className={styles.dialogOverlay} />
            <Dialog.Content className={`${styles.mobileDrawer} ui-shell-drawer`}>
              <Dialog.Title className="sr-only">Navegación admin</Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className={`${styles.iconButton} ${styles.drawerClose}`} aria-label="Cerrar menú">
                  <DashboardIcon name="close" className={styles.icon} />
                </button>
              </Dialog.Close>
              <AdminBrand />
              <AdminNavPanel
                navGroups={navGroups}
                pathname={pathname}
                onNavigate={closeMobileNav}
                sidebarTopAnnouncements={sidebarTopAnnouncements}
                sidebarTopCtas={sidebarTopCtas}
                sidebarBottomAnnouncements={sidebarBottomAnnouncements}
                sidebarBottomCtas={sidebarBottomCtas}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <main className={styles.mainPanel}>
          <header className={styles.header}>
            <div className={styles.headerTop}>
              <div className={styles.headingCluster}>
                <button type="button" className={styles.iconButton} aria-label="Abrir menú" onClick={() => setNavOpen(true)}>
                  <DashboardIcon name="menu" className={styles.icon} />
                </button>
                <div className={styles.titleBlock}>
                  <nav className={styles.breadcrumbs} aria-label="Ruta actual">
                    {breadcrumbs.map((crumb, index) => (
                      <span key={`${crumb}-${index}`} className={styles.breadcrumbItem}>
                        {index > 0 ? <span className={styles.breadcrumbSeparator}>/</span> : null}
                        <span className={index === breadcrumbs.length - 1 ? styles.breadcrumbCurrent : styles.breadcrumbMuted}>{crumb}</span>
                      </span>
                    ))}
                  </nav>
                  <h1 className={styles.pageTitle}>{pageTitle}</h1>
                </div>
              </div>

              <div className={styles.headerActions}>
                <ApplyChangesButton />
                <SessionActionsDialog
                  adminEmail={adminEmail}
                  roleLabel={roleStatusLabel}
                  logoutAction={logoutAction}
                  open={mobileActionsOpen}
                  onOpenChange={setMobileActionsOpen}
                />
                <form action={logoutAction} className={styles.desktopOnly}>
                  <button type="submit" className={styles.secondaryActionButton}>Cerrar sesión</button>
                </form>
              </div>
            </div>

            <div className={styles.contextBar} aria-label="Estado del panel">
              <StatusPill label="Sesión" value={adminEmail} tone="neutral" />
              <StatusPill label="Rol" value={roleStatusLabel} tone="accent" />
              <StatusPill label="Permisos" value={`${adminCapabilities.length}`} tone="neutral" />
              <StatusPill label="Planteles" value={`${campusIntegrity.activeCampus}/24`} tone={campusIntegrity.ok ? "success" : "warning"} />
              <StatusPill label="Online" value={`${campusIntegrity.activeOnline}/1`} tone={campusIntegrity.ok ? "success" : "warning"} />
            </div>
          </header>

          {hasActionCenterContent ? (
            <div className={styles.actionCenter} aria-label="Centro operativo">
              <EngagementZone
                title="Centro operativo"
                description="Comunicados y accesos directos configurados para administrar, publicar y coordinar cambios."
                announcements={actionCenterAnnouncements}
                ctas={actionCenterCtas}
                variant="admin"
                emptyLabel="Sin acciones ni comunicados activos en este espacio."
              />
            </div>
          ) : null}

          <div className={styles.contentSurface} aria-label="Contenido admin">
            {hasInsideContent ? (
              <div className={styles.inlineMessages}>
                <AnnouncementOutlet announcements={contentInsideAnnouncements} className={styles.inlineAnnouncementList} />
                {contentInsideCtas.length ? <ConfiguredCtaList ctas={contentInsideCtas} className={styles.inlineCtaGrid} /> : null}
              </div>
            ) : null}
            <div className={styles.adminContent}>{children}</div>
          </div>

          <CampusIntegrityNotice campusIntegrity={campusIntegrity} />
          <AppFooter />
        </main>
      </div>
    </div>
  );
}
