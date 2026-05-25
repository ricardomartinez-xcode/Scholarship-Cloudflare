"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import AdminDialogShell from "@/components/admin/AdminDialogShell";
import { deleteProgramAction, updateProgramUnidepAction } from "./actions";

type BusinessLine = "salud" | "licenciatura" | "prepa" | "posgrado";

type Program = {
  id: string;
  name: string;
  category: string | null;
  level: string | null;
  businessLine: BusinessLine | null;
  planPdfUrl: string | null;
  brochurePdfUrl: string | null;
};

const LINE_LABELS: Record<string, string> = {
  salud: "Salud",
  licenciatura: "Licenciatura",
  prepa: "Preparatoria",
  posgrado: "Posgrado",
};

const PAGE_SIZE = 15;
const STORAGE_KEY = "admin.unidep.programs.table";

export default function ProgramsClient({ programs }: { programs: Program[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Program | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [tableExpanded, setTableExpanded] = useState(true);

  useEffect(() => {
    let timer: number | undefined;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "collapsed") {
        timer = window.setTimeout(() => setTableExpanded(false), 0);
      }
    } catch {
      // ignore persisted UI errors
    }
    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, tableExpanded ? "expanded" : "collapsed");
    } catch {
      // ignore persisted UI errors
    }
  }, [tableExpanded]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs.filter((p) => {
      const matchLine = !lineFilter || p.businessLine === lineFilter;
      const searchable = [p.name, p.category, p.level, p.businessLine]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchLine && (!q || searchable.includes(q));
    });
  }, [programs, search, lineFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function openEdit(prog: Program) {
    setEditing(prog);
    setError("");
    setSuccess("");
  }

  function handleDelete(prog: Program) {
    if (!window.confirm(`¿Eliminar "${prog.name}"? Esta acción no se puede deshacer.`)) return;
    const fd = new FormData();
    fd.set("id", prog.id);
    startDeleteTransition(async () => {
      const res = await deleteProgramAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Error al eliminar.");
        return;
      }
      router.refresh();
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError("");
    setSuccess("");
    startTransition(async () => {
      const res = await updateProgramUnidepAction(fd);
      if (res.ok) {
        setSuccess("Programa actualizado.");
        setEditing(null);
        router.refresh();
      } else {
        setError(res.error ?? "Error desconocido.");
      }
    });
  }

  return (
    <div className="grid gap-6">
      <section className="ui-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Programas
            </div>
            <h2 className="mt-1 text-lg font-semibold">Catálogo de PDFs y metadata</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">
              Aquí conviven campos de catálogo y operación.{" "}
              <span className="font-semibold text-slate-100">Categoría</span> funciona como
              agrupador descriptivo;{" "}
              <span className="font-semibold text-slate-100">Línea</span> define la línea de
              negocio operativa; los PDFs se usan por separado en Oferta y Planes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setTableExpanded((prev) => !prev)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10"
          >
            {tableExpanded ? "Contraer tabla" : "Expandir tabla"}
          </button>
        </div>
      </section>

      <section className="ui-card grid gap-4 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="grid gap-2 text-sm">
            Buscar programa
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="ui-control"
              placeholder="Nombre, categoría o nivel"
            />
          </div>
          <div className="grid gap-2 text-sm">
            Línea de negocio
            <select
              value={lineFilter}
              onChange={(e) => {
                setLineFilter(e.target.value);
                setPage(1);
              }}
              className="ui-control"
            >
              <option value="">Todas</option>
              <option value="salud">Salud</option>
              <option value="licenciatura">Licenciatura</option>
              <option value="prepa">Preparatoria</option>
              <option value="posgrado">Posgrado</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-300">
          <div>{filtered.length} programa(s)</div>
          <div className="text-xs text-slate-400">
            PDFs de plan y brochure se administran por separado.
          </div>
        </div>

        {tableExpanded ? (
          <div className="ui-scrollbar max-h-[72vh] max-w-full overflow-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[1080px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-950/95 text-slate-300 backdrop-blur">
                <tr>
                  <th className="w-[260px] p-3 text-left font-semibold">Programa</th>
                  <th className="w-[180px] p-3 text-left font-semibold">Categoría</th>
                  <th className="w-[160px] p-3 text-left font-semibold">Línea</th>
                  <th className="w-[140px] p-3 text-left font-semibold">Nivel interno</th>
                  <th className="w-[120px] p-3 text-left font-semibold">Plan PDF</th>
                  <th className="w-[120px] p-3 text-left font-semibold">Brochure PDF</th>
                  <th className="w-[160px] p-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((prog) => (
                  <tr key={prog.id} className="border-t border-white/10 align-top">
                    <td className="p-3 text-slate-100">
                      <div className="font-semibold">{prog.name}</div>
                    </td>
                    <td className="p-3 text-slate-300">
                      <span className="block max-w-[180px] truncate" title={prog.category ?? "—"}>
                        {prog.category ?? "—"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">
                      {prog.businessLine ? (
                        <span className="rounded-full bg-blue-950/20 px-2 py-0.5 text-xs text-emerald-300">
                          {LINE_LABELS[prog.businessLine]}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400">{prog.level ?? "—"}</td>
                    <td className="p-3">
                      {prog.planPdfUrl ? (
                        <a
                          href={prog.planPdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-300 underline"
                        >
                          Ver PDF
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {prog.brochurePdfUrl ? (
                        <a
                          href={prog.brochurePdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-300 underline"
                        >
                          Ver PDF
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(prog)}
                          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(prog)}
                          disabled={isDeleting}
                          className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!pageRows.length ? (
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
            La tabla está contraída. Usa el botón superior para volver a expandirla.
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400">
          <div>
            Página {currentPage} de {totalPages} ({filtered.length} programas)
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      <AdminDialogShell
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title="Editar programa"
        description="Aclara la categoría de catálogo y administra por separado los PDFs de plan y brochure."
        kicker="Programas"
        size="lg"
      >
        {editing ? (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <input type="hidden" name="id" value={editing.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 text-sm sm:col-span-2">
                Nombre del programa
                <input
                  name="name"
                  defaultValue={editing.name}
                  className="ui-control"
                  placeholder="Nombre del programa"
                />
              </div>

              <div className="grid gap-2 text-sm">
                Categoría
                <input
                  name="category"
                  defaultValue={editing.category ?? ""}
                  className="ui-control"
                  placeholder="Ej. Salud, Ingeniería, Maestría"
                />
                <span className="text-xs text-slate-400">
                  Agrupador visible en Oferta y Planes.
                </span>
              </div>

              <div className="grid gap-2 text-sm">
                Línea de negocio
                <select
                  name="businessLine"
                  defaultValue={editing.businessLine ?? ""}
                  className="ui-control"
                >
                  <option value="">Sin asignar</option>
                  <option value="salud">Salud</option>
                  <option value="licenciatura">Licenciatura</option>
                  <option value="prepa">Preparatoria</option>
                  <option value="posgrado">Posgrado</option>
                </select>
                <span className="text-xs text-slate-400">
                  Línea operativa usada para filtros y vistas públicas.
                </span>
              </div>

              <div className="grid gap-2 text-sm sm:col-span-2">
                URL Plan PDF
                <input
                  name="planPdfUrl"
                  defaultValue={editing.planPdfUrl ?? ""}
                  className="ui-control"
                  placeholder="https://res.cloudinary.com/..."
                />
                <span className="text-xs text-slate-400">
                  Se usa en la sección pública de Planes.
                </span>
              </div>

              <div className="grid gap-2 text-sm sm:col-span-2">
                URL Brochure PDF
                <input
                  name="brochurePdfUrl"
                  defaultValue={editing.brochurePdfUrl ?? ""}
                  className="ui-control"
                  placeholder="https://res.cloudinary.com/..."
                />
                <span className="text-xs text-slate-400">
                  Se usa en la sección pública de Oferta académica.
                </span>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-300">
                {success}
              </div>
            ) : null}

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-white/10 bg-slate-950/95 pt-4">
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
        ) : null}
      </AdminDialogShell>
    </div>
  );
}
