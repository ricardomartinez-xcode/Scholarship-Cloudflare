import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { listFileAssets } from "@/lib/file-assets";
import { listContentBucketObjects } from "@/lib/storage/content-bucket";
import FilesClient from "./FilesClient";

export const dynamic = "force-dynamic";

export default async function AdminFilesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminCapabilityUser(AdminCapability.manage_offers);
  const params = searchParams ? await searchParams : undefined;
  const status = typeof params?.status === "string" ? params.status : "";
  const error = typeof params?.error === "string" ? params.error : "";
  const [files, contentBucketFiles] = await Promise.all([
    listFileAssets({ limit: 500 }),
    listContentBucketObjects(),
  ]);

  return (
    <div className="grid gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Archivos R2</h1>
        <p className="mt-1 text-sm text-slate-300">
          Gestiona assets reutilizables para programas, previews, formatos y capacitación.
        </p>
      </div>
      <FilesClient
        files={files}
        contentBucketFiles={contentBucketFiles}
        statusMessage={status}
        errorMessage={error}
      />
    </div>
  );
}
