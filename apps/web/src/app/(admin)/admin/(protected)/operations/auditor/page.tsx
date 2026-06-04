import { AdminCapability } from "@prisma/client";

import AuditorPanel from "@/components/admin/AuditorPanel";
import { requireAdminCapabilityUser } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AuditorOperationsPage() {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  return <AuditorPanel />;
}
