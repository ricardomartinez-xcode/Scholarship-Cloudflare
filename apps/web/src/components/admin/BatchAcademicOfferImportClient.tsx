"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent, type DragEvent } from "react";

type Cycle = "C1" | "C2" | "C3";
type ItemStatus = "queued" | "validating" | "ready" | "error";

type BatchItem = {
  id: string;
  file: File;
  status: ItemStatus;
  sessionId: string | null;
  error: string;
  campusesProcessed: number;
  warningCount: number;
};

type ImportPayload = {
  sessionId?: string;
  campusesProcessed?: number;
  warnings?: unknown[];
  error?: string;
};

const MAX_FILES = 50;
const CONCURRENCY = 2;

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: ItemStatus) {
  switch (status) {
    case "validating":
      return "Validando";
    case "ready":
      return "Preview listo";
    case "error":
      return "Error";
    default:
      return "En cola";
  }
}

export default function BatchAcademicOfferImportClient() {
  const [cycle, setCycle] = useState<Cycle>("C1");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");

  const readyCount = items.filter((item) => item.status === "ready").length;
  const errorCount = items.filter((item) => item.status === "error").length;
  const queuedCount = items.filter((item) => item.status === "queued").length;
  const processedCount = readyCount + errorCount;
  const progress = items.length ? Math.round((processedCount / items.length) * 100) : 0;
  const totalBytes = useMemo(
    () => items.reduce((total, item) => total + item.file.size, 0),
    [items],
  );

  function updateItem(id: string, patch: Partial<BatchItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addFiles(files: File[]) {
    if (running) return;

    const compatible = files.filter((file) => {
      const name = file.name.toLowerCase();
      return name.endsWith(".xlsx") || name.endsWith(".csv");
    });

    const existingKeys = new Set(items.map((item) => fileKey(item.file)));
    const capacity = Math.max(0, MAX_FILES - items.length);
    const additions = compatible
      .filter((file) => !existingKeys.has(fileKey(file)))
      .slice(0, capacity)
      .map((file, index) => ({
        id: `${fileKey(file)}:${Date.now()}:${index}`,
        file,
        status: "queued" as const,
        sessionId: null,
        error: "",
        campusesProcessed: 0,
        warningCount: 0,
      }));

    setItems((current) => [...current, ...additions]);
    setNotice(
      additions.length === compatible.length
        ? ""
        : `Se omitieron duplicados, archivos incompatibles o elementos que exceden el límite de ${MAX_FILES}.`,
    );
  }

  function handleSelection(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  async function validateItem(item: BatchItem) {
    updateItem(item.id, {
      status: "validating",
      sessionId: null,
      error: "",
      campusesProcessed: 0,
      warningCount: 0,
    });

    try {
      const form = new FormData();
      form.set("file", item.file);
      form.set("cycle", cycle);

      const response = await fetch("/api/admin/import-academic-offer", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as ImportPayload | null;

      if (!response.ok || !payload?.sessionId) {
        throw new Error(payload?.error ?? `No se pudo validar el archivo (${response.status}).`);
      }

      updateItem(item.id, {
        status: "ready",
        sessionId: payload.sessionId,
        campusesProcessed: payload.campusesProcessed ?? 0,
        warningCount: Array.isArray(payload.warnings) ? payload.warnings.length : 0,
      });
    } catch (error) {
      updateItem(item.id, {
        status: "error",
        error: error instanceof Error ? error.message : "No se pudo validar el archivo.",
      });
    }
  }

  async function runBatch(errorsOnly = false) {
    if (running) return;

    const candidates = items.filter((item) =>
      errorsOnly
        ? item.status === "error"
        : item.status === "queued" || item.status === "error",
    );
    if (!candidates.length) return;

    setRunning(true);
    setNotice("");
    let cursor = 0;

    async function worker() {
      while (cursor < candidates.length) {
        const currentIndex = cursor;
        cursor += 1;
        await validateItem(candidates[currentIndex]);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, () => worker()),
    );

    setRunning(false);
    setNotice(
      "Validación terminada. Cada archivo conserva una sesión independiente y ningún cambio se publica automáticamente.",
    );
  }

  function removeItem(id: string) {
    if (!running) setItems((current) => current.filter((item) => item.id !== id));
  }

  function clearFinished() {
    if (!running) {
      setItems((current) =>
        current.filter((item) => item.status !== "ready" && item.status !== "error"),
      );
    }
  }

  return (
    <div className="grid gap-6">
      <section className="ui-card ui-card-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Oferta académica
            </div>
            <h1 className="mt-1 text-xl font-semibold">Importación masiva con preview</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Valida hasta {MAX_FILES} archivos XLSX o CSV. ReCalc procesa dos en paralelo y crea una sesión auditable por documento.
            </p>
          </div>
          <Link
            href="/admin/importaciones"
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            Volver al centro
          </Link>
        </div>
      </section>

      <section className="ui-card ui-card-pad grid gap-4">
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Ciclo para el lote
            <select
              value={cycle}
              onChange={(event) => setCycle(event.target.value as Cycle)}
              disabled={running}
              className="ui-control"
            >
              <option value="C1">C1</option>
              <option value="C2">C2</option>
              <option value="C3">C3</option>
            </select>
          </label>

          <div
            className={`grid min-h-32 place-items-center rounded-3xl border border-dashed p-6 text-center transition ${
              dragging ? "border-emerald-400 bg-emerald-500/10" : "border-white/15 bg-white/[0.02]"
            }`}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!running) setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div>
              <div className="font-semibold text-slate-100">Arrastra varios XLSX o CSV</div>
              <label className="mt-3 inline-flex cursor-pointer rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100">
                Seleccionar archivos
                <input
                  type="file"
                  multiple
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  disabled={running}
                  onChange={handleSelection}
                />
              </label>
            </div>
          </div>
        </div>

        {notice ? (
          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            {notice}
          </div>
        ) : null}
      </section>

      <section className="ui-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div className="text-sm text-slate-300">
            {items.length} archivo(s) · {formatBytes(totalBytes)} · {readyCount} listos · {errorCount} con error · {queuedCount} pendientes
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={running || !items.length}
              onClick={clearFinished}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-40"
            >
              Limpiar terminados
            </button>
            <button
              type="button"
              disabled={running || !errorCount}
              onClick={() => void runBatch(true)}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-40"
            >
              Reintentar errores
            </button>
            <button
              type="button"
              disabled={running || (!queuedCount && !errorCount)}
              onClick={() => void runBatch(false)}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-40"
            >
              {running ? "Validando…" : "Validar lote"}
            </button>
          </div>
        </div>

        <div className="h-2 bg-white/10">
          <div
            className="h-full bg-emerald-400 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="ui-scrollbar overflow-auto">
          <table className="w-full min-w-[840px] border-collapse text-sm">
            <thead className="bg-slate-950/80 text-left text-slate-300">
              <tr>
                <th className="p-3">Archivo</th>
                <th className="p-3">Tamaño</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Resultado</th>
                <th className="p-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="p-3">
                      <div className="font-semibold text-slate-100">{item.file.name}</div>
                      {item.error ? <div className="mt-1 text-xs text-red-300">{item.error}</div> : null}
                    </td>
                    <td className="p-3 text-slate-300">{formatBytes(item.file.size)}</td>
                    <td className="p-3 text-slate-300">{statusLabel(item.status)}</td>
                    <td className="p-3 text-slate-300">
                      {item.status === "ready"
                        ? `${item.campusesProcessed} campus · ${item.warningCount} advertencia(s)`
                        : "—"}
                    </td>
                    <td className="p-3 text-right">
                      {item.sessionId ? (
                        <Link
                          href={`/admin/importaciones/${item.sessionId}`}
                          className="font-semibold text-cyan-200 underline underline-offset-4"
                        >
                          Revisar preview
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={running}
                          onClick={() => removeItem(item.id)}
                          className="text-xs font-semibold text-slate-300 disabled:opacity-40"
                        >
                          Quitar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Aún no hay archivos en el lote.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
