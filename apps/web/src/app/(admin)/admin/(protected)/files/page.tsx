import { requireAdminAccessUser } from "@/lib/admin-session";
import { listFileAssets } from "@/lib/file-assets";

import { FilesUploader } from "./FilesUploader";

export const dynamic = "force-dynamic";

export default async function AdminFilesPage() {
  await requireAdminAccessUser();
  const assets = await listFileAssets();

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Storage</p>
        <h1 className="text-2xl font-semibold text-slate-950">Archivos y previews</h1>
        <p className="max-w-2xl text-sm text-slate-600">Subida directa a Cloudflare R2 con URLs firmadas, metadata en Postgres y links compartibles desde el sitio.</p>
      </div>
      <FilesUploader initialAssets={assets.map((asset) => ({ ...asset, createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString() }))} />
    </main>
  );
}
