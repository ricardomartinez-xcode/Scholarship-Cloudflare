"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { buildFileAssetLinks, type FileAssetRecord } from "@/lib/file-assets";

type PresignResponse =
  | {
      ok: true;
      asset: FileAssetRecord;
      uploadUrl: string;
      uploadHeaders?: Record<string, string>;
    }
  | { ok: false; error: string };

function formatBytes(value: number | null) {
  if (!value) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusMessage({ kind, children }: { kind: "success" | "error"; children: string }) {
  const className =
    kind === "success"
      ? "rounded-2xl border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-300"
      : "rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300";
  return <div className={className}>{children}</div>;
}

function FileRows({ files }: { files: FileAssetRecord[] }) {
  if (files.length === 0) {
    return (
      <tr>
        <td className="p-4 text-slate-400" colSpan={5}>
          Aún no hay archivos R2.
        </td>
      </tr>
    );
  }

  return files.map((file) => {
    const links = buildFileAssetLinks(file.id);
    return (
      <tr key={file.id} className="border-t border-white/10">
        <td className="p-3">
          <div className="font-semibold text-slate-100">{file.fileName}</div>
          <div className="mt-1 max-w-[420px] truncate text-xs text-slate-500">{file.r2Key}</div>
        </td>
        <td className="p-3 text-slate-300">{file.mimeType}</td>
        <td className="p-3 text-slate-300">{formatBytes(file.sizeBytes)}</td>
        <td className="p-3">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200">
            {file.status}
          </span>
        </td>
        <td className="p-3">
          <div className="flex justify-end gap-2">
            <a
              href={links.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
            >
              Preview
            </a>
            <a
              href={links.downloadUrl}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
            >
              Descargar
            </a>
          </div>
        </td>
      </tr>
    );
  });
}

export default function FilesClient({ files }: { files: FileAssetRecord[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.item(0);
    if (selectedFile) uploadSelectedFile(selectedFile);
  }

  function uploadSelectedFile(file: File) {
    setNotice("");
    setError("");

    startTransition(async () => {
      try {
        const presignRes = await fetch("/api/files/presigned-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        });
        const presign = (await presignRes.json()) as PresignResponse;
        if (!presign.ok) throw new Error(presign.error || "No fue posible preparar la carga.");

        const uploadRes = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: presign.uploadHeaders ?? { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) throw new Error(`R2 rechazó la carga (${uploadRes.status}).`);

        await fetch(`/api/files/${presign.asset.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ etag: uploadRes.headers.get("etag") }),
        });

        setNotice("Archivo cargado en R2.");
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar el archivo.");
      }
    });
  }

  return (
    <div className="grid gap-6">
      <div className="ui-card grid gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">R2</div>
            <h2 className="mt-1 text-lg font-semibold">Assets de programas</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Carga PDFs e imágenes. La relación con programas se configura en Programas UNIDEP.
            </p>
          </div>

          <label className="cursor-pointer rounded-full border border-blue-900/40 bg-blue-950/30 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-blue-950/40">
            {isPending ? "Cargando..." : "Subir archivo"}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              disabled={isPending}
              onChange={handleFileChange}
            />
          </label>
        </div>

        {notice ? <StatusMessage kind="success">{notice}</StatusMessage> : null}
        {error ? <StatusMessage kind="error">{error}</StatusMessage> : null}
      </div>

      <div className="ui-card overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm text-slate-300">{files.length} archivo(s)</div>
        <div className="ui-scrollbar overflow-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="bg-slate-950/80 text-slate-300">
              <tr>
                <th className="p-3 text-left font-semibold">Archivo</th>
                <th className="p-3 text-left font-semibold">Tipo</th>
                <th className="p-3 text-left font-semibold">Tamaño</th>
                <th className="p-3 text-left font-semibold">Estado</th>
                <th className="p-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <FileRows files={files} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
