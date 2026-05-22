import { AdminCapability } from "@prisma/client";

export const ADMIN_ROUTE_CAPABILITIES: Record<string, AdminCapability[]> = {
  "/admin/prices": [AdminCapability.manage_prices],
  "/admin/benefits": [AdminCapability.manage_benefits],
  "/admin/users": [AdminCapability.view_users],
  "/admin/invitations": [AdminCapability.view_invites],
  "/admin/reporting": [AdminCapability.view_reports],
  "/admin/whatsapp": [AdminCapability.manage_ctas],
};

export function requiredRouteCapabilities(pathname: string) {
  return ADMIN_ROUTE_CAPABILITIES[pathname] ?? [];
}
