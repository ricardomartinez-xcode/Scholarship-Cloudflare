import { notFound } from "next/navigation";

import { getFileAssetByShareToken } from "@/lib/file-assets";
import { isPreviewableMimeType } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function SharedFilePage({ params }: PageProps) {
  const { token } = await params;
  const asset = await getFileAssetByShareToken(token);
  if (!asset) notFound();
  const canPreview = isPreviewableMimeType(asset.mimeType);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Archivo compartido</p>
        <h1 className="text-2xl font-semibold text-slate-950">{asset.title || asset.fileName}</h1>
        <p className="text-sm text-slate-600">{asset.fileName}</p>
      </div>
      {canPreview ? (
        <iframe src={`/api/files/share/${token}/signed-view`} title={asset.fileName} className="h-[78vh] w-full rounded-2xl border border-slate-200 bg-white" />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-700">Este archivo no puede previsualizarse directamente en el navegador.</p>
          <a href={`/api/files/share/${token}/signed-view`} className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white">
            Abrir archivo
          </a>
        </div>
      )}
    </main>
  );
}
