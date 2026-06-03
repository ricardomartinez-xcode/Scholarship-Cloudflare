import NeonAuthIntegrationPanel from "@/components/admin/NeonAuthIntegrationPanel";
import { requireAdminAccessUser } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function NeonAuthIntegrationPage() {
  await requireAdminAccessUser();
  return <NeonAuthIntegrationPanel />;
}
