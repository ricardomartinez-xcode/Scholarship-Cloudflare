import { AdminCapability } from "@prisma/client";

import {
  listAutoAuditRuns,
  listAutoRepairRuns,
  serializeAutoAuditRun,
  serializeAutoRepairRun,
} from "@/lib/admin-autopilot";
import { requireAdminCapabilityUser } from "@/lib/admin-session";

import AutopilotClient from "./AutopilotClient";

export const dynamic = "force-dynamic";

export default async function AutopilotPage() {
  const admin = await requireAdminCapabilityUser(AdminCapability.view_reports);
  const [audits, repairs] = await Promise.all([
    listAutoAuditRuns({ limit: 20 }),
    listAutoRepairRuns({ limit: 20 }),
  ]);
  const canRepair =
    admin.isSystemOwner || admin.capabilities.includes(AdminCapability.publish_config);

  return (
    <AutopilotClient
      initialAudits={audits.map(serializeAutoAuditRun)}
      initialRepairs={repairs.map(serializeAutoRepairRun)}
      canRepair={canRepair}
    />
  );
}
