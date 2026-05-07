"use client";

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
  hasChildren = false,
}: {
  item: DashboardNavItem;
  collapsed: boolean;
  hasChildren?: boolean;
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
          {hasChildren ? (
            <span className="ui-shell-nav-link__meta" aria-hidden="true">
              {item.children?.length ?? 0}
            </span>
          ) : null}
        </>
      ) : null}
    </>
  );
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

              const className = [
                "ui-shell-nav-link",
                hasChildren ? "ui-shell-nav-link--parent" : "",
                collapsed ? "justify-center px-0" : "",
                isActive ? "ui-shell-nav-link--active" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const content = (
                <NavLinkContent
                  item={item}
                  collapsed={collapsed}
                  hasChildren={hasChildren}
                />
              );

              const children = !collapsed && hasChildren && isActive ? (
                <div className="ui-shell-nav-sublist" aria-label={`${item.label}: secciones`}>
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

              if (onItemSelect) {
                return (
                  <div key={item.key} className="ui-shell-nav-entry">
                    <button
                      type="button"
                      onClick={() => onItemSelect(item)}
                      className={className}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={item.shortLabel ?? item.label}
                      title={collapsed ? item.label : undefined}
                    >
                      {content}
                    </button>
                    {children}
                  </div>
                );
              }

              return (
                <div key={item.key} className="ui-shell-nav-entry">
                  <Link
                    href={item.href}
                    className={className}
                    onClick={onLinkNavigate}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={item.shortLabel ?? item.label}
                    title={collapsed ? item.label : undefined}
                  >
                    {content}
                  </Link>
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
