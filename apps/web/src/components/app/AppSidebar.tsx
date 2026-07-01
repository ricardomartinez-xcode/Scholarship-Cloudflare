"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  DashboardNavGroup,
  DashboardNavItem,
} from "@/config/dashboard-navigation";
import {
  adminNavGroups,
  filterNavGroupsByCapabilities,
  workspaceFooterNavItems,
  workspaceNavGroups,
} from "@/config/dashboard-navigation";
import DashboardSidebarNav from "@/components/layout/DashboardSidebarNav";
import { canAccessWorkspaceWhatsapp } from "@/lib/workspace-access";

type AppSidebarProps = {
  activeKey?: string;
  onSelect?: (item: DashboardNavItem) => void;
  onNavigate?: () => void;
  collapsed?: boolean;
  userEmail?: string | null;
  accountLabel?: string;
};

type AdminAccessResponse = {
  ok?: boolean;
  capabilities?: string[];
};

const campaignSenderNavGroup: DashboardNavGroup = {
  key: "admin-campaign-sender",
  label: "Campañas WhatsApp",
  items: [
    {
      key: "campaign-sender",
      label: "Historial de campañas",
      shortLabel: "Campañas",
      href: "/admin/campaign-sender",
      icon: "whatsapp",
      group: "admin-campaign-sender",
      requiredAny: ["view_reports"],
    },
  ],
};

function filterWorkspaceNavItems(items: DashboardNavItem[], userEmail: string | null) {
  const showWorkspaceWhatsapp = canAccessWorkspaceWhatsapp(userEmail);

  return items
    .map((item) => {
      const children = item.children
        ?.filter((child) => showWorkspaceWhatsapp || child.key !== "waba")
        .map((child) => ({ ...child }));

      return {
        ...item,
        ...(children ? { children } : {}),
      };
    })
    .filter((item) => showWorkspaceWhatsapp || item.key !== "waba");
}

export default function AppSidebar({
  activeKey,
  onSelect,
  onNavigate,
  collapsed = false,
  userEmail,
}: AppSidebarProps) {
  const [adminCapabilities, setAdminCapabilities] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminAccess() {
      try {
        const response = await fetch("/api/admin/access", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const payload = (await response.json().catch(() => null)) as AdminAccessResponse | null;
        if (!cancelled) {
          setAdminCapabilities(payload?.ok ? payload.capabilities ?? [] : []);
        }
      } catch {
        if (!cancelled) setAdminCapabilities([]);
      }
    }

    void loadAdminAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  const workspaceGroups = useMemo(
    () => workspaceNavGroups.map((group) => ({
      ...group,
      items: filterWorkspaceNavItems(group.items, userEmail ?? null),
    })),
    [userEmail],
  );

  const adminGroups = useMemo(() => {
    if (!adminCapabilities?.length) return [];
    return filterNavGroupsByCapabilities(
      [...adminNavGroups, campaignSenderNavGroup],
      adminCapabilities,
    );
  }, [adminCapabilities]);

  return (
    <div className="ui-shell-nav-layout">
      <DashboardSidebarNav
        groups={workspaceGroups}
        activeKey={activeKey ?? "becas"}
        collapsed={collapsed}
        onItemSelect={onSelect}
        onLinkNavigate={onNavigate}
      />

      {adminGroups.length ? (
        <div className="ui-shell-nav-footer" aria-label="Administración">
          <div className="px-3 pb-2 pt-4 text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-slate-400">
            Administración
          </div>
          <DashboardSidebarNav
            groups={adminGroups}
            activeKey={undefined}
            collapsed={collapsed}
            onItemSelect={onSelect}
            onLinkNavigate={onNavigate}
          />
          <Link
            href="/admin"
            className="mx-3 mt-2 inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            onClick={onNavigate}
          >
            Abrir panel administrativo
          </Link>
        </div>
      ) : null}

      {workspaceFooterNavItems.length ? (
        <div className="ui-shell-nav-footer" aria-label="Navegación fija">
          <DashboardSidebarNav
            groups={[{ key: "footer", label: "Footer", items: workspaceFooterNavItems }]}
            activeKey={activeKey}
            collapsed={collapsed}
            onItemSelect={onSelect}
            onLinkNavigate={onNavigate}
          />
        </div>
      ) : null}
    </div>
  );
}
