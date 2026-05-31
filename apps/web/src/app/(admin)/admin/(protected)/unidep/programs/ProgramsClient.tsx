"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
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
  r2Assets?: Record<string, PublicFileAssetPayload | null>;
};

const LINE_LABELS: Record<BusinessLine, string> = {
  salud: "Salud",
  licenciatura: "Licenciatura",
  prepa: "Bachillerato",
  posgrado: "Posgrado",
};

const PAGE_SIZE = 15;
const STORAGE_KEY = "admin.unidep.programs.table";

function formatAssetOption(file: FileAssetRecord) {
  const size = file.sizeBytes
    ? file.sizeBytes < 1024 * 1024
      ? `${Math.round(file.sizeBytes / 1024)} KB`
      : `${(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : "sin tamaño";
  return `${file.fileName} · ${size}`;
}

function AssetBadge({ label, r2Asset, existingUrl }: { label: string; r2Asset?: PublicFileAssetPayload | null; existingUrl?: string | null }) {
  if (r2Asset) {
    return (
      <a href={r2Asset.previewUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20" title={r2Asset.fileName}>
        {label}: R2
      </a>
    );
  }
  if (existingUrl) {
    return (
      <a href={existingUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20">
        {label}: URL
      </a>
    );
  }
  return <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-500">{label}: —</span>;
}

function LineBadge({ line }: { line: BusinessLine | null }) {
  if (!line) return <span className="text-xs text-slate-500">—</span>;
  return <span className="rounded-full bg-blue-950/20 px-2 py-0.5 text-xs text-emerald-300">{LINE_LABELS[line]}</span>;
}

function AssetSelect({ label, name, assets, defaultValue }: { label: string; name: string; assets: FileAssetRecord[]; defaultValue?: string }) {
  return (
    <label className="grid gap-2 text-sm">
      {label}
      <select name={name} defaultValue={defaultValue ?? ""} className="ui-control">
        <option value="">Sin R2</option>
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>{formatAssetOption(asset)}</option>
        ))}
      </select>
    </label>
  );
}

export default function ProgramsClient({ programs, fileAssets }: { programs: Program[]; fileAssets: FileAssetRecord[] }) {
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
    try {
      setTableExpanded(window.localStorage.getItem(STORAGE_KEY) !== "collapsed");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, tableExpanded ? "expanded" : "collapsed");
    } catch {}
  }, [tableExpanded]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs.filter((program) => {
      const matchLine = !lineFilter || program.businessLine === lineFilter;
      const searchable = [program.name, program.category, program.level, program.businessLine].filter(Boolean).join(" ").toLowerCase();
      return matchLine && (!q || searchable.includes(q));
    });
  }, [programs, search, lineFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pdfAssets = useMemo(() => fileAssets.filter((asset) => asset.mimeType === "application/pdf"), [fileAssets]);
  const imageAssets = useMemo(() => fileAssets.filter((asset) => asset.mimeType.startsWith("image/")), [fileAssets]);

  function openEdit(program: Program) {
    setEditing(program);
    setError("");
    setSuccess("");
  }

  function handleDelete(program: Program) {
    if (!window.confirm(`¿Eliminar "${program.name}"? Esta acción no se puede deshacer.`)) return;
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
        return;
      }
      setError(res.error ?? "Error desconocido.");
    });
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-[26px] border border-[#c8d6e2] bg-white p-4 shadow-[0_16px_50px_rgb(16_32_42/0.06)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">Programas</div>
            <h2 className="mt-1 text-xl font-black tracking-[-0.035em] text-[#102838]">Catálogo de PDFs y metadata</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#536a7c]">Administra campos operativos, línea de negocio y archivos R2 por programa.</p>
          </div>
          <button type="button" onClick={() => setTableExpanded((prev) => !prev)} className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#c8d6e2] bg-white px-4 text-xs font-extrabold uppercase tracking-[0.16em] text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10">
            {tableExpanded ? "Contraer tabla" : "Expandir tabla"}
          </button>
        </div>
      </div>

      <div className="rounded-[26px] border border-[#c8d6e2] bg-white p-4 shadow-[0_16px_50px_rgb(16_32_42/0.06)] sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="grid gap-2 text-sm font-bold text-[#163247]">
            Buscar programa
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="ui-control" placeholder="Nombre, categoría o nivel" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#163247]">
            Línea de negocio
            <select value={lineFilter} onChange={(event) => { setLineFilter(event.target.value); setPage(1); }} className="ui-control">
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
          <div className="text-xs font-semibold">PDFs de plan y brochure se administran por separado.</div>
        </div>

        {tableExpanded ? (
          <div className="mt-4">
            <AdminDataTable maxHeight="72vh">
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-950/95 text-slate-300 backdrop-blur">
                  <tr>
                    <th className="w-[260px] p-3 text-left font-semibold">Programa</th>
                    <th className="w-[180px] p-3 text-left font-semibold">Categoría</th>
                    <th className="w-[160px] p-3 text-left font-semibold">Línea</th>
                    <th className="w-[140px] p-3 text-left font-semibold">Nivel interno</th>
                    <th className="w-[260px] p-3 text-left font-semibold">Assets</th>
                    <th className="w-[160px] p-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((program) => (
                    <tr key={program.id} className="border-t border-white/10 align-top">
                      <td className="p-3 text-slate-100"><div className="font-semibold">{program.name}</div></td>
                      <td className="p-3 text-slate-300"><span className="block max-w-[180px] truncate" title={program.category ?? "—"}>{program.category ?? "—"}</span></td>
                      <td className="p-3 text-slate-300"><LineBadge line={program.businessLine} /></td>
                      <td className="p-3 text-slate-400">{program.level ?? "—"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <AssetBadge label="Plan" r2Asset={program.r2Assets?.study_plan_pdf} existingUrl={program.planPdfUrl} />
                          <AssetBadge label="Brochure" r2Asset={program.r2Assets?.brochure_pdf} existingUrl={program.brochurePdfUrl} />
                          <AssetBadge label="Imagen" r2Asset={program.r2Assets?.hero_image} />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => openEdit(program)} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10">Editar</button>
                          <button type="button" onClick={() => handleDelete(program)} disabled={isDeleting} className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-300 transition hover:bg-red-500/20 disabled:opacity-50">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!pageRows.length ? (
                    <tr><td className="p-4 text-slate-300" colSpan={6}>Sin resultados.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </AdminDataTable>
          </div>
        ) : (
          <div className="mt-4 rounded-[22px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-5 text-sm text-[#536a7c]">La tabla está contraída. Usa el botón superior para volver a expandirla.</div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#536a7c]">
          <div>Página {currentPage} de {totalPages} ({filtered.length} programas)</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} className="rounded-full border border-[#c8d6e2] bg-white px-3 py-1.5 font-bold text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10 disabled:bg-[#e5ebef] disabled:text-[#647684]">Anterior</button>
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages} className="rounded-full border border-[#c8d6e2] bg-white px-3 py-1.5 font-bold text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10 disabled:bg-[#e5ebef] disabled:text-[#647684]">Siguiente</button>
          </div>
        </div>
      </div>

      <AdminDialogShell open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }} title="Editar programa" description="Aclara la categoría de catálogo y administra por separado los PDFs de plan y brochure." kicker="Programas" size="lg">
        {editing ? (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <input type="hidden" name="id" value={editing.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-[#163247] sm:col-span-2">Nombre del programa<input name="name" defaultValue={editing.name} className="ui-control" placeholder="Nombre del programa" /></label>
              <label className="grid gap-2 text-sm font-bold text-[#163247]">Categoría<input name="category" defaultValue={editing.category ?? ""} className="ui-control" placeholder="Ej. Salud, Ingeniería, Maestría" /></label>
              <label className="grid gap-2 text-sm font-bold text-[#163247]">Línea de negocio<select name="businessLine" defaultValue={editing.businessLine ?? ""} className="ui-control"><option value="">Sin asignar</option><option value="salud">Salud</option><option value="licenciatura">Licenciatura</option><option value="prepa">Bachillerato</option><option value="posgrado">Posgrado</option></select></label>
              <label className="grid gap-2 text-sm font-bold text-[#163247] sm:col-span-2">URL Plan PDF<input name="planPdfUrl" defaultValue={editing.planPdfUrl ?? ""} className="ui-control" placeholder="https://..." /></label>
              <label className="grid gap-2 text-sm font-bold text-[#163247] sm:col-span-2">URL Brochure PDF<input name="brochurePdfUrl" defaultValue={editing.brochurePdfUrl ?? ""} className="ui-control" placeholder="https://..." /></label>
            </div>
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div><div className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">Assets R2 del programa</div><p className="mt-1 text-xs text-slate-400">Selecciona archivos ya cargados en R2. Vacío limpia la relación, no borra el archivo.</p></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <AssetSelect label="Plan PDF" name="r2StudyPlanFileId" assets={pdfAssets} defaultValue={editing.r2Assets?.study_plan_pdf?.fileId} />
                <AssetSelect label="Brochure PDF" name="r2BrochureFileId" assets={pdfAssets} defaultValue={editing.r2Assets?.brochure_pdf?.fileId} />
                <AssetSelect label="Imagen principal" name="r2HeroImageFileId" assets={imageAssets} defaultValue={editing.r2Assets?.hero_image?.fileId} />
              </div>
            </div>
            {error ? <div className="rounded-[18px] border border-[#8a2d2d]/20 bg-[#fde7e7] px-4 py-2 text-sm font-semibold text-[#8a2d2d]">{error}</div> : null}
            {success ? <div className="rounded-[18px] border border-[#0c5f3a]/20 bg-[#ddf8ea] px-4 py-2 text-sm font-semibold text-[#0c5f3a]">{success}</div> : null}
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[#c8d6e2] bg-white/95 pt-4">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full border border-[#c8d6e2] bg-white px-4 py-2 text-sm font-bold text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10">Cancelar</button>
              <button type="submit" disabled={isPending} className="rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#0b3d56] disabled:border-[#c8d6e2] disabled:bg-[#e5ebef] disabled:text-[#647684]">{isPending ? "Guardando..." : "Guardar"}</button>
            </div>
          </form>
        ) : null}
      </AdminDialogShell>
    </div>
  );
}
