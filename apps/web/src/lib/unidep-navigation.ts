export const WORKSPACE_ROUTE_BY_KEY = {
  becas: "/unidep",
  waba: "/unidep/waba",
  agenda: "/unidep/seguimiento",
  contactos: "/unidep/prospectos",
  inbox: "/unidep/inbox",
  web: "/unidep/web",
  historial: "/unidep/actividad",
  capacitacion: "/unidep/capacitacion",
  rolplay: "/unidep/capacitacion/rolplay",
  materiales: "/unidep/capacitacion/materiales",
  evaluaciones: "/unidep/capacitacion/evaluaciones",
  sesiones: "/unidep/capacitacion/rolplay",
  oferta: "/unidep/oferta",
  formatos: "/unidep/formatos",
  costos: "/unidep/costos",
  planes: "/unidep/planes",
  directorio: "/unidep/directorio",
  planteles: "/unidep/planteles",
} as const;

export type WorkspaceSectionKey = keyof typeof WORKSPACE_ROUTE_BY_KEY;

const WORKSPACE_SLUG_TO_KEY: Record<string, WorkspaceSectionKey> = {
  cotizador: "becas",
  waba: "waba",
  agenda: "agenda",
  seguimiento: "agenda",
  contactos: "contactos",
  prospectos: "contactos",
  inbox: "inbox",
  web: "web",
  historial: "historial",
  actividad: "historial",
  capacitacion: "capacitacion",
  rolplay: "rolplay",
  materiales: "materiales",
  evaluaciones: "evaluaciones",
  sesiones: "rolplay",
  oferta: "oferta",
  formatos: "formatos",
  costos: "costos",
  planes: "planes",
  directorio: "directorio",
  planteles: "planteles",
};

export function isWorkspaceSectionKey(value: string | null | undefined): value is WorkspaceSectionKey {
  return Boolean(value && value in WORKSPACE_ROUTE_BY_KEY);
}

export function resolveWorkspaceHref(section: WorkspaceSectionKey) {
  return WORKSPACE_ROUTE_BY_KEY[section];
}

export function resolveWorkspaceSectionFromLegacy(
  tab: string | null | undefined,
  section: string | null | undefined,
): WorkspaceSectionKey {
  if (isWorkspaceSectionKey(section)) return section;
  if (isWorkspaceSectionKey(tab)) return tab;
  return "becas";
}

export function resolveWorkspaceRouteFromLegacy(
  tab: string | null | undefined,
  section: string | null | undefined,
) {
  return resolveWorkspaceHref(resolveWorkspaceSectionFromLegacy(tab, section));
}

export function resolveWorkspaceSectionFromPath(pathname: string): WorkspaceSectionKey | null {
  if (pathname === "/unidep" || pathname.startsWith("/extension")) {
    return "becas";
  }
  if (pathname.startsWith("/unidep/cotizador")) {
    return "becas";
  }

  const matchedEntry = Object.entries(WORKSPACE_ROUTE_BY_KEY)
    .sort((left, right) => right[1].length - left[1].length)
    .find(([, href]) => href !== "/unidep" && pathname.startsWith(href));

  if (matchedEntry?.[0]) {
    return matchedEntry[0] as WorkspaceSectionKey;
  }

  const directSlug = pathname.split("/")[2];
  if (directSlug && WORKSPACE_SLUG_TO_KEY[directSlug]) {
    return WORKSPACE_SLUG_TO_KEY[directSlug];
  }

  return null;
}

export function resolveWorkspaceSectionFromSlug(slug: string | undefined) {
  if (!slug) return "becas";
  return WORKSPACE_SLUG_TO_KEY[slug] ?? null;
}
