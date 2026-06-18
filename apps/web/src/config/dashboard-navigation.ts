export type DashboardNavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  shortLabel?: string;
  group: string;
  aliases?: string[];
  requiredAll?: string[];
  requiredAny?: string[];
  children?: DashboardNavItem[];
};

export type DashboardNavGroup = {
  key: string;
  label: string;
  items: DashboardNavItem[];
};

export const workspaceNavGroups: DashboardNavGroup[] = [
  {
    key: "workspace-daily-operations",
    label: "Operación diaria",
    items: [
      {
        key: "becas",
        label: "Cotizador",
        icon: "calculator",
        shortLabel: "Cotizador",
        href: "/unidep",
        group: "workspace-daily-operations",
        aliases: ["/unidep/cotizador"],
      },
      {
        key: "contactos",
        label: "Prospectos",
        icon: "contacts",
        href: "/unidep/prospectos",
        group: "workspace-daily-operations",
        aliases: ["/unidep/contactos"],
      },
      {
        key: "inbox",
        label: "Inbox",
        icon: "inbox",
        href: "/unidep/inbox",
        group: "workspace-daily-operations",
      },
      {
        key: "historial",
        label: "Actividad",
        icon: "history",
        href: "/unidep/actividad",
        group: "workspace-daily-operations",
        aliases: ["/unidep/historial"],
      },
    ],
  },
  {
    key: "workspace-communication",
    label: "Comunicación",
    items: [
      {
        key: "comunicacion",
        label: "Comunicación",
        icon: "announcement",
        href: "/unidep/web",
        group: "workspace-communication",
        aliases: ["/unidep/comunicacion"],
        children: [
          {
            key: "web",
            label: "Campañas",
            icon: "web",
            shortLabel: "Campañas",
            href: "/unidep/web",
            group: "workspace-communication",
          },
          {
            key: "waba",
            label: "WhatsApp",
            icon: "whatsapp",
            shortLabel: "WhatsApp",
            href: "/unidep/waba",
            group: "workspace-communication",
          },
        ],
      },
    ],
  },
  {
    key: "workspace-academic-offer",
    label: "Oferta académica",
    items: [
      {
        key: "oferta",
        label: "Oferta académica",
        icon: "offer",
        href: "/unidep/oferta",
        group: "workspace-academic-offer",
        children: [
          {
            key: "oferta-academica",
            label: "Oferta por planteles",
            icon: "offer",
            href: "/unidep/oferta",
            group: "workspace-academic-offer",
          },
          {
            key: "planes",
            label: "Planes de estudio",
            icon: "plan",
            href: "/unidep/planes",
            group: "workspace-academic-offer",
          },
        ],
      },
    ],
  },
  {
    key: "workspace-unidep-catalogs",
    label: "Catálogos UNIDEP",
    items: [
      {
        key: "catalogos",
        label: "Catálogos",
        icon: "plan",
        href: "/unidep/formatos",
        group: "workspace-unidep-catalogs",
        children: [
          {
            key: "formatos",
            label: "Formatos",
            icon: "plan",
            href: "/unidep/formatos",
            group: "workspace-unidep-catalogs",
          },
          {
            key: "costos",
            label: "Costos",
            icon: "price",
            href: "/unidep/costos",
            group: "workspace-unidep-catalogs",
          },
          {
            key: "planteles",
            label: "Planteles",
            icon: "campus",
            href: "/unidep/planteles",
            group: "workspace-unidep-catalogs",
          },
          {
            key: "directorio",
            label: "Directorio",
            icon: "directory",
            href: "/unidep/directorio",
            group: "workspace-unidep-catalogs",
          },
        ],
      },
    ],
  },
  {
    key: "workspace-training",
    label: "Capacitación",
    items: [
      {
        key: "capacitacion",
        label: "Capacitación",
        icon: "training",
        href: "/unidep/capacitacion",
        group: "workspace-training",
        aliases: ["/capacitacion"],
        children: [
          {
            key: "rolplay",
            label: "Rolplay",
            icon: "contacts",
            href: "/unidep/capacitacion/rolplay",
            group: "workspace-training",
          },
          {
            key: "materiales",
            label: "Materiales",
            icon: "plan",
            href: "/unidep/capacitacion/materiales",
            group: "workspace-training",
          },
          {
            key: "evaluaciones",
            label: "Evaluaciones",
            icon: "audit",
            href: "/unidep/capacitacion/evaluaciones",
            group: "workspace-training",
          },
        ],
      },
    ],
  },
];

export const workspaceFooterNavItems: DashboardNavItem[] = [];

export function flattenDashboardNavItems(
  groups: DashboardNavGroup[],
  extraItems: DashboardNavItem[] = [],
) {
  const flattenItem = (item: DashboardNavItem): DashboardNavItem[] => [
    item,
    ...(item.children?.flatMap(flattenItem) ?? []),
  ];

  return [...groups.flatMap((group) => group.items.flatMap(flattenItem)), ...extraItems];
}

export function findDashboardNavItem(
  groups: DashboardNavGroup[],
  key: string,
  extraItems: DashboardNavItem[] = [],
) {
  return flattenDashboardNavItems(groups, extraItems).find((item) => item.key === key);
}

export const adminNavGroups: DashboardNavGroup[] = [
  {
    key: "admin-workspace",
    label: "Admin",
    items: [
      {
        key: "admin-summary",
        label: "Resumen operativo",
        icon: "summary",
        shortLabel: "Resumen",
        href: "/admin",
        group: "admin-workspace",
        requiredAny: ["view_admin"],
      },
      {
        key: "autopilot",
        label: "Autopilot",
        icon: "audit",
        href: "/admin/autopilot",
        group: "admin-workspace",
        requiredAny: ["view_reports"],
      },
      {
        key: "admin-access",
        label: "Accesos",
        icon: "users",
        href: "/admin/users",
        group: "admin-workspace",
        children: [
          {
            key: "users",
            label: "Usuarios",
            icon: "users",
            href: "/admin/users",
            group: "admin-access",
            requiredAny: ["view_users", "manage_users"],
          },
          {
            key: "invitations",
            label: "Invitaciones",
            icon: "invitation",
            href: "/admin/invitations",
            group: "admin-access",
            requiredAny: ["view_invites", "manage_invites"],
          },
          {
            key: "organizations",
            label: "Organizaciones",
            icon: "organization",
            href: "/admin/organizations",
            group: "admin-access",
            requiredAny: ["view_org_members", "manage_org_members"],
          },
          {
            key: "auth-sync",
            label: "Auth sync",
            icon: "sync",
            href: "/admin/auth-sync",
            group: "admin-access",
            requiredAny: ["view_admin_operations"],
          },
        ],
      },
      {
        key: "admin-academics",
        label: "Oferta y precios",
        icon: "offer",
        href: "/admin/oferta",
        group: "admin-workspace",
        children: [
          {
            key: "oferta",
            label: "Oferta por planteles",
            icon: "offer",
            href: "/admin/oferta",
            group: "admin-academics",
            requiredAny: ["manage_offers"],
          },
          {
            key: "programs",
            label: "Programas académicos",
            icon: "programs",
            href: "/admin/unidep/programs",
            group: "admin-academics",
            requiredAny: ["manage_offers"],
          },
          {
            key: "prices",
            label: "Precios",
            icon: "price",
            href: "/admin/prices",
            group: "admin-academics",
            requiredAny: ["manage_prices"],
          },
          {
            key: "benefits",
            label: "Beneficios",
            icon: "benefits",
            href: "/admin/benefits",
            group: "admin-academics",
            requiredAny: ["manage_benefits"],
          },
          {
            key: "fees",
            label: "Costos académicos",
            icon: "price",
            href: "/admin/unidep/fees",
            group: "admin-academics",
            requiredAny: ["manage_prices"],
          },
          {
            key: "simulator",
            label: "Simulador",
            icon: "simulator",
            href: "/admin/unidep/simulador",
            group: "admin-academics",
            requiredAny: ["manage_prices", "manage_offers"],
          },
          {
            key: "admin-formatos",
            label: "Formatos",
            icon: "plan",
            href: "/admin/unidep/formatos",
            group: "admin-academics",
            requiredAny: ["manage_offers"],
          },
          {
            key: "admin-files",
            label: "Archivos R2",
            icon: "plan",
            href: "/admin/files",
            group: "admin-academics",
            requiredAny: ["manage_offers"],
          },
        ],
      },
      {
        key: "admin-unidep-catalogs",
        label: "Catálogos UNIDEP",
        icon: "plan",
        href: "/admin/unidep/campuses",
        group: "admin-workspace",
        children: [
          {
            key: "campuses",
            label: "Planteles",
            icon: "campus",
            href: "/admin/unidep/campuses",
            group: "admin-unidep-catalogs",
            requiredAny: ["manage_directory"],
          },
          {
            key: "directory",
            label: "Directorio",
            icon: "directory",
            href: "/admin/unidep/directory",
            group: "admin-unidep-catalogs",
            requiredAny: ["manage_directory"],
          },
          {
            key: "aliases",
            label: "Aliases",
            icon: "sync",
            href: "/admin/aliases",
            group: "admin-unidep-catalogs",
            requiredAny: ["manage_prices", "manage_offers", "manage_benefits"],
          },
        ],
      },
      {
        key: "admin-communication",
        label: "Comunicación",
        icon: "announcement",
        href: "/admin/comunicados",
        group: "admin-workspace",
        children: [
          {
            key: "comunicados",
            label: "Comunicados",
            icon: "announcement",
            href: "/admin/comunicados",
            group: "admin-communication",
            requiredAll: ["view_admin_operations"],
            requiredAny: ["manage_ctas"],
          },
          {
            key: "ctas",
            label: "CTA's",
            icon: "cta",
            href: "/admin/ctas",
            group: "admin-communication",
            requiredAll: ["view_admin_operations"],
            requiredAny: ["manage_ctas"],
          },
          {
            key: "admin-whatsapp",
            label: "WhatsApp",
            icon: "whatsapp",
            href: "/admin/whatsapp",
            group: "admin-communication",
            requiredAny: ["manage_ctas"],
          },
          {
            key: "whatsapp-templates",
            label: "Templates WhatsApp",
            icon: "template",
            href: "/admin/whatsapp-templates",
            group: "admin-communication",
            requiredAll: ["view_admin_operations"],
            requiredAny: ["manage_ctas"],
          },
          {
            key: "extension-panel",
            label: "Extensión Chrome",
            icon: "extension",
            href: "/admin/extension-panel",
            group: "admin-communication",
            requiredAny: ["manage_ctas"],
          },
        ],
      },
      {
        key: "admin-system",
        label: "Sistema",
        icon: "sync",
        href: "/admin/importaciones",
        group: "admin-workspace",
        children: [
          {
            key: "importaciones",
            label: "Importaciones",
            icon: "sync",
            href: "/admin/importaciones",
            group: "admin-system",
            requiredAll: ["view_admin_operations"],
          },
          {
            key: "audit",
            label: "Auditoría",
            icon: "audit",
            href: "/admin/audit",
            group: "admin-system",
            requiredAll: ["view_admin_operations"],
            requiredAny: ["view_reports"],
          },
          {
            key: "recalc-api-tokens",
            label: "Tokens API Recalc",
            icon: "sync",
            href: "/admin/integrations/recalc-api",
            group: "admin-system",
            requiredAny: ["view_admin_operations"],
          },
          {
            key: "training",
            label: "Capacitación",
            icon: "training",
            href: "/admin/capacitacion",
            group: "admin-system",
            requiredAny: ["view_users", "manage_users", "view_org_members", "manage_org_members"],
          },
          {
            key: "training-bots",
            label: "Configuración de bots",
            icon: "contacts",
            href: "/admin/capacitacion/bots",
            group: "admin-system",
            requiredAny: ["view_users", "manage_users", "view_org_members", "manage_org_members"],
          },
          {
            key: "sidebar",
            label: "Contenido público",
            icon: "sidebar",
            href: "/admin/sidebar",
            group: "admin-system",
            requiredAny: ["manage_sidebar"],
          },
        ],
      },
    ],
  },
];

export function filterNavGroupsByCapabilities(
  groups: DashboardNavGroup[],
  capabilities: string[],
): DashboardNavGroup[] {
  const itemPassesCapabilities = (item: DashboardNavItem) => {
    if (item.requiredAll?.length) {
      const hasAll = item.requiredAll.every((required) => capabilities.includes(required));
      if (!hasAll) return false;
    }

    if (!item.requiredAny?.length) return true;
    return item.requiredAny.some((required) => capabilities.includes(required));
  };

  const filterItem = (item: DashboardNavItem): DashboardNavItem | null => {
    const children =
      item.children
        ?.map(filterItem)
        .filter((child): child is DashboardNavItem => Boolean(child)) ?? [];

    if (item.children?.length) return children.length ? { ...item, children } : null;
    return itemPassesCapabilities(item) ? item : null;
  };

  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .map(filterItem)
        .filter((item): item is DashboardNavItem => Boolean(item)),
    }))
    .filter((group) => group.items.length > 0);
}

export const dashboardTitles: Record<string, string> = {
  "/unidep": "Cotizador",
  "/unidep/cotizador": "Cotizador",
  "/unidep/waba": "WhatsApp",
  "/unidep/seguimiento": "Seguimiento",
  "/unidep/agenda": "Seguimiento",
  "/unidep/prospectos": "Prospectos",
  "/unidep/contactos": "Prospectos",
  "/unidep/web": "Campañas",
  "/unidep/actividad": "Actividad",
  "/unidep/historial": "Actividad",
  "/unidep/inbox": "Inbox",
  "/unidep/capacitacion": "Capacitación",
  "/unidep/capacitacion/rolplay": "Rolplay",
  "/unidep/capacitacion/materiales": "Materiales",
  "/unidep/capacitacion/evaluaciones": "Evaluaciones",
  "/unidep/oferta": "Oferta por planteles",
  "/unidep/formatos": "Formatos",
  "/unidep/costos": "Costos",
  "/unidep/planes": "Planes de estudio",
  "/unidep/directorio": "Directorio",
  "/unidep/planteles": "Planteles",
  "/admin": "Resumen operativo",
  "/admin/benefits": "Beneficios",
  "/admin/prices": "Precios",
  "/admin/oferta": "Oferta por planteles",
  "/admin/capacitacion": "Capacitación",
  "/admin/capacitacion/bots": "Configuración de bots",
  "/admin/unidep/programs": "Programas académicos",
  "/admin/unidep/campuses": "Planteles",
  "/admin/unidep/fees": "Costos académicos",
  "/admin/aliases": "Aliases y catálogos",
  "/admin/unidep/directory": "Directorio",
  "/admin/unidep/simulador": "Simulador",
  "/admin/unidep/formatos": "Formatos",
  "/admin/comunicados": "Comunicados",
  "/admin/sidebar": "Información pública",
  "/admin/whatsapp-templates": "Templates WhatsApp",
  "/admin/ctas": "CTA's",
  "/admin/importaciones": "Importaciones",
  "/admin/extension-panel": "Extensión Chrome",
  "/admin/invitations": "Invitaciones",
  "/admin/users": "Usuarios",
  "/admin/organizations": "Organizaciones",
  "/admin/autopilot": "Autopilot",
  "/admin/reporting": "Autoreparador",
  "/admin/audit": "Auditoría",
  "/admin/auth-sync": "Auth sync",
  "/admin/integrations/recalc-api": "Tokens API Recalc",
  "/profile": "Área personal",
};

export function resolveDashboardTitle(pathname: string): string {
  const matched =
    Object.keys(dashboardTitles)
      .sort((left, right) => right.length - left.length)
      .find((entry) => pathname === entry || pathname.startsWith(`${entry}/`)) ?? null;

  return matched ? dashboardTitles[matched] : "Scholarship";
}

export function resolveDashboardBreadcrumbs(pathname: string): string[] {
  if (pathname.startsWith("/admin")) return ["Admin", resolveDashboardTitle(pathname)];
  if (pathname.startsWith("/unidep")) return ["UNIDEP", resolveDashboardTitle(pathname)];
  return [resolveDashboardTitle(pathname)];
}
