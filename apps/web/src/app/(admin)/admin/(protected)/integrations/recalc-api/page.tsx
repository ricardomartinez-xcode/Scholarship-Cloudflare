import { AdminCapability } from "@prisma/client";

import RecalcApiTokensPanel from "@/components/admin/RecalcApiTokensPanel";
import { requireAdminCapabilityUser } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function RecalcApiTokensPage() {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  return <RecalcApiTokensPanel />;
}
