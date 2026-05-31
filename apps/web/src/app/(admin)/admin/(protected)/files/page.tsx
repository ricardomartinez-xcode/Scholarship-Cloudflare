import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { listFileAssets } from "@/lib/file-assets";
import FilesClient from "./FilesClient";

export const dynamic = "force-dynamic";

export default async function AdminFilesPage() {
  await requireAdminCapabilityUser(AdminCapability.manage_offers);
  const files = await listFileAssets({ limit: 500 });

  return (
    <div className="grid gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Archivos R2</h1>
        <p className="mt-1 text-sm text-slate-300">
          Gestiona assets reutilizables para programas, previews, formatos y capacitación.
        </p>
      </div>
      <FilesClient files={files} />
    </div>
  );
}
