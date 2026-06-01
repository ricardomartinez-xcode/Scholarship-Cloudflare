"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { DashboardIcon, type DashboardIconName } from "@/components/layout/DashboardIcons";
import { buildFileAssetLinks, type FileAssetRecord } from "@/lib/file-assets";
import type { ContentBucketObject } from "@/lib/r2-content-bucket";
import { syncContentBucketFilesAction } from "./actions";

type PresignResponse =
  | {
      ok: true;
      asset: FileAssetRecord;
      uploadUrl: string;
      uploadHeaders?: Record<string, string>;
    }
  | { ok: false; error: string };

const targetTypeOptions = [
  { value: "", label: "Sin relación" },
  { value: "program", label: "Programa académico" },
  { value: "training_material", label: "Material de capacitación" },
  { value: "academic_offer", label: "Oferta por plantel" },
  { value: "campus", label: "Plantel / campus" },
  { value: "global", label: "Global" },
];

const slotOptions = [
  { value: "", label: "Sin uso específico" },
  { value: "study_plan_pdf", label: "Plan de estudios PDF" },
  { value: "brochure_pdf", label: "Brochure / oferta PDF" },
  { value: "hero_image", label: "Imagen principal" },
  { value: "thumbnail_image", label: "Miniatura" },
  { value: "training_material", label: "Material capacitación" },
  { value: "training_video", label: "Video capacitación" },
  { value: "training_pdf", label: "PDF capacitación" },
  { value: "training_image", label: "Imagen capacitación" },
  { value: "training_file", label: "Archivo capacitación" },
];

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

function FileActionLink({
  href,
  label,
  icon,
  target,
}: {
  href: string;
  label: string;
  icon: DashboardIconName;
  target?: "_blank";
}) {
  return (
    <a
      href={href}
      target={target}
      rel={target === "_blank" ? "noreferrer" : undefined}
      className="ui-icon-action"
      aria-label={label}
      title={label}
    >
      <DashboardIcon name={icon} className="ui-icon-action__icon" />
      <span className="ui-icon-action__label">{label}</span>
    </a>
  );
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
            <FileActionLink
              href={links.previewUrl}
              label={`Preview ${file.fileName}`}
              icon="web"
              target="_blank"
            />
            <FileActionLink
              href={links.downloadUrl}
              label={`Descargar ${file.fileName}`}
              icon="inbox"
            />
          </div>
        </td>
      </tr>
    );
  });
}

function ContentBucketRows({ files }: { files: ContentBucketObject[] }) {
  if (!files.length) {
    return (
      <tr>
        <td className="p-4 text-slate-400" colSpan={5}>
          No se pudieron listar archivos del bucket content.
        </td>
      </tr>
    );
  }

  return files.map((file) => (
    <tr key={file.key} className="border-t border-white/10">
      <td className="p-3">
        <div className="font-semibold text-slate-100">{file.fileName}</div>
        <div className="mt-1 max-w-[420px] truncate text-xs text-slate-500">{file.key}</div>
      </td>
      <td className="p-3 text-slate-300">{file.mimeType}</td>
      <td className="p-3 text-slate-300">{formatBytes(file.sizeBytes)}</td>
      <td className="p-3 text-slate-300">
        {file.lastModified
          ? new Date(file.lastModified).toLocaleDateString("es-MX")
          : "—"}
      </td>
      <td className="p-3">
        <div className="flex justify-end gap-2">
          <FileActionLink
            href={file.previewUrl}
            label={`Preview ${file.fileName}`}
            icon="web"
            target="_blank"
          />
          <FileActionLink
            href={file.downloadUrl}
            label={`Descargar ${file.fileName}`}
            icon="inbox"
          />
        </div>
      </td>
    </tr>
  ));
}

export default function FilesClient({
  files,
  contentBucketFiles,
  statusMessage,
  errorMessage,
}: {
  files: FileAssetRecord[];
  contentBucketFiles: ContentBucketObject[];
  statusMessage?: string;
  errorMessage?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [slot, setSlot] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
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

        const completeRes = await fetch(`/api/files/${presign.asset.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ etag: uploadRes.headers.get("etag") }),
        });
        const complete = (await completeRes.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null;
        if (!completeRes.ok || !complete?.ok) {
          throw new Error(complete?.error || "No fue posible confirmar la carga.");
        }

        const hasUsage = Boolean(targetType && slot);
        if (hasUsage) {
          const usageRes = await fetch(`/api/files/${presign.asset.id}/usage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetType,
              targetId: targetId.trim(),
              slot,
              sortOrder: Number(sortOrder) || 0,
              isPrimary: true,
            }),
          });
          const usage = (await usageRes.json().catch(() => null)) as
            | { ok?: boolean; error?: string }
            | null;
          if (!usageRes.ok || !usage?.ok) {
            throw new Error(usage?.error || "El archivo subió, pero no se pudo relacionar.");
          }
        }

        setNotice(hasUsage ? "Archivo cargado y relacionado en R2." : "Archivo cargado en R2.");
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
            <h2 className="mt-1 text-lg font-semibold">Assets y materiales</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Carga PDFs, imágenes, videos y documentos. Puedes dejarlos libres o relacionarlos con programas y materiales.
            </p>
          </div>

          <label className="cursor-pointer rounded-full border border-blue-900/40 bg-blue-950/30 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-blue-950/40">
            {isPending ? "Cargando..." : "Subir archivo"}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*,video/mp4,video/webm,.docx,.xlsx,.pptx"
              className="hidden"
              disabled={isPending}
              onChange={handleFileChange}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_120px]">
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Relacionar con
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value)}
              className="ui-control"
            >
              {targetTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            ID o slug
            <input
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="ui-control"
              placeholder={
                targetType === "training_material"
                  ? "Opcional: se usa el ID del archivo"
                  : "Ej. ID del programa o plantel"
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Uso / preview
            <select
              value={slot}
              onChange={(event) => setSlot(event.target.value)}
              className="ui-control"
            >
              {slotOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Orden
            <input
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="ui-control"
              inputMode="numeric"
              placeholder="0"
            />
          </label>
        </div>
        <p className="text-xs leading-5 text-slate-400">
          Para materiales de capacitación basta elegir “Material de capacitación” y un uso; el ID puede quedar vacío.
          Para planes por licenciatura, la asignación recomendada sigue en Programas UNIDEP.
        </p>

        {notice ? <StatusMessage kind="success">{notice}</StatusMessage> : null}
        {error ? <StatusMessage kind="error">{error}</StatusMessage> : null}
        {statusMessage ? <StatusMessage kind="success">{statusMessage}</StatusMessage> : null}
        {errorMessage ? <StatusMessage kind="error">{errorMessage}</StatusMessage> : null}
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

      <div className="ui-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Bucket content: planes-de-estudio</div>
            <div className="mt-1 text-xs text-slate-400">
              Lectura directa desde R2 público/Data Catalog para validar archivos antes de relacionarlos.
            </div>
          </div>
          <form action={syncContentBucketFilesAction}>
            <button
              type="submit"
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
            >
              Sincronizar a assets
            </button>
          </form>
        </div>
        <div className="ui-scrollbar overflow-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="bg-slate-950/80 text-slate-300">
              <tr>
                <th className="p-3 text-left font-semibold">Archivo</th>
                <th className="p-3 text-left font-semibold">Tipo</th>
                <th className="p-3 text-left font-semibold">Tamaño</th>
                <th className="p-3 text-left font-semibold">Modificado</th>
                <th className="p-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <ContentBucketRows files={contentBucketFiles} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
