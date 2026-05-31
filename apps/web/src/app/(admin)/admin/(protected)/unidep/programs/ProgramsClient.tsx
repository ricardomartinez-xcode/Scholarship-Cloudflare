"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import AdminDataTable from "@/components/admin/AdminDataTable";
import AdminDialogShell from "@/components/admin/AdminDialogShell";
import type { FileAssetRecord, PublicFileAssetPayload } from "@/lib/file-assets";
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
  r2Assets?: Record<string, PublicFileAssetPayload>;
};

const LINE_LABELS: Record<string, string> = {
  salud: "Salud",
  licenciatura: "Licenciatura",
  prepa: "Bachillerato",
  posgrado: "Posgrado",
};

const PAGE_SIZE = 15;
const STORAGE_KEY = "admin.unidep.programs.table";

function AssetBadge({
  label,
  r2Asset,
  existingUrl,
}: {
  label: string;
  r2Asset?: PublicFileAssetPayload | null;
  existingUrl?: string | null;
}) {
  if (r2Asset) {
    return (
      <a
        href={r2Asset.previewUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
        title={r2Asset.fileName}
      >
        {label}: R2
      </a>
    );
  }
  if (existingUrl) {
    return (
      <a
        href={existingUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
      >
        {label}: URL
      </a>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-500">
      {label}: —
    </span>
  );
}

function formatAssetOption(file: FileAssetRecord) {
  const size = file.sizeBytes
    ? file.sizeBytes < 1024 * 1024
      ? `${Math.round(file.sizeBytes / 1024)} KB`
      : `${(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : "sin tamaño";
  return `${file.fileName} · ${size}`;
}

export default function ProgramsClient({
  programs,
  fileAssets,
}: {
  programs: Program[];
  fileAssets: FileAssetRecord[];
}) {
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
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        tableExpanded ? "expanded" : "collapsed",
      );
    } catch {
      // ignore persisted UI errors
    }
  }, [tableExpanded]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs.filter((program) => {
      const matchLine = !lineFilter || program.businessLine === lineFilter;
      const searchable = [
        program.name,
        program.category,
        program.level,
        program.businessLine,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchLine && (!q || searchable.includes(q));
    });
  }, [programs, search, lineFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pdfAssets = useMemo(
    () => fileAssets.filter((asset) => asset.mimeType === "application/pdf"),
    [fileAssets],
  );
  const imageAssets = useMemo(
    () => fileAssets.filter((asset) => asset.mimeType.startsWith("image/")),
    [fileAssets],
  );

  function openEdit(program: Program) {
    setEditing(program);
    setError("");
    setSuccess("");
  }

  function handleDelete(program: Program) {
    if (
      !window.confirm(
        `¿Eliminar "${program.name}"? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }

    const fd = new FormData();
    fd.set("id", program.id);
    startDeleteTransition(async () => {
      const res = await deleteProgramAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Error al eliminar.");
        return;
      }
      router.refresh();
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
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
    <div className="grid gap-5">
      <section className="rounded-[26px] border border-[#c8d6e2] bg-white p-4 shadow-[0_16px_50px_rgb(16_32_42/0.06)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
              Programas
            </div>
            <h2 className="mt-1 text-xl font-black tracking-[-0.035em] text-[#102838]">
              Catálogo de PDFs y metadata
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#536a7c]">
              Administra campos operativos, línea de negocio y URLs de PDFs sin
              desbordar la pantalla. Las acciones frecuentes se compactan en
              iconos accesibles.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setTableExpanded((prev) => !prev)}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#c8d6e2] bg-white px-4 text-xs font-extrabold uppercase tracking-[0.16em] text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10"
          >
            {tableExpanded ? "Contraer tabla" : "Expandir tabla"}
          </button>
        </div>
      </section>

      <section className="rounded-[26px] border border-[#c8d6e2] bg-white p-4 shadow-[0_16px_50px_rgb(16_32_42/0.06)] sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="grid gap-2 text-sm font-bold text-[#163247]">
            Buscar programa
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="ui-control"
              placeholder="Nombre, categoría o nivel"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-[#163247]">
            Línea de negocio
            <select
              value={lineFilter}
              onChange={(event) => {
                setLineFilter(event.target.value);
                setPage(1);
              }}
              className="ui-control"
            >
              <option value="">Todas</option>
              <option value="salud">Salud</option>
              <option value="licenciatura">Licenciatura</option>
              <option value="prepa">Bachillerato</option>
              <option value="posgrado">Posgrado</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[#536a7c]">
          <div>{filtered.length} programa(s)</div>
          <div className="text-xs font-semibold text-[#536a7c]">
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
                  <th className="w-[220px] p-3 text-left font-semibold">Assets</th>
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
                      <div className="flex flex-wrap gap-2">
                        <AssetBadge
                          label="Plan"
                          r2Asset={prog.r2Assets?.study_plan_pdf}
                          existingUrl={prog.planPdfUrl}
                        />
                        <AssetBadge
                          label="Brochure"
                          r2Asset={prog.r2Assets?.brochure_pdf}
                          existingUrl={prog.brochurePdfUrl}
                        />
                        <AssetBadge label="Imagen" r2Asset={prog.r2Assets?.hero_image} />
                      </div>
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
                    <td className="p-4 text-slate-300" colSpan={6}>
                      Sin resultados.
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((program) => (
                    <tr key={program.id}>
                      <td>
                        <div className="font-extrabold text-[#102838]">
                          {program.name}
                        </div>
                      </td>
                      <td>
                        <span
                          className="block max-w-[220px] truncate text-[#536a7c]"
                          title={program.category ?? "—"}
                        >
                          {program.category ?? "—"}
                        </span>
                      </td>
                      <td>
                        <LineBadge line={program.businessLine} />
                      </td>
                      <td>{program.level ?? "—"}</td>
                      <td>
                        <PdfLink href={program.planPdfUrl} label="Abrir" />
                      </td>
                      <td>
                        <PdfLink href={program.brochurePdfUrl} label="Abrir" />
                      </td>
                      <td>
                        <AdminRowActions
                          actions={[
                            {
                              type: "edit",
                              label: `Editar ${program.name}`,
                              onClick: () => openEdit(program),
                              tone: "primary",
                            },
                            {
                              type: "delete",
                              label: `Eliminar ${program.name}`,
                              onClick: () => handleDelete(program),
                              tone: "danger",
                              disabled: isDeleting,
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                  {!pageRows.length ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="rounded-[18px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-6 text-sm text-[#536a7c]">
                          Sin resultados para los filtros seleccionados.
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </AdminDataTable>
          </div>
        ) : (
          <div className="mt-4 rounded-[22px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-5 text-sm text-[#536a7c]">
            La tabla está contraída. Usa el botón superior para volver a
            expandirla.
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#536a7c]">
          <div>
            Página {currentPage} de {totalPages} ({filtered.length} programas)
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage <= 1}
              className="rounded-full border border-[#c8d6e2] bg-white px-3 py-1.5 font-bold text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10 disabled:bg-[#e5ebef] disabled:text-[#647684]"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-full border border-[#c8d6e2] bg-white px-3 py-1.5 font-bold text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10 disabled:bg-[#e5ebef] disabled:text-[#647684]"
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
              <label className="grid gap-2 text-sm font-bold text-[#163247] sm:col-span-2">
                Nombre del programa
                <input
                  name="name"
                  defaultValue={editing.name}
                  className="ui-control"
                  placeholder="Nombre del programa"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-[#163247]">
                Categoría
                <input
                  name="category"
                  defaultValue={editing.category ?? ""}
                  className="ui-control"
                  placeholder="Ej. Salud, Ingeniería, Maestría"
                />
                <span className="text-xs font-semibold text-[#536a7c]">
                  Agrupador visible en Oferta y Planes.
                </span>
              </label>

              <label className="grid gap-2 text-sm font-bold text-[#163247]">
                Línea de negocio
                <select
                  name="businessLine"
                  defaultValue={editing.businessLine ?? ""}
                  className="ui-control"
                >
                  <option value="">Sin asignar</option>
                  <option value="salud">Salud</option>
                  <option value="licenciatura">Licenciatura</option>
                  <option value="prepa">Bachillerato</option>
                  <option value="posgrado">Posgrado</option>
                </select>
                <span className="text-xs font-semibold text-[#536a7c]">
                  Línea operativa usada para filtros y vistas públicas.
                </span>
              </label>

              <label className="grid gap-2 text-sm font-bold text-[#163247] sm:col-span-2">
                URL Plan PDF
                <input
                  name="planPdfUrl"
                  defaultValue={editing.planPdfUrl ?? ""}
                  className="ui-control"
                  placeholder="https://res.cloudinary.com/..."
                />
                <span className="text-xs text-slate-400">
                  URL existente. Si hay R2 asignado, R2 tiene prioridad.
                </span>
              </label>

              <label className="grid gap-2 text-sm font-bold text-[#163247] sm:col-span-2">
                URL Brochure PDF
                <input
                  name="brochurePdfUrl"
                  defaultValue={editing.brochurePdfUrl ?? ""}
                  className="ui-control"
                  placeholder="https://res.cloudinary.com/..."
                />
                <span className="text-xs text-slate-400">
                  URL existente. Si hay R2 asignado, R2 tiene prioridad.
                </span>
              </label>
            </div>

            <section className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">
                  Assets R2 del programa
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Selecciona archivos ya cargados en R2. Vacío limpia la relación, no borra el archivo.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2 text-sm">
                  Plan PDF
                  <select
                    name="r2StudyPlanFileId"
                    defaultValue={editing.r2Assets?.study_plan_pdf?.fileId ?? ""}
                    className="ui-control"
                  >
                    <option value="">Sin R2</option>
                    {pdfAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {formatAssetOption(asset)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  Brochure PDF
                  <select
                    name="r2BrochureFileId"
                    defaultValue={editing.r2Assets?.brochure_pdf?.fileId ?? ""}
                    className="ui-control"
                  >
                    <option value="">Sin R2</option>
                    {pdfAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {formatAssetOption(asset)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  Imagen principal
                  <select
                    name="r2HeroImageFileId"
                    defaultValue={editing.r2Assets?.hero_image?.fileId ?? ""}
                    className="ui-control"
                  >
                    <option value="">Sin R2</option>
                    {imageAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {formatAssetOption(asset)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            {error ? (
              <div className="rounded-[18px] border border-[#8a2d2d]/20 bg-[#fde7e7] px-4 py-2 text-sm font-semibold text-[#8a2d2d]">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-[18px] border border-[#0c5f3a]/20 bg-[#ddf8ea] px-4 py-2 text-sm font-semibold text-[#0c5f3a]">
                {success}
              </div>
            ) : null}

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[#c8d6e2] bg-white/95 pt-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full border border-[#c8d6e2] bg-white px-4 py-2 text-sm font-bold text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#0b3d56] disabled:border-[#c8d6e2] disabled:bg-[#e5ebef] disabled:text-[#647684]"
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
