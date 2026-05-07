import { requiredRouteCapabilities } from "@relead/auth/permissions/route-capabilities";
import { can } from "@relead/auth/permissions/client";

export function filterAdminNavigationByCapabilities<T extends { href: string }>(
  items: T[],
  capabilities: string[],
) {
  return items.filter((item) => {
    const required = requiredRouteCapabilities(item.href);
    return required.length === 0 || can(capabilities, required);
  });
}
