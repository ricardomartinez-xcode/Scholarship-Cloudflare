"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent } from "react";

type CatalogKind = "organizations" | "campuses";
type ItemStatus = "queued" | "validating" | "ready" | "error";

type BatchItem = {
  id: string;
  file: File;
  status: ItemStatus;
  sessionId: string | null;
  error: string;
  processed: number;
  ready: number;
  errorCount: number;
};

const CATALOGS = {
  organizations: {
    label: "Organizaciones",
    description:
      "Crea o actualiza organizaciones y asigna al usuario importador como owner de las nuevas.",
    endpoint: "/api/admin/organizations/import",
    templateUrl: "/templates/import-organizations.csv",
  },
  campuses: {
    label: "Planteles / Campus",
    description:
      "Crea o actualiza planteles con validación de código, meta key, slug y estado.",
    endpoint: "/api/admin/campuses/import",
    templateUrl: "/templates/import-campuses.csv",
  },
} as const;

const MAX_FILES = 50;
const CONCURRENCY = 2;

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function statusLabel(status: ItemStatus) {
  if (status === "validating") return "Validando";
  if (status === "ready") return "Preview listo";
  if (status === "error") return "Error";
  return "En cola";
}

export default function BatchCatalogImportClient() {
  const [kind, setKind] = useState<CatalogKind>("organizations");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const config = CATALOGS[kind];

  const readyCount = items.filter((item) => item.status === "ready").length;
  const errorCount = items.filter((item) => item.status === "error").length;
  const queuedCount = items.filter((item) => item.status === "queued").length;
  const processedRows = useMemo(
    () => items.reduce((total, item) => total + item.processed, 0),
    [items],
  );
  const progress = items.length
    ? Math.round(((readyCount + errorCount) / items.length) * 100)
    : 0;

  function patchItem(id: string, patch: Partial<BatchItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addFiles(files: File[]) {
    if (running) return;

    const known = new Set(items.map((item) => fileKey(item.file)));
    const additions = files
      .filter((file) => file.name.toLowerCase().endsWith(".csv"))
      .filter((file) => !known.has(fileKey(file)))
      .slice(0, Math.max(0, MAX_FILES - items.length))
      .map((file, index) => ({
        id: `${fileKey(file)}:${Date.now()}:${index}`,
        file,
        status: "queued" as const,
        sessionId: null,
        error: "",
        processed: 0,
        ready: 0,
        errorCount: 0,
      }));

    setItems((current) => [...current, ...additions]);
    setNotice(
      additions.length === files.length
        ? ""
        : "Se omitieron duplicados, archivos no CSV o elementos que exceden el límite.",
    );
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  }

  async function validateItem(item: BatchItem) {
    patchItem(item.id, {
      status: "validating",
      sessionId: null,
      error: "",
      processed: 0,
      ready: 0,
      errorCount: 0,
    });

    try {
      const form = new FormData();
      form.set("file", item.file);
      const response = await fetch(config.endpoint, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            sessionId?: string;
            processed?: number;
            ready?: number;
            errors?: unknown[];
            error?: string;
            message?: string;
          }
        | null;

      if (!response.ok || !payload?.sessionId) {
        throw new Error(
          payload?.error ??
            payload?.message ??
            `No se pudo validar el archivo (${response.status}).`,
        );
      }

      patchItem(item.id, {
        status: "ready",
        sessionId: payload.sessionId,
        processed: payload.processed ?? 0,
        ready: payload.ready ?? 0,
        errorCount: Array.isArray(payload.errors) ? payload.errors.length : 0,
      });
    } catch (error) {
      patchItem(item.id, {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "No fue posible validar el archivo.",
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
        const index = cursor;
        cursor += 1;
        await validateItem(candidates[index]);
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(CONCURRENCY, candidates.length) },
        () => worker(),
      ),
    );

    setRunning(false);
    setNotice(
      "Validación terminada. Cada archivo conserva una sesión independiente y debe publicarse manualmente.",
    );
  }

  return (
    <section className="ui-card ui-card-pad grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Catálogos administrativos
          </div>
          <h2 className="mt-1 text-xl font-semibold">
            Organizaciones y planteles por lote
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            {config.description}
          </p>
        </div>
        <a
          href={config.templateUrl}
          download
          className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
        >
          Descargar plantilla CSV
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Catálogo
          <select
            value={kind}
            disabled={running}
            className="ui-control"
            onChange={(event) => {
              setKind(event.target.value as CatalogKind);
              setItems([]);
              setNotice("");
            }}
          >
            <option value="organizations">Organizaciones</option>
            <option value="campuses">Planteles / Campus</option>
          </select>
        </label>

        <label className="grid cursor-pointer place-items-center rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
          <span className="font-semibold text-slate-100">
            Seleccionar varios CSV
          </span>
          <span className="mt-1 text-xs text-slate-400">
            Máximo {MAX_FILES} archivos; se validan dos en paralelo.
          </span>
          <input
            type="file"
            multiple
            accept=".csv,text/csv"
            className="hidden"
            disabled={running}
            onChange={handleFiles}
          />
        </label>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-300">
          {items.length} archivo(s) · {processedRows} fila(s) · {readyCount} listos · {errorCount} con error · {queuedCount} pendientes
        </div>
        <div className="flex gap-2">
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

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-emerald-400 transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="ui-scrollbar overflow-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-950/80 text-left text-slate-300">
            <tr>
              <th className="p-3">Archivo</th>
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
                    <div className="font-semibold text-slate-100">
                      {item.file.name}
                    </div>
                    {item.error ? (
                      <div className="mt-1 text-xs text-red-300">
                        {item.error}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 text-slate-300">
                    {statusLabel(item.status)}
                  </td>
                  <td className="p-3 text-slate-300">
                    {item.status === "ready"
                      ? `${item.ready}/${item.processed} listas · ${item.errorCount} error(es)`
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
                        onClick={() =>
                          setItems((current) =>
                            current.filter((entry) => entry.id !== item.id),
                          )
                        }
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
                <td colSpan={4} className="p-8 text-center text-slate-400">
                  Aún no hay archivos en este lote.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
