import { AdminCapability } from "@prisma/client";

import OperationsAssistantPanel from "@/components/admin/OperationsAssistantPanel";
import { requireAdminCapabilityUser } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function OperationsAssistantPage() {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  return <OperationsAssistantPanel />;
}
