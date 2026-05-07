import type { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";

export async function requireCapability(capability: AdminCapability | AdminCapability[]) {
  return requireAdminCapabilityUser(capability);
}
