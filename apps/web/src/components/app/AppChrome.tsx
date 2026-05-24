"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import AppFooter from "@/components/app/AppFooter";
import AppSidebar from "@/components/app/AppSidebar";
import InboxDock from "@/components/unidep/InboxDock";
import AnnouncementOutlet, {
  type Announcement,
} from "@/components/announcement/AnnouncementOutlet";
import ConfiguredCtaList from "@/components/cta/ConfiguredCtaList";

import { DashboardIcon } from "@/components/layout/DashboardIcons";
import SimulatorProvider from "@/components/simulator/SimulatorProvider";
import {
  flattenDashboardNavItems,
  resolveDashboardBreadcrumbs,
  resolveDashboardTitle,
  workspaceFooterNavItems,
  workspaceNavGroups,
} from "@/config/dashboard-navigation";
import {
  resolveWorkspaceSectionFromLegacy,
  resolveWorkspaceSectionFromPath,
} from "@/lib/unidep-navigation";
import { canAccessWorkspaceWhatsapp } from "@/lib/workspace-access";

type AppContextValue = {
  userEmail: string | null;
  isAdmin: boolean;
  adminUnlocked: boolean;
  unlockAdmin: () => void;
  activeSection: string;
  setActiveSection: (key: string) => void;
};

type PublicCta = {
  id: string;
  label: string;
  kind: "link" | "action";
  url: string | null;
  variant: string | null;
  placement?: string | null;
};

const AppContext = createContext<AppContextValue | null>(null);
const WORKSPACE_ITEMS = flattenDashboardNavItems(
  workspaceNavGroups,
  workspaceFooterNavItems,
);
const WORKSPACE_SHORTCUT_ITEMS = [
  ...workspaceNavGroups.flatMap((group) => group.items),
  ...workspaceFooterNavItems,
];

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

function isFocusableElement(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") {
    return false;
  }
  return element.offsetParent !== null || element.getClientRects().length > 0;
}

function focusWorkspaceSearch() {
  if (typeof document === "undefined") return false;

  const searchTargets = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        '[data-workspace-shortcut="search"]',
        'input[type="search"]',
        'input[placeholder*="Buscar"]',
        'textarea[placeholder*="Buscar"]',
        ".ui-chat-search",
      ].join(","),
    ),
  );
  const target = searchTargets.find(isFocusableElement);
  if (!target) return false;

  target.focus();
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.select();
  }
  return true;
}

function isAdminPanelCta(cta: PublicCta) {
  const label = cta.label.toLowerCase();
  const url = (cta.url ?? "").toLowerCase();
  return url === "/admin" || label.includes("panel de administr");
}

function dedupeCtas(ctas: PublicCta[]) {
  const seen = new Set<string>();
  return ctas.filter((cta) => {
    const key = `${cta.kind}:${cta.url ?? ""}:${cta.label.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isAdminPanelAnnouncement(item: Announcement) {
  const title = item.title.toLowerCase();
  const message = item.message.toLowerCase();
  const buttonLabel = (item.buttonLabel ?? "").toLowerCase();
  const url = (item.url ?? "").toLowerCase();
  return (
    url === "/admin" ||
    title.includes("panel de administr") ||
    message.includes("panel de administr") ||
    buttonLabel.includes("panel de administr")
  );
}

function WorkspaceSidebarNav({
  activeSection,
  onNavigate,
  sidebarTopAnnouncements,
  sidebarBottomAnnouncements,
  userEmail,
}: {
  activeSection: string;
  onNavigate?: () => void;
  sidebarTopAnnouncements: Announcement[];
  sidebarBottomAnnouncements: Announcement[];
  userEmail: string | null;
}) {
  const appTopAnnouncements = sidebarTopAnnouncements.filter(
    (item) => !isAdminPanelAnnouncement(item),
  );
  const appBottomAnnouncements = sidebarBottomAnnouncements.filter(
    (item) => !isAdminPanelAnnouncement(item),
  );

  return (
    <div className="ui-sidebar-stack">
      <section className="ui-sidebar-action-panel rounded-[24px] border p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-[color:var(--ui-border)] bg-white">
            <Image
              src="/branding/logo-unidep.png"
              alt="UNIDEP"
              width={120}
              height={48}
              className="h-7 w-auto object-contain"
            />
          </div>
          <div className="ui-shell-brand min-w-0">
            <div className="ui-shell-brand__eyebrow">Workspace</div>
            <div className="ui-shell-brand__title">UNIDEP</div>
          </div>
        </div>
      </section>

      <AnnouncementOutlet
        announcements={appTopAnnouncements}
        appearance="compact"
        className="grid gap-2"
      />

      <AppSidebar activeKey={activeSection} onNavigate={onNavigate} userEmail={userEmail} />

      <AnnouncementOutlet
        announcements={appBottomAnnouncements}
        appearance="compact"
        className="grid gap-2"
      />
    </div>
  );
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within <AppChrome />");
  return ctx;
};

export default function AppChrome({
  children,
  userEmail,
  userDisplayName,
  isAdmin,
  profileHref = "/profile",
  navBannerCtas = [],
  sidebarTopCtas = [],
  sidebarBottomCtas = [],
  sidebarTopAnnouncements = [],
  sidebarBottomAnnouncements = [],
}: {
  children: React.ReactNode;
  userEmail: string | null;
  userDisplayName?: string | null;
  isAdmin: boolean;
  signOutAction: () => Promise<void>;
  profileHref?: string | null;
  navBannerCtas?: PublicCta[];
  sidebarTopCtas?: PublicCta[];
  unidepSidebarCtas?: PublicCta[];
  simulatorTopCtas?: PublicCta[];
  simulatorBottomCtas?: PublicCta[];
  sidebarBottomCtas?: PublicCta[];
  sidebarBottomAnnouncements?: Announcement[];
  navAnnouncements?: Announcement[];
  sidebarTopAnnouncements?: Announcement[];
  unidepSidebarAnnouncements?: Announcement[];
  simulatorTopAnnouncements?: Announcement[];
  simulatorBottomAnnouncements?: Announcement[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [activeSection, setActiveSection] = useState("becas");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const showWorkspaceLayout =
    pathname.startsWith("/unidep") || pathname.startsWith("/extension");

  const unlockAdmin = () => setAdminUnlocked(true);
  const resolvedProfileHref = profileHref ?? null;
  const accountLabel = userDisplayName?.trim() || userEmail || "n/a";
  const showProfileActions = Boolean(resolvedProfileHref);
  const workspaceTab = searchParams.get("tab");
  const workspaceSection = searchParams.get("section");
  const pathWorkspaceSection = resolveWorkspaceSectionFromPath(pathname);
  const legacyWorkspaceSection = resolveWorkspaceSectionFromLegacy(
    workspaceTab,
    workspaceSection,
  );
  const workspaceActiveSection = pathWorkspaceSection ?? legacyWorkspaceSection;
  const effectiveWorkspaceSection =
    workspaceActiveSection ?? WORKSPACE_ITEMS[0]?.key ?? "becas";
  const workspaceWhatsappAllowed = canAccessWorkspaceWhatsapp(userEmail);
  const visibleWorkspaceSection =
    !workspaceWhatsappAllowed && effectiveWorkspaceSection === "waba"
      ? "web"
      : effectiveWorkspaceSection;
  const resolvedActiveSection = showWorkspaceLayout ? visibleWorkspaceSection : activeSection;
  const currentWorkspaceItem =
    WORKSPACE_ITEMS.find((item) => item.key === resolvedActiveSection) ??
    WORKSPACE_ITEMS[0];
  const breadcrumbs = showWorkspaceLayout
    ? ["UNIDEP", currentWorkspaceItem.label]
    : resolveDashboardBreadcrumbs(pathname);
  const pageTitle = showWorkspaceLayout
    ? currentWorkspaceItem.label
    : resolveDashboardTitle(pathname);
  const workspaceNavBannerCtas = useMemo(
    () =>
      dedupeCtas(
        [...navBannerCtas, ...sidebarTopCtas, ...sidebarBottomCtas].filter(
          (cta) => !isAdminPanelCta(cta),
        ),
      ),
    [navBannerCtas, sidebarBottomCtas, sidebarTopCtas],
  );

  const ctx = useMemo<AppContextValue>(
    () => ({
      userEmail,
      isAdmin,
      adminUnlocked,
      unlockAdmin,
      activeSection: resolvedActiveSection,
      setActiveSection,
    }),
    [adminUnlocked, isAdmin, resolvedActiveSection, userEmail],
  );

  useEffect(() => {
    if (!showWorkspaceLayout) return;

    function handleKeyboardShortcut(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const hasModKey = event.metaKey || event.ctrlKey;

      if (event.key === "Escape") {
        setMobileNavOpen(false);
        window.dispatchEvent(new CustomEvent("workspace:close-floating-panels"));
        return;
      }

      if (hasModKey && key === "k") {
        event.preventDefault();
        focusWorkspaceSearch();
        return;
      }

      if (!isEditableTarget(event.target) && event.key === "/") {
        event.preventDefault();
        focusWorkspaceSearch();
        return;
      }

      if (hasModKey && key === "i") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("workspace:toggle-inbox"));
        return;
      }

      if (!isEditableTarget(event.target) && event.altKey && /^[1-9]$/.test(event.key)) {
        const shortcutIndex = Number(event.key) - 1;
        const item = WORKSPACE_SHORTCUT_ITEMS[shortcutIndex];
        if (!item) return;
        event.preventDefault();
        router.push(item.href);
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcut);
    };
  }, [router, showWorkspaceLayout]);

  return (
    <AppContext.Provider value={ctx}>
      <SimulatorProvider>
        <div className="min-h-screen overflow-x-clip text-[color:var(--ui-text-primary)]">
          <div className="ui-page-frame ui-page-grid grid-cols-1">
            <div className="ui-page-main grid-rows-[auto_auto_auto_1fr_auto]">
              <header className="ui-shell-header ui-shell-header--workspace ui-workspace-header flex min-h-[var(--ui-shell-topbar-height)] items-center justify-between gap-3">
                <div className="ui-workspace-header__identity flex min-w-0 items-center gap-3">
                  {showWorkspaceLayout ? (
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
                          <Dialog.Title className="sr-only">Navegación UNIDEP</Dialog.Title>
                          <Dialog.Close asChild>
                            <button
                              type="button"
                              className="ui-shell-icon-button absolute right-3 top-3 h-9 w-9"
                              aria-label="Cerrar menú"
                            >
                              <DashboardIcon name="close" className="h-4 w-4" />
                            </button>
                          </Dialog.Close>
                          <div className="ui-scrollbar mt-12 flex-1 overflow-y-auto">
                            <WorkspaceSidebarNav
                              activeSection={resolvedActiveSection}
                              onNavigate={() => setMobileNavOpen(false)}
                              sidebarTopAnnouncements={sidebarTopAnnouncements}
                              sidebarBottomAnnouncements={sidebarBottomAnnouncements}
                              userEmail={userEmail}
                            />
                          </div>
                        </Dialog.Content>
                      </Dialog.Portal>
                    </Dialog.Root>
                  ) : null}

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
                    <div className="ui-workspace-header__title mt-1 text-base font-semibold text-[color:var(--ui-text-primary)] sm:text-lg">
                      {pageTitle}
                    </div>
                  </div>
                </div>

                {showWorkspaceLayout && workspaceNavBannerCtas.length ? (
                  <ConfiguredCtaList
                    ctas={workspaceNavBannerCtas}
                    appearance="card"
                    className="grid gap-2 md:grid-cols-2 xl:grid-cols-3"
                  />
                ) : null}

                <div className="ui-workspace-header__account flex min-w-0 items-center gap-2.5">
                  <div className="hidden text-right sm:block">
                    <div className="ui-workspace-header__email max-w-[260px] truncate text-sm font-semibold text-[color:var(--ui-text-primary)]">
                      {accountLabel}
                    </div>
                  </div>

                  {showProfileActions ? (
                    <Link
                      href={resolvedProfileHref!}
                      className="ui-cta-secondary min-h-9 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(31,108,140,0.3)]"
                    >
                      Área personal
                    </Link>
                  ) : null}
                </div>
              </header>

              <main className="min-w-0 pb-1">{children}</main>

              <AppFooter />
            </div>
          </div>
          {showWorkspaceLayout ? <InboxDock /> : null}
        </div>
      </SimulatorProvider>
    </AppContext.Provider>
  );
}
