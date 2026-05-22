"use client";

import type { DashboardNavItem } from "@/config/dashboard-navigation";
import DashboardSidebarNav from "@/components/layout/DashboardSidebarNav";
import {
  workspaceFooterNavItems,
  workspaceNavGroups,
} from "@/config/dashboard-navigation";
import { canAccessWorkspaceWhatsapp } from "@/lib/workspace-access";

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
}: {
  /**
   * Currently active section key. When provided, the matching navigation item
   * will be highlighted. Defaults to "becas" on the public workspace.
   */
  activeKey?: string;
  /**
   * Callback invoked when a navigation item is selected. Receives the key of
   * the selected section.
   */
  onSelect?: (item: DashboardNavItem) => void;
  onNavigate?: () => void;
  collapsed?: boolean;
  userEmail?: string | null;
}) {
  const filteredWorkspaceNavGroups = workspaceNavGroups.map((group) => ({
    ...group,
    items: filterWorkspaceNavItems(group.items, userEmail ?? null),
  }));

  return (
    <div className="ui-shell-nav-layout">
      <DashboardSidebarNav
        groups={filteredWorkspaceNavGroups}
        activeKey={activeKey ?? "becas"}
        collapsed={collapsed}
        onItemSelect={onSelect}
        onLinkNavigate={onNavigate}
      />
      <div className="ui-shell-nav-footer" aria-label="Navegación fija">
        <DashboardSidebarNav
          groups={[{ key: "footer", label: "Footer", items: workspaceFooterNavItems }]}
          activeKey={activeKey}
          collapsed={collapsed}
          onItemSelect={onSelect}
          onLinkNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
