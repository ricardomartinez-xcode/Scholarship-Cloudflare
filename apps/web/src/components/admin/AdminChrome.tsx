"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

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

  return knownRole
    ? getSystemRoleMeta(adminRole as (typeof SYSTEM_ROLES)[number]).label
    : adminRole;
}

function AdminBrand() {
  return (
    <div className={styles.brand}>
      <div className={styles.brandBadge}>Admin</div>
      <div className={styles.brandCopy}>
        <div className={styles.brandEyebrow}>Scholarship</div>
        <div className={styles.brandTitleRow}>
          <Image
            src="/branding/logo-recalc.png"
            alt="ReCalc"
            width={120}
            height={40}
            className={styles.brandLogo}
          />
          <span className={styles.brandTitle}>ReCalc Admin</span>
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "accent" | "warning" | "success";
}) {
  return (
    <div className={`${styles.statusPill} ${styles[`statusPill_${tone}`]}`}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusValue}>{value}</span>
    </div>
  );
}

function AdminAccessCard({
  roleLabel,
  adminCapabilities,
  isSystemOwner,
}: {
  roleLabel: string;
  adminCapabilities: string[];
  isSystemOwner: boolean;
}) {
  return (
    <section className={styles.accessCard} aria-label="Contexto de acceso admin">
      <div className={styles.sectionKicker}>Acceso admin</div>
      <div className={styles.accessGrid}>
        <StatusPill label="Rol" value={roleLabel} tone="accent" />
        <StatusPill
          label="Permisos"
          value={`${adminCapabilities.length}`}
          tone="neutral"
        />
        <StatusPill
          label="Owner"
          value={isSystemOwner ? "Sí" : "No"}
          tone={isSystemOwner ? "success" : "neutral"}
        />
      </div>
    </section>
  );
}

function AdminNavPanel({
  navGroups,
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
  navGroups: VisibleNavGroups;
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
  return (
    <div className={styles.sidebarStack}>
      <AdminAccessCard
        roleLabel={roleLabel}
        adminCapabilities={adminCapabilities}
        isSystemOwner={isSystemOwner}
      />

      <AnnouncementOutlet
        announcements={sidebarTopAnnouncements}
        appearance="compact"
        className={styles.sidebarMessages}
      />
      {sidebarTopCtas.length ? (
        <ConfiguredCtaList
          ctas={sidebarTopCtas}
          className={styles.sidebarCtas}
          itemClassName={styles.sidebarCtaItem}
          appearance="compact"
        />
      ) : null}

      <div className={styles.navScrollArea}>
        <DashboardSidebarNav
          groups={navGroups}
          pathname={pathname}
          onLinkNavigate={onNavigate}
        />
      </div>

      <AnnouncementOutlet
        announcements={sidebarBottomAnnouncements}
        appearance="compact"
        className={styles.sidebarMessages}
      />
      {sidebarBottomCtas.length ? (
        <ConfiguredCtaList
          ctas={sidebarBottomCtas}
          className={styles.sidebarCtas}
          itemClassName={styles.sidebarCtaItem}
          appearance="compact"
        />
      ) : null}
    </div>
  );
}

function CampusIntegrityNotice({
  campusIntegrity,
}: {
  campusIntegrity: CampusIntegrity;
}) {
  if (campusIntegrity.ok) return null;

  return (
    <div className={styles.integrityNotice} role="status">
      <div className={styles.sectionKicker}>Aviso operativo</div>
      <div className={styles.noticeTitle}>Catálogo de planteles incompleto</div>
      <p className={styles.noticeText}>
        Ejecuta <code>npm run campus:seed</code>. Estado actual: campus{" "}
        {campusIntegrity.activeCampus}/24, online {campusIntegrity.activeOnline}
        /1.
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
        <button
          type="button"
          className={`${styles.iconButton} ${styles.mobileOnly}`}
          aria-label="Abrir acciones de sesión"
        >
          <DashboardIcon name="more" className={styles.icon} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content className={styles.actionsDialog}>
          <Dialog.Title className={styles.dialogTitle}>
            Acciones de sesión
          </Dialog.Title>
          <Dialog.Description className={styles.dialogDescription}>
            Gestiona tu sesión administrativa actual.
          </Dialog.Description>

          <div className={styles.sessionIdentity}>
            <span className={styles.sessionEmail}>{adminEmail}</span>
            <span className={styles.sessionRole}>{roleLabel}</span>
          </div>

          <form action={logoutAction} className={styles.dialogActionGroup}>
            <button type="submit" className={styles.secondaryActionButton}>
              Cerrar sesión
            </button>
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

  const roleLabel = getRoleLabel(adminRole);
  const breadcrumbs = resolveDashboardBreadcrumbs(pathname);
  const pageTitle = resolveDashboardTitle(pathname);

  const navGroups = useMemo(
    () => filterNavGroupsByCapabilities(adminNavGroups, adminCapabilities),
    [adminCapabilities],
  );

  const actionCenterAnnouncements = [
    ...headerBannerAnnouncements,
    ...contentTopAnnouncements,
  ];
  const actionCenterCtas = [...headerBannerCtas, ...contentTopCtas];
  const hasActionCenterContent =
    actionCenterAnnouncements.length > 0 || actionCenterCtas.length > 0;
  const hasInsideContent =
    contentInsideAnnouncements.length > 0 || contentInsideCtas.length > 0;

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div className={styles.shell}>
      <div className={styles.layout}>
        <aside className={styles.desktopSidebar} aria-label="Navegación admin">
          <AdminBrand />
          <AdminNavPanel
            navGroups={navGroups}
            adminCapabilities={adminCapabilities}
            roleLabel={roleLabel}
            isSystemOwner={isSystemOwner}
            pathname={pathname}
            onNavigate={() => undefined}
            sidebarTopAnnouncements={sidebarTopAnnouncements}
            sidebarTopCtas={sidebarTopCtas}
            sidebarBottomAnnouncements={sidebarBottomAnnouncements}
            sidebarBottomCtas={sidebarBottomCtas}
          />
        </aside>

        <Dialog.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className={styles.dialogOverlay} />
            <Dialog.Content className={styles.mobileDrawer}>
              <Dialog.Title className="sr-only">Navegación admin</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.drawerClose}`}
                  aria-label="Cerrar menú"
                >
                  <DashboardIcon name="close" className={styles.icon} />
                </button>
              </Dialog.Close>
              <AdminBrand />
              <AdminNavPanel
                navGroups={navGroups}
                adminCapabilities={adminCapabilities}
                roleLabel={roleLabel}
                isSystemOwner={isSystemOwner}
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
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.mobileOnly}`}
                  aria-label="Abrir menú"
                  onClick={() => setMobileNavOpen(true)}
                >
                  <DashboardIcon name="menu" className={styles.icon} />
                </button>

                <div className={styles.titleBlock}>
                  <nav className={styles.breadcrumbs} aria-label="Ruta actual">
                    {breadcrumbs.map((crumb, index) => (
                      <span
                        key={`${crumb}-${index}`}
                        className={styles.breadcrumbItem}
                      >
                        {index > 0 ? (
                          <span className={styles.breadcrumbSeparator}>/</span>
                        ) : null}
                        <span
                          className={
                            index === breadcrumbs.length - 1
                              ? styles.breadcrumbCurrent
                              : styles.breadcrumbMuted
                          }
                        >
                          {crumb}
                        </span>
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
                  roleLabel={roleLabel}
                  logoutAction={logoutAction}
                  open={mobileActionsOpen}
                  onOpenChange={setMobileActionsOpen}
                />
                <form action={logoutAction} className={styles.desktopOnly}>
                  <button type="submit" className={styles.secondaryActionButton}>
                    Cerrar sesión
                  </button>
                </form>
              </div>
            </div>

            <div className={styles.contextBar} aria-label="Estado del panel">
              <StatusPill label="Sesión" value={adminEmail} tone="neutral" />
              <StatusPill label="Rol" value={roleLabel} tone="accent" />
              <StatusPill
                label="Permisos"
                value={`${adminCapabilities.length}`}
                tone="neutral"
              />
              <StatusPill
                label="Planteles"
                value={`${campusIntegrity.activeCampus}/24`}
                tone={campusIntegrity.ok ? "success" : "warning"}
              />
              <StatusPill
                label="Online"
                value={`${campusIntegrity.activeOnline}/1`}
                tone={campusIntegrity.ok ? "success" : "warning"}
              />
            </div>
          </header>

          {hasActionCenterContent ? (
            <section className={styles.actionCenter} aria-label="Centro operativo">
              <EngagementZone
                title="Centro operativo"
                description="Comunicados y accesos directos configurados para administrar, publicar y coordinar cambios."
                announcements={actionCenterAnnouncements}
                ctas={actionCenterCtas}
                variant="admin"
                emptyLabel="Sin acciones ni comunicados activos en este espacio."
              />
            </section>
          ) : null}

          <section className={styles.contentSurface} aria-label="Contenido admin">
            {hasInsideContent ? (
              <div className={styles.inlineMessages}>
                <AnnouncementOutlet
                  announcements={contentInsideAnnouncements}
                  className={styles.inlineAnnouncementList}
                />
                {contentInsideCtas.length ? (
                  <ConfiguredCtaList
                    ctas={contentInsideCtas}
                    className={styles.inlineCtaGrid}
                  />
                ) : null}
              </div>
            ) : null}

            <div className={styles.adminContent}>{children}</div>
          </section>

          <CampusIntegrityNotice campusIntegrity={campusIntegrity} />

          <AppFooter />
        </main>
      </div>
    </div>
  );
}
