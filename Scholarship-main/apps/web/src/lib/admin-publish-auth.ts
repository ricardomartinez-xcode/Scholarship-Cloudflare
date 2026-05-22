import { AdminCapability, AdminConfigModule } from "@prisma/client";

import type { AdminAccessUser } from "@/lib/admin-session";
import { adminHasCapability, requireAdminAccessUser } from "@/lib/admin-session";
import {
  canPublishAdminConfig,
  getAdminConfigModuleMeta,
} from "@/lib/admin-config-modules";

export function canPublishConfigWithAdmin(
  admin:
    | Pick<AdminAccessUser, "email" | "capabilities" | "isSystemOwner">
    | null
    | undefined,
) {
  if (!admin) return false;
  if (admin.isSystemOwner) return true;
  if (adminHasCapability(admin, AdminCapability.publish_config)) return true;
  return canPublishAdminConfig(admin.email);
}

export async function requireConfigPublisher(module: AdminConfigModule) {
  const admin = await requireAdminAccessUser();
  if (!canPublishConfigWithAdmin(admin)) {
    throw new Error(
      `Solo usuarios autorizados pueden publicar o revertir ${getAdminConfigModuleMeta(module).label.toLowerCase()}.`,
    );
  }
  return admin;
}
