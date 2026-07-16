"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  DashboardIcon,
  type DashboardIconName,
} from "@/components/layout/DashboardIcons";
import {
  buildFileAssetLinks,
  type FileAssetRecord,
} from "@/lib/file-assets.shared";
import type { ContentBucketObject } from "@/lib/storage/content-bucket";
import { syncContentBucketFilesAction } from "./actions";

type PresignResponse =
  | {
      ok: true;
      asset: FileAssetRecord;
      uploadUrl: string;
      uploadHeaders?: Record<string, string>;
    }
  | { ok: false; error: string };

type UploadStatus =
  | "queued"
  | "uploading"
  | "retrying"
  | "complete"
  | "error";

type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  attempts: number;
  error: string;
};

type UploadOptions = {
  targetType: string;
  targetId: string;
  slot: string;
  sortOrder: number;
};

const MAX_CONCURRENT_UPLOADS = 4;
const MAX_ATTEMPTS = 3;

const targetTypeOptions = [
  { value: "", label: "Sin relación" },
  { value: "program", label: "Programa académico" },
  { value: "training_material", label: "Material de capacitación" },
  { value: "enrollment_format", label: "Formato de inscripción" },
  { value: "academic_offer", label: "Oferta por planteles" },
  { value: "admin_public_cta", label: "CTA / popup" },
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
  { value: "format_document", label: "Documento de formato" },
  { value: "cta_modal_image", label: "Imagen de CTA popup" },
];

const statusLabels: Record<UploadStatus, string> = {
  queued: "En cola",
  uploading: "Subiendo",
  retrying: "Reintentando",
  complete: "Completado",
  error: "Error",
};

function formatBytes(value: number | null) {
  if (!value) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function inferMimeType(file: File) {
  if (file.type) return file.type;

  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };

  return extension ? mimeTypes[extension] ?? "application/octet-stream" : "application/octet-stream";
}

function fileSignature(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function uploadWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (progress: number) => void,
) {
  return new Promise<string | null>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);

    for (const [name, value] of Object.entries(headers)) {
      if (value) request.setRequestHeader(name, value);
    }

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(95, Math.round((event.loaded / event.total) * 95)));
    };
    request.onerror = () => reject(new Error("No se pudo conectar con Storage."));
    request.onabort = () => reject(new Error("La carga fue cancelada."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(request.getResponseHeader("etag"));
        return;
      }
      reject(new Error(`Storage rechazó la carga (${request.status}).`));
    };

    request.send(file);
  });
}

function StatusMessage({
  kind,
  children,
}: {
  kind: "success" | "error";
  children: string;
}) {
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
          Aún no hay archivos en Storage.
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
            <FileActionLink href={links.previewUrl} label={`Preview ${file.fileName}`} icon="web" target="_blank" />
            <FileActionLink href={links.downloadUrl} label={`Descargar ${file.fileName}`} icon="inbox" />
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
          No se encontraron objetos en el bucket documents.
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
        {file.lastModified ? new Date(file.lastModified).toLocaleDateString("es-MX") : "—"}
      </td>
      <td className="p-3">
        <div className="flex justify-end gap-2">
          <FileActionLink href={file.previewUrl} label={`Preview ${file.fileName}`} icon="web" target="_blank" />
          <FileActionLink href={file.downloadUrl} label={`Descargar ${file.fileName}`} icon="inbox" />
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
  const [items, setItems] = useState<UploadItem[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [slot, setSlot] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const completedCount = items.filter((item) => item.status === "complete").length;
  const failedCount = items.filter((item) => item.status === "error").length;
  const overallProgress = items.length
    ? Math.round(items.reduce((total, item) => total + item.progress, 0) / items.length)
    : 0;

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addFiles(incoming: File[]) {
    if (!incoming.length || isUploading) return;

    setNotice("");
    setError("");
    setItems((current) => {
      const signatures = new Set(current.map((item) => fileSignature(item.file)));
      const additions = incoming
        .filter((file) => !signatures.has(fileSignature(file)))
        .map((file, index) => ({
          id: `${fileSignature(file)}:${Date.now()}:${index}`,
          file,
          status: "queued" as const,
          progress: 0,
          attempts: 0,
          error: "",
        }));
      return [...current, ...additions];
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  async function uploadItem(
    item: UploadItem,
    index: number,
    options: UploadOptions,
  ) {
    const mimeType = inferMimeType(item.file);
    let lastError = "No fue posible cargar el archivo.";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        updateItem(item.id, {
          status: attempt === 1 ? "uploading" : "retrying",
          attempts: attempt,
          progress: 0,
          error: "",
        });

        const presignResponse = await fetch("/api/files/presigned-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: item.file.name,
            mimeType,
            sizeBytes: item.file.size,
          }),
        });
        const presign = await readJson<PresignResponse>(presignResponse);
        if (!presignResponse.ok || !presign?.ok) {
          throw new Error(
            presign && !presign.ok ? presign.error : "No fue posible preparar la carga.",
          );
        }

        const etag = await uploadWithProgress(
          presign.uploadUrl,
          item.file,
          presign.uploadHeaders ?? { "Content-Type": mimeType },
          (progress) => updateItem(item.id, { progress }),
        );

        const completeResponse = await fetch(`/api/files/${presign.asset.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ etag }),
        });
        const complete = await readJson<{ ok?: boolean; error?: string }>(completeResponse);
        if (!completeResponse.ok || !complete?.ok) {
          throw new Error(complete?.error ?? "No fue posible confirmar la carga.");
        }

        if (options.targetType && options.slot) {
          const usageResponse = await fetch(`/api/files/${presign.asset.id}/usage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetType: options.targetType,
              targetId: options.targetId,
              slot: options.slot,
              sortOrder: options.sortOrder + index,
              isPrimary: index === 0,
            }),
          });
          const usage = await readJson<{ ok?: boolean; error?: string }>(usageResponse);
          if (!usageResponse.ok || !usage?.ok) {
            throw new Error(usage?.error ?? "El archivo subió, pero no se pudo relacionar.");
          }
        }

        updateItem(item.id, {
          status: "complete",
          progress: 100,
          attempts: attempt,
          error: "",
        });
        return;
      } catch (uploadError) {
        lastError =
          uploadError instanceof Error
            ? uploadError.message
            : "No fue posible cargar el archivo.";

        if (attempt < MAX_ATTEMPTS) {
          updateItem(item.id, {
            status: "retrying",
            error: lastError,
          });
          await new Promise((resolve) => window.setTimeout(resolve, 600 * attempt));
        }
      }
    }

    updateItem(item.id, {
      status: "error",
      error: lastError,
    });
  }

  async function startUploads(retryErrorsOnly = false) {
    const pendingItems = items.filter((item) =>
      retryErrorsOnly
        ? item.status === "error"
        : item.status === "queued" || item.status === "error",
    );
    if (!pendingItems.length || isUploading) return;

    setError("");
    setNotice("");
    setIsUploading(true);

    const options: UploadOptions = {
      targetType,
      targetId: targetId.trim(),
      slot,
      sortOrder: Number(sortOrder) || 0,
    };

    let cursor = 0;
    async function worker() {
      while (cursor < pendingItems.length) {
        const index = cursor;
        cursor += 1;
        await uploadItem(pendingItems[index], index, options);
      }
    }

    const workerCount = Math.min(MAX_CONCURRENT_UPLOADS, pendingItems.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    setIsUploading(false);
    setNotice("La carga masiva terminó. Revisa los archivos con error antes de limpiar la cola.");
    router.refresh();
  }

  function removeItem(id: string) {
    if (isUploading) return;
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function clearFinished() {
    if (isUploading) return;
    setItems((current) =>
      current.filter((item) => item.status !== "complete" && item.status !== "error"),
    );
  }

  return (
    <div className="grid gap-6">
      <div className="ui-card grid gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Storage</div>
            <h2 className="mt-1 text-lg font-semibold">Carga masiva de assets y materiales</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Selecciona o arrastra varios PDFs, imágenes, videos y documentos. Se procesan hasta cuatro archivos en paralelo y cada error se reintenta automáticamente.
            </p>
          </div>
          <label className="cursor-pointer rounded-full border border-blue-900/40 bg-blue-950/30 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-blue-950/40">
            Seleccionar archivos
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/pdf,image/*,video/mp4,video/webm,.doc,.docx,.xlsx,.pptx"
              className="hidden"
              disabled={isUploading}
              onChange={handleFileChange}
            />
          </label>
        </div>

        <div
          className={`rounded-2xl border border-dashed p-6 text-center text-sm transition ${
            isDragging ? "border-emerald-400 bg-emerald-500/10" : "border-white/15 bg-white/[0.02]"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!isUploading) setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          Arrastra aquí todos los archivos que quieras cargar. Máximo permitido por el backend: 20 MB por archivo, salvo que se configure otro límite.
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_120px]">
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Relacionar con
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value)}
              className="ui-control"
              disabled={isUploading}
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
              disabled={isUploading}
              placeholder="Programa, formato, plantel o recurso"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Uso / preview
            <select
              value={slot}
              onChange={(event) => setSlot(event.target.value)}
              className="ui-control"
              disabled={isUploading}
            >
              {slotOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Orden inicial
            <input
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="ui-control"
              inputMode="numeric"
              disabled={isUploading}
            />
          </label>
        </div>

        {items.length ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-300">
                {items.length} archivo(s) · {completedCount} completado(s) · {failedCount} con error
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-50"
                  disabled={isUploading || !failedCount}
                  onClick={() => void startUploads(true)}
                >
                  Reintentar errores
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-50"
                  disabled={isUploading}
                  onClick={clearFinished}
                >
                  Limpiar terminados
                </button>
                <button
                  type="button"
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
                  disabled={isUploading || !items.some((item) => item.status === "queued" || item.status === "error")}
                  onClick={() => void startUploads(false)}
                >
                  {isUploading ? "Cargando…" : "Subir cola"}
                </button>
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-emerald-400 transition-[width]"
                style={{ width: `${overallProgress}%` }}
              />
            </div>

            <div className="ui-scrollbar max-h-[420px] overflow-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-950 text-slate-300">
                  <tr>
                    <th className="p-3 text-left">Archivo</th>
                    <th className="p-3 text-left">Tamaño</th>
                    <th className="p-3 text-left">Estado</th>
                    <th className="p-3 text-left">Progreso</th>
                    <th className="p-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-white/10">
                      <td className="p-3">
                        <div className="font-semibold text-slate-100">{item.file.name}</div>
                        {item.error ? <div className="mt-1 text-xs text-red-300">{item.error}</div> : null}
                      </td>
                      <td className="p-3 text-slate-300">{formatBytes(item.file.size)}</td>
                      <td className="p-3 text-slate-300">
                        {statusLabels[item.status]}
                        {item.attempts > 1 ? ` (${item.attempts}/${MAX_ATTEMPTS})` : ""}
                      </td>
                      <td className="p-3 text-slate-300">{item.progress}%</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          className="text-xs font-semibold text-slate-300 disabled:opacity-40"
                          disabled={isUploading}
                          onClick={() => removeItem(item.id)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {notice ? <StatusMessage kind="success">{notice}</StatusMessage> : null}
        {error ? <StatusMessage kind="error">{error}</StatusMessage> : null}
        {statusMessage ? <StatusMessage kind="success">{statusMessage}</StatusMessage> : null}
        {errorMessage ? <StatusMessage kind="error">{errorMessage}</StatusMessage> : null}
      </div>

      <div className="ui-card grid gap-3 p-4 sm:p-5">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Siguiente paso</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">Usar Storage dentro de importaciones</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Storage conserva los archivos; el centro de importación procesa Excel y CSV. Los documentos generales, planes, formatos e imágenes se guardan en el bucket documents.
          </p>
        </div>
        <div>
          <Link
            href="/admin/importaciones"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-blue-900/40 bg-blue-950/30 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-blue-950/40"
          >
            Ir al centro de importación
          </Link>
        </div>
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
            <div className="text-sm font-semibold text-slate-100">Bucket documents</div>
            <div className="mt-1 text-xs text-slate-400">
              Lectura directa desde Supabase Storage para validar objetos antes de relacionarlos.
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
