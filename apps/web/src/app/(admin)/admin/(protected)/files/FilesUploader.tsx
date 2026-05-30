"use client";

import { useRef, useState } from "react";

type FileAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  title: string | null;
  createdAt: string | Date;
};

type UploadState = "idle" | "presigning" | "uploading" | "saving" | "done" | "error";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FilesUploader({ initialAssets }: { initialAssets: FileAsset[] }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState(initialAssets);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function uploadSelectedFile() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setState("presigning");
    setMessage(null);
    setShareUrl(null);

    try {
      const presignResponse = await fetch("/api/files/presign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
      });
      const presign = await presignResponse.json();
      if (!presignResponse.ok || !presign.ok) throw new Error(presign.error || "No se pudo preparar la subida.");

      setState("uploading");
      const uploadResponse = await fetch(presign.uploadUrl, { method: "PUT", body: file });
      if (!uploadResponse.ok) throw new Error("Cloudflare R2 rechazó la subida.");

      setState("saving");
      const completeResponse = await fetch("/api/files/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ objectKey: presign.objectKey, fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
      });
      const complete = await completeResponse.json();
      if (!completeResponse.ok || !complete.ok) throw new Error(complete.error || "No se pudo guardar la metadata.");

      setAssets((current) => [complete.asset, ...current]);
      setState("done");
      setMessage("Archivo subido correctamente.");
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Error inesperado.");
    }
  }

  async function createShare(assetId: string) {
    setShareUrl(null);
    const response = await fetch(`/api/files/${assetId}/share`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setMessage(payload.error || "No se pudo crear el link.");
      return;
    }
    const absolute = new URL(payload.shareUrl, window.location.origin).toString();
    setShareUrl(absolute);
    await navigator.clipboard?.writeText(absolute).catch(() => undefined);
  }

  const busy = state === "presigning" || state === "uploading" || state === "saving";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-slate-950">Subir archivo</h2>
            <p className="text-sm text-slate-600">PDF e imágenes tienen preview directa. DOCX, XLSX y PPTX se comparten como apertura/descarga.</p>
            <input ref={inputRef} type="file" className="text-sm" accept="application/pdf,image/png,image/jpeg,image/webp,.docx,.xlsx,.pptx" />
          </div>
          <button type="button" onClick={uploadSelectedFile} disabled={busy} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? "Procesando..." : "Subir a R2"}
          </button>
        </div>
        {message ? <p className={`mt-3 text-sm ${state === "error" ? "text-red-700" : "text-emerald-700"}`}>{message}</p> : null}
        {shareUrl ? (
          <p className="mt-3 break-all rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Link copiado: {shareUrl}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-950">Archivos recientes</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {assets.length === 0 ? <p className="p-5 text-sm text-slate-600">Todavía no hay archivos registrados.</p> : null}
          {assets.map((asset) => (
            <div key={asset.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-slate-950">{asset.title || asset.fileName}</p>
                <p className="text-sm text-slate-600">{asset.mimeType} · {formatBytes(asset.sizeBytes)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`/preview/${asset.id}`} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
                  Preview
                </a>
                <button type="button" onClick={() => createShare(asset.id)} className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white">
                  Crear link
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
