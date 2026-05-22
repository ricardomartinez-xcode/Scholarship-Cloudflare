"use client";

import { useMemo, useState, useTransition } from "react";
import { updateCampusContactAction, importCampusesCsvAction } from "./actions";

type Campus = {
  id: string;
  code: string;
  metaKey: string;
  name: string;
  slug: string;
  tier: string | null;
  kind: "campus" | "online";
  isActive: boolean;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
};

export default function CampusesClient({ campuses }: { campuses: Campus[] }) {
  const [editing, setEditing] = useState<Campus | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [tableExpanded, setTableExpanded] = useState(true);

  // File import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<{
    processed?: number;
    updated?: number;
    notFound?: string[];
  } | null>(null);
  const [importPending, startImportTransition] = useTransition();

  const filteredCampuses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campuses;
    return campuses.filter((campus) =>
      [campus.name, campus.code, campus.metaKey, campus.address, campus.phone, campus.whatsapp]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [campuses, query]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError("");
    setSuccess("");
    startTransition(async () => {
      const res = await updateCampusContactAction(fd);
      if (res.ok) {
        setSuccess("Plantel actualizado.");
        setEditing(null);
      } else {
        setError(res.error ?? "Error desconocido.");
      }
    });
  }

  function handleFileImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setImportError("");
    setImportResult(null);

    if (!importFile) {
      setImportError("Debes seleccionar un archivo CSV o XLSX.");
      return;
    }

    const fd = new FormData();
    fd.set("file", importFile);
    startImportTransition(async () => {
      const res = await importCampusesCsvAction(fd);
      if (res.ok) {
        setImportResult({ processed: res.processed, updated: res.updated, notFound: res.notFound });
      } else {
        setImportError(res.error ?? "Error desconocido.");
      }
    });
  }

  return (
    <div className="grid gap-8">
      {/* CSV Import */}
    <div className="ui-card ui-card-pad">
        <h3 className="font-semibold">Importar planteles desde archivo CSV o XLSX</h3>
        <p className="mt-1 text-sm text-slate-300">
          El orden de columnas debe ser: <code className="rounded bg-black/30 px-1">Plantel</code>,{" "}
          <code className="rounded bg-black/30 px-1">Direccion</code>,{" "}
          <code className="rounded bg-black/30 px-1">Telefono</code>,{" "}
          <code className="rounded bg-black/30 px-1">Whatsapp</code>. La columna Plantel se puede identificar por code, metaKey, slug o name del campus.
        </p>
        <form onSubmit={handleFileImport} className="mt-4 grid gap-3">
          <div className="grid gap-2 text-sm">
            Archivo (.csv o .xlsx)
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="ui-control"
            />
          </div>
          {importError && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {importError}
            </div>
          )}
          {importResult && (
            <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 px-4 py-3 text-sm text-emerald-200">
              <div className="font-semibold">Importación completada</div>
              <div className="mt-1">Filas procesadas: {importResult.processed}</div>
              <div>Planteles actualizados: {importResult.updated}</div>
              {importResult.notFound && importResult.notFound.length > 0 && (
                <div className="mt-2">
                  <div className="text-yellow-300">No encontrados ({importResult.notFound.length}):</div>
                  <ul className="mt-1 list-inside list-disc text-xs text-yellow-200">
                    {importResult.notFound.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div>
            <button
              type="submit"
              disabled={importPending || !importFile}
              className="rounded-full border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-100 transition hover:bg-blue-950/30 disabled:opacity-50"
            >
              {importPending ? "Importando..." : "Importar / Actualizar planteles"}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="ui-card grid gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="grid gap-1 text-xs text-slate-400">
            Buscar plantel
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="ui-control w-full sm:min-w-[260px]"
              placeholder="Nombre, código, teléfono..."
            />
          </label>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-400">{filteredCampuses.length} planteles</div>
            <button
              type="button"
              onClick={() => setTableExpanded((prev) => !prev)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10"
            >
              {tableExpanded ? "Contraer tabla" : "Expandir tabla"}
            </button>
          </div>
        </div>

        {tableExpanded ? (
          <div className="ui-scrollbar max-h-[72vh] max-w-full overflow-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-950/95 text-slate-300 backdrop-blur">
                <tr>
                  <th className="p-3 text-left font-semibold">Nombre</th>
                  <th className="p-3 text-left font-semibold">Código</th>
                  <th className="p-3 text-left font-semibold">Tipo</th>
                  <th className="p-3 text-left font-semibold">Dirección</th>
                  <th className="p-3 text-left font-semibold">Teléfono</th>
                  <th className="p-3 text-left font-semibold">WhatsApp</th>
                  <th className="p-3 text-left font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampuses.map((c) => (
                  <tr key={c.id} className="border-t border-white/10">
                    <td className="p-3 text-slate-100">{c.name}</td>
                    <td className="p-3 text-slate-300 text-xs">{c.code}</td>
                    <td className="p-3 text-slate-300 text-xs">
                      {c.kind === "online" ? "Online" : "Presencial"}
                    </td>
                    <td className="max-w-[240px] p-3 text-slate-300 text-xs">
                      <span className="block truncate" title={c.address ?? "—"}>
                        {c.address ?? "—"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 text-xs">{c.phone ?? "—"}</td>
                    <td className="p-3 text-slate-300 text-xs">{c.whatsapp ?? "—"}</td>
                    <td className="p-3">
                      <button
                        onClick={() => {
                          setEditing(c);
                          setError("");
                          setSuccess("");
                        }}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredCampuses.length ? (
                  <tr>
                    <td className="p-4 text-slate-300" colSpan={7}>
                      Sin resultados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-sm text-slate-400">
            La tabla está contraída. Vuelve a abrirla cuando necesites editar planteles.
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="ui-card w-full max-w-lg p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Editar plantel</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-100">
                ✕
              </button>
            </div>
            <div className="mt-1 text-sm text-slate-300">
              {editing.name} <span className="text-xs text-slate-500">({editing.code})</span>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
              <input type="hidden" name="id" value={editing.id} />

              <div className="grid gap-2 text-sm">
                Dirección
                <input
                  name="address"
                  defaultValue={editing.address ?? ""}
                  className="ui-control"
                  placeholder="Calle, Colonia, Ciudad..."
                />
              </div>
              <div className="grid gap-2 text-sm">
                Teléfono
                <input
                  name="phone"
                  defaultValue={editing.phone ?? ""}
                  className="ui-control"
                  placeholder="+52 800 000 0000"
                />
              </div>
              <div className="grid gap-2 text-sm">
                WhatsApp
                <input
                  name="whatsapp"
                  defaultValue={editing.whatsapp ?? ""}
                  className="ui-control"
                  placeholder="5218001234567 (solo dígitos o con +52)"
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-300">
                  {success}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-full border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-100 transition hover:bg-blue-950/30 disabled:opacity-50"
                >
                  {isPending ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
