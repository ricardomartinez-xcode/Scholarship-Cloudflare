"use client";

import type {
  DashboardNavItem,
} from "@/config/dashboard-navigation";
import DashboardSidebarNav from "@/components/layout/DashboardSidebarNav";
import {
  workspaceFooterNavItems,
  workspaceNavGroups,
} from "@/config/dashboard-navigation";
import { canAccessWorkspaceWhatsapp } from "@/lib/workspace-access";

type AppSidebarProps = {
  /**
   * Currently active section key. When provided, the matching navigation item
   * is highlighted. Defaults to "becas" in the workspace.
   */
  activeKey?: string;
  /**
   * Callback invoked when a navigation item is selected.
   */
  onSelect?: (item: DashboardNavItem) => void;
  /**
   * Callback invoked after following a navigation link. Used by drawers to close
   * the mobile menu after navigation.
   */
  onNavigate?: () => void;
  collapsed?: boolean;
  userEmail?: string | null;
  /**
   * Drawer account label contract.
   *
   * The nickname/user label must remain visible in the sidebar shell, rendered
   * by AppChrome's drawer identity block. AppSidebar itself only renders nav
   * items, but accepts this prop while the shell keeps a shared sidebar API.
   */
  accountLabel?: string;
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
