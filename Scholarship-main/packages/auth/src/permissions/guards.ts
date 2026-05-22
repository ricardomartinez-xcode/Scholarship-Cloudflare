import type { AdminCapability } from "@prisma/client";

import { hasAnyAdminCapability } from "@/lib/admin-capabilities";

export function assertCapability(
  user: { capabilities: Iterable<AdminCapability> },
  capability: AdminCapability | AdminCapability[],
) {
  const required = Array.isArray(capability) ? capability : [capability];
  return hasAnyAdminCapability(user.capabilities, required);
}
