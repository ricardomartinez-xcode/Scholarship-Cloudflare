import { AdminCapability } from "@prisma/client";

export const ADMIN_ROUTE_CAPABILITIES: Record<string, AdminCapability[]> = {
  "/admin": [AdminCapability.view_admin],
  "/admin/prices": [AdminCapability.manage_prices],
  "/admin/unidep/fees": [AdminCapability.manage_prices],
  "/admin/unidep/simulador": [AdminCapability.manage_prices],
  "/admin/benefits": [AdminCapability.manage_benefits],
  "/admin/oferta": [AdminCapability.manage_offers],
  "/admin/unidep/programs": [AdminCapability.manage_offers],
  "/admin/unidep/formatos": [AdminCapability.manage_offers],
  "/admin/unidep/campuses": [AdminCapability.manage_directory],
  "/admin/unidep/directory": [AdminCapability.manage_directory],
  "/admin/sidebar": [AdminCapability.manage_sidebar],
  "/admin/users": [AdminCapability.view_users, AdminCapability.manage_users],
  "/admin/invitations": [AdminCapability.view_invites, AdminCapability.manage_invites],
  "/admin/organizations": [
    AdminCapability.view_admin_operations,
    AdminCapability.view_org_members,
    AdminCapability.manage_org_members,
  ],
  "/admin/auth-sync": [
    AdminCapability.view_admin_operations,
    AdminCapability.view_reports,
  ],
  "/admin/reporting": [
    AdminCapability.view_admin_operations,
    AdminCapability.view_reports,
  ],
  "/admin/audit": [
    AdminCapability.view_admin_operations,
    AdminCapability.view_reports,
  ],
  "/admin/whatsapp": [AdminCapability.manage_ctas],
  "/admin/whatsapp-templates": [
    AdminCapability.view_admin_operations,
    AdminCapability.manage_ctas,
  ],
  "/admin/comunicados": [
    AdminCapability.view_admin_operations,
    AdminCapability.manage_ctas,
  ],
  "/admin/ctas": [
    AdminCapability.view_admin_operations,
    AdminCapability.manage_ctas,
  ],
  "/admin/extension-panel": [AdminCapability.manage_ctas],
  "/admin/capacitacion": [
    AdminCapability.view_users,
    AdminCapability.manage_users,
    AdminCapability.view_org_members,
    AdminCapability.manage_org_members,
  ],
};

export function requiredRouteCapabilities(pathname: string) {
  const normalized = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
  const direct = ADMIN_ROUTE_CAPABILITIES[normalized];
  if (direct) return direct;

  const match = Object.keys(ADMIN_ROUTE_CAPABILITIES)
    .filter((route) => normalized.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0];

  return match ? ADMIN_ROUTE_CAPABILITIES[match] : [];
}
