"use client";

import type { DashboardNavItem } from "@/config/dashboard-navigation";
import DashboardSidebarNav from "@/components/layout/DashboardSidebarNav";
import {
  workspaceFooterNavItems,
  workspaceNavGroups,
} from "@/config/dashboard-navigation";

export default function AppSidebar({
  activeKey,
  onSelect,
  onNavigate,
  collapsed = false,
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
}) {
  return (
    <div className="ui-shell-nav-layout">
      <DashboardSidebarNav
        groups={workspaceNavGroups}
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
