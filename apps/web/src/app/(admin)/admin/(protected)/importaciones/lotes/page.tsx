import { AdminCapability } from "@prisma/client";

import BatchAdminImportClient from "@/components/admin/BatchAcademicOfferImportClient";
import BatchCatalogImportClient from "@/components/admin/BatchCatalogImportClient";
import { requireAdminCapabilityUser } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function BatchImportsPage() {
  await requireAdminCapabilityUser([
    AdminCapability.manage_offers,
    AdminCapability.manage_prices,
    AdminCapability.manage_benefits,
    AdminCapability.manage_org_members,
    AdminCapability.manage_directory,
  ]);

  return (
    <main className="grid gap-5 p-4 sm:p-5 lg:p-6">
      <BatchAdminImportClient />
      <BatchCatalogImportClient />
    </main>
  );
}
