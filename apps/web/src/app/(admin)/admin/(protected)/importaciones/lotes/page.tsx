import { AdminCapability } from "@prisma/client";

import BatchAcademicOfferImportClient from "@/components/admin/BatchAcademicOfferImportClient";
import { requireAdminCapabilityUser } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function BatchImportsPage() {
  await requireAdminCapabilityUser(AdminCapability.manage_offers);

  return (
    <main className="grid gap-5 p-4 sm:p-5 lg:p-6">
      <BatchAcademicOfferImportClient />
    </main>
  );
}
