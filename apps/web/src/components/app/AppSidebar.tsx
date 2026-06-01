"use client";

import type {
  DashboardNavGroup,
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

function removeChildByKey(item: DashboardNavItem, key: string) {
  const match = item.children?.find((child) => child.key === key) ?? null;
  if (!item.children?.length) return { item, match };

  return {
    item: {
      ...item,
      children: item.children.filter((child) => child.key !== key),
    },
    match,
  };
}

function upsertChild(parent: DashboardNavItem, child: DashboardNavItem, index?: number) {
  const children = (parent.children ?? []).filter((current) => current.key !== child.key);
  const safeIndex = typeof index === "number" ? Math.max(0, Math.min(index, children.length)) : children.length;
  children.splice(safeIndex, 0, child);
  return { ...parent, children };
}

function rearrangeWorkspaceNavGroups(groups: DashboardNavGroup[]) {
  return groups.map((group) => {
    let movedFormats: DashboardNavItem | null = null;
    let movedPlans: DashboardNavItem | null = null;

    const itemsWithoutMovedChildren = group.items.map((item) => {
      let nextItem: DashboardNavItem = {
        ...item,
        children: item.children?.map((child) => ({ ...child })),
      };

      if (nextItem.key === "oferta") {
        const withoutFormats = removeChildByKey(nextItem, "formatos");
        nextItem = withoutFormats.item;
        movedFormats = withoutFormats.match;
        nextItem = {
          ...nextItem,
          children: nextItem.children?.map((child) =>
            child.key === "oferta-academica"
              ? {
                  ...child,
                  label: "Oferta por planteles",
                  shortLabel: "Planteles",
                }
              : child,
          ),
        };
      }

      if (nextItem.key === "catalogos") {
        const withoutPlans = removeChildByKey(nextItem, "planes");
        nextItem = withoutPlans.item;
        movedPlans = withoutPlans.match;
      }

      return nextItem;
    });

    const items = itemsWithoutMovedChildren.map((item) => {
      if (item.key === "oferta") {
        return movedPlans
          ? upsertChild(
              item,
              {
                ...movedPlans,
                group: "oferta",
              },
              1,
            )
          : item;
      }

      if (item.key === "catalogos") {
        const itemWithFormats = movedFormats
          ? upsertChild(
              item,
              {
                ...movedFormats,
                group: "catalogos",
              },
              0,
            )
          : item;
        const firstChild = itemWithFormats.children?.[0];
        return firstChild ? { ...itemWithFormats, href: firstChild.href } : itemWithFormats;
      }

      return item;
    });

    return { ...group, items };
  });
}

export default function AppSidebar({
  activeKey,
  onSelect,
  onNavigate,
  collapsed = false,
  userEmail,
}: AppSidebarProps) {
  const filteredWorkspaceNavGroups = rearrangeWorkspaceNavGroups(
    workspaceNavGroups.map((group) => ({
      ...group,
      items: filterWorkspaceNavItems(group.items, userEmail ?? null),
    })),
  );

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
