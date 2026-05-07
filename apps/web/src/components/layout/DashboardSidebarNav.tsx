"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { DashboardNavGroup, DashboardNavItem } from "@/config/dashboard-navigation";
import { DashboardIcon, type DashboardIconName } from "@/components/layout/DashboardIcons";

function isHrefActive(
  itemHref: string,
  pathname: string | undefined,
  aliases?: string[],
) {
  if (!pathname) return false;
  const matchableHrefs = [itemHref, ...(aliases ?? [])];
  return matchableHrefs.some((href) => {
    if (href === pathname) return true;
    if (href === "/unidep" || href === "/admin") return pathname === href;
    return pathname.startsWith(`${href}/`);
  });
}

function isItemActive(
  item: DashboardNavItem,
  activeKey: string | null | undefined,
  pathname: string | undefined,
): boolean {
  if (activeKey) {
    if (item.key === activeKey) return true;
    return item.children?.some((child) => isItemActive(child, activeKey, pathname)) ?? false;
  }

  if (isHrefActive(item.href, pathname, item.aliases)) return true;
  return item.children?.some((child) => isItemActive(child, activeKey, pathname)) ?? false;
}

function NavLinkContent({
  item,
  collapsed,
}: {
  item: DashboardNavItem;
  collapsed: boolean;
}) {
  return (
    <>
      <span className="ui-shell-nav-link__icon">
        <DashboardIcon
          name={item.icon as DashboardIconName}
          className="h-[15px] w-[15px]"
        />
      </span>
      {!collapsed ? (
        <>
          <span className="ui-shell-nav-link__label">{item.label}</span>
        </>
      ) : null}
    </>
  );
}

function collectActiveParentKeys(
  items: DashboardNavItem[],
  activeKey: string | null | undefined,
  pathname: string | undefined,
) {
  const keys: string[] = [];

  const visit = (item: DashboardNavItem): boolean => {
    const childActive = item.children?.some(visit) ?? false;
    const selfActive = activeKey
      ? item.key === activeKey
      : isHrefActive(item.href, pathname, item.aliases);

    if (item.children?.length && (childActive || selfActive)) {
      keys.push(item.key);
    }

    return selfActive || childActive;
  };

  items.forEach(visit);
  return keys;
}

export default function DashboardSidebarNav({
  groups,
  activeKey,
  pathname,
  collapsed = false,
  onItemSelect,
  onLinkNavigate,
}: {
  groups: DashboardNavGroup[];
  activeKey?: string | null;
  pathname?: string;
  collapsed?: boolean;
  onItemSelect?: (item: DashboardNavItem) => void;
  onLinkNavigate?: () => void;
}) {
  const activeParentKeys = useMemo(
    () =>
      groups.flatMap((group) =>
        collectActiveParentKeys(group.items, activeKey, pathname),
      ),
    [activeKey, groups, pathname],
  );
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set(activeParentKeys),
  );

  useEffect(() => {
    if (!activeParentKeys.length) return;
    setExpandedKeys((current) => {
      const next = new Set(current);
      activeParentKeys.forEach((key) => next.add(key));
      return next;
    });
  }, [activeParentKeys]);

  const toggleExpanded = (key: string) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <nav aria-label="Navegación principal" className="ui-shell-nav">
      {groups.map((group) => (
        <section
          key={group.key}
          className={`ui-shell-nav-group ui-shell-nav-group--${group.key}`}
        >
          {!collapsed ? (
            <div className="ui-shell-nav-group__label">{group.label}</div>
          ) : null}
          <div className="ui-shell-nav-list">
            {group.items.map((item) => {
              const hasChildren = Boolean(item.children?.length);
              const isActive = isItemActive(item, activeKey, pathname);
              const isExpanded = hasChildren && expandedKeys.has(item.key);

              const className = [
                "ui-shell-nav-link",
                hasChildren ? "ui-shell-nav-link--parent" : "",
                collapsed ? "justify-center px-0" : "",
                isActive ? "ui-shell-nav-link--active" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const content = (
                <NavLinkContent item={item} collapsed={collapsed} />
              );

              const children = !collapsed && hasChildren && isExpanded ? (
                <div
                  className="ui-shell-nav-sublist"
                  aria-label={`${item.label}: secciones`}
                >
                  {item.children!.map((child) => {
                    const childActive = isItemActive(child, activeKey, pathname);
                    const childClassName = [
                      "ui-shell-nav-subitem",
                      childActive ? "ui-shell-nav-subitem--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    const childContent = (
                      <>
                        <span className="ui-shell-nav-subitem__dot" aria-hidden="true" />
                        <span className="ui-shell-nav-subitem__label">{child.label}</span>
                      </>
                    );

                    if (onItemSelect) {
                      return (
                        <button
                          key={child.key}
                          type="button"
                          onClick={() => onItemSelect(child)}
                          className={childClassName}
                          aria-current={childActive ? "page" : undefined}
                        >
                          {childContent}
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={child.key}
                        href={child.href}
                        className={childClassName}
                        onClick={onLinkNavigate}
                        aria-current={childActive ? "page" : undefined}
                      >
                        {childContent}
                      </Link>
                    );
                  })}
                </div>
              ) : null;

              const expander = !collapsed && hasChildren ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleExpanded(item.key);
                  }}
                  className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-slate-300 transition hover:bg-white/10"
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Contraer" : "Expandir"} ${item.label}`}
                >
                  <span aria-hidden="true">{isExpanded ? "-" : "+"}</span>
                </button>
              ) : null;

              if (onItemSelect) {
                return (
                  <div key={item.key} className="ui-shell-nav-entry">
                    <div className="flex min-w-0 items-center">
                      <button
                        type="button"
                        onClick={() => onItemSelect(item)}
                        className={`${className} min-w-0 flex-1`}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={item.shortLabel ?? item.label}
                        title={collapsed ? item.label : undefined}
                      >
                        {content}
                      </button>
                      {expander}
                    </div>
                    {children}
                  </div>
                );
              }

              return (
                <div key={item.key} className="ui-shell-nav-entry">
                  <div className="flex min-w-0 items-center">
                    <Link
                      href={item.href}
                      className={`${className} min-w-0 flex-1`}
                      onClick={onLinkNavigate}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={item.shortLabel ?? item.label}
                      title={collapsed ? item.label : undefined}
                    >
                      {content}
                    </Link>
                    {expander}
                  </div>
                  {children}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
