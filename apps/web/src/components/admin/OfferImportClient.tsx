"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AdminRowActions from "@/components/admin/AdminRowActions";
import AdminSegmentedTabs from "@/components/admin/AdminSegmentedTabs";
import { formatAcademicPricingPlans } from "@/lib/academic-offer-plans";
import {
  ACADEMIC_MODULES,
  formatAcademicModuleLabel,
  type AcademicModuleSelection,
} from "@/lib/academic-modules";
import {
  ACADEMIC_OFFER_CYCLES,
  type AcademicOfferCycle,
} from "@/config/academicOffer";
import {
  deleteAcademicOfferAction,
  upsertAcademicOfferAction,
} from "@/app/(admin)/admin/(protected)/oferta/actions";

type Summary = {
  ok: true;
  sessionId?: string;
  cycle: string;
  campusesProcessed: number;
  programs: { created: number; updated: number };
  offerings: { created: number; updated: number; reactivated: number; deactivated: number };
  warnings: string[];
  detectedSheets: { online: string | null; planteles: string | null };
  detectedColumns: {
    online: {
      licenciatura: number;
      posgrado: number;
      licenciaturaPlanes: number | null;
      posgradoPlanes: number | null;
    };
    planteles: {
      ciclo: number | null;
      plantel: number;
      programa: number;
      linea: number | null;
      modalidad: number | null;
      escolarizado: number | null;
      ejecutivo: number | null;
      horEscolarizado: number;
      horEjecutivo: number;
      planes: number | null;
      modulo: number | null;
      moduleCount: number | null;
      materiasPorModulo: number | null;
      estado: number | null;
    };
  } | null;
  perCampus: Array<{
    campusCode: string;
    campusName: string;
    sheetName: string;
    source: string;
    rows: number;
    offeringsCreated: number;
    offeringsUpdated: number;
    offeringsReactivated: number;
    offeringsDeactivated: number;
  }>;
};

type OfferPreviewRow = {
  id: string;
  campusId: string;
  programId: string;
  campusCode: string;
  campusName: string;
  cycle: string;
  programName: string;
  line: string | null;
  modality: string;
  pricingPlans: number[];
  module: AcademicModuleSelection;
  moduleCount: number | null;
  subjectsByModule: string | null;
  delivery: "CAMPUS" | "ONLINE";
  escolarizado: boolean;
  ejecutivo: boolean;
  escolarizadoSchedule: string | null;
  ejecutivoSchedule: string | null;
  isActive: boolean;
  hasPlanPdf: boolean;
  hasBrochurePdf: boolean;
};

type CampusOption = { id: string; code: string; name: string; kind: "campus" | "online" };
type ProgramOption = {
  id: string;
  name: string;
  businessLine: string | null;
  category: string | null;
  level: string | null;
  hasPlanPdf: boolean;
  hasBrochurePdf: boolean;
};

type ManualOfferDraft = {
  mode: "create" | "edit";
  id: string;
  campusId: string;
  programId: string;
  cycle: AcademicOfferCycle;
  delivery: "CAMPUS" | "ONLINE";
  escolarizado: boolean;
  ejecutivo: boolean;
  escolarizadoSchedule: string;
  ejecutivoSchedule: string;
  lineOfBusiness: string;
  pricingPlans: string;
  module: AcademicModuleSelection;
  moduleCount: string;
  subjectsByModule: string;
  isActive: boolean;
};

type ApiError = { ok: false; error: string };
type OfferPanel = "list" | "imports";

const PREVIEW_PAGE_SIZE = 20;

const LINE_LABELS: Record<string, string> = {
  licenciatura: "Licenciatura",
  salud: "Salud",
  prepa: "Bachillerato",
  posgrado: "Posgrado",
};

function buildManualDraft(params: {
  row?: OfferPreviewRow;
  campusOptions: CampusOption[];
  programOptions: ProgramOption[];
}): ManualOfferDraft {
  const row = params.row;
  if (row) {
    return {
      mode: "edit",
      id: row.id,
      campusId: row.campusId,
      programId: row.programId,
      cycle: row.cycle as AcademicOfferCycle,
      delivery: row.delivery,
      escolarizado: row.escolarizado,
      ejecutivo: row.ejecutivo,
      escolarizadoSchedule: row.escolarizadoSchedule ?? "",
      ejecutivoSchedule: row.ejecutivoSchedule ?? "",
      lineOfBusiness: row.line ?? "",
      pricingPlans: formatAcademicPricingPlans(row.pricingPlans),
      module: row.module,
      moduleCount: row.moduleCount != null ? String(row.moduleCount) : "",
      subjectsByModule: row.subjectsByModule ?? "",
      isActive: row.isActive,
    };
  }

  const defaultCampus =
    params.campusOptions.find((campus) => campus.kind === "campus") ?? params.campusOptions[0];
  const defaultProgram = params.programOptions[0];
  return {
    mode: "create",
    id: "",
    campusId: defaultCampus?.id ?? "",
    programId: defaultProgram?.id ?? "",
    cycle: "C1",
    delivery: defaultCampus?.kind === "online" ? "ONLINE" : "CAMPUS",
    escolarizado: defaultCampus?.kind === "online" ? false : true,
    ejecutivo: false,
    escolarizadoSchedule: "",
    ejecutivoSchedule: "",
    lineOfBusiness: defaultProgram?.businessLine ?? "",
    pricingPlans: "",
    module: "",
    moduleCount: "",
    subjectsByModule: "",
    isActive: true,
  };
}

function offerStateLabel(row: OfferPreviewRow) {
  return row.isActive ? "Activa" : "Inactiva";
}

function sourceLabel(source: string, sheetName: string) {
  return source === "online-sheet" ? "Online" : `Hoja \"${sheetName}\"`;
}

function colLetter(n: number) {
  return String.fromCharCode(64 + n);
}

export default function OfferImportClient({
  initialPreviewRows = [],
  initialVisibleCycles = ["C1"] as AcademicOfferCycle[],
  campusOptions = [],
  programOptions = [],
}: {
  initialPreviewRows?: OfferPreviewRow[];
  initialVisibleCycles?: AcademicOfferCycle[];
  campusOptions?: CampusOption[];
  programOptions?: ProgramOption[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [activePanel, setActivePanel] = useState<OfferPanel>("list");
  const [loading, setLoading] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [previewRows, setPreviewRows] = useState<OfferPreviewRow[]>(initialPreviewRows);
  const [previewQuery, setPreviewQuery] = useState("");
  const [previewPage, setPreviewPage] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cycle, setCycle] = useState<AcademicOfferCycle>("C1");
  const [visibleCycles, setVisibleCycles] = useState<AcademicOfferCycle[]>(
    Array.from(new Set(initialVisibleCycles)).filter((value): value is AcademicOfferCycle =>
      ACADEMIC_OFFER_CYCLES.includes(value as AcademicOfferCycle),
    ),
  );
  const [manualDraft, setManualDraft] = useState<ManualOfferDraft | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualFeedback, setManualFeedback] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("panel") === "imports") setActivePanel("imports");
  }, []);

  useEffect(() => {
    setPreviewRows(initialPreviewRows);
    setPreviewPage(0);
  }, [initialPreviewRows]);

  const filteredPreviewRows = useMemo(() => {
    const q = previewQuery.trim().toLowerCase();
    if (!q) return previewRows;
    return previewRows.filter((row) =>
      [
        row.campusName,
        row.campusCode,
        row.programName,
        row.line,
        row.modality,
        row.module,
        row.moduleCount,
        row.subjectsByModule,
        row.cycle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [previewQuery, previewRows]);

  const totalPages = Math.ceil(filteredPreviewRows.length / PREVIEW_PAGE_SIZE);
  const page = Math.min(previewPage, Math.max(totalPages - 1, 0));
  const pageRows = filteredPreviewRows.slice(
    page * PREVIEW_PAGE_SIZE,
    (page + 1) * PREVIEW_PAGE_SIZE,
  );

  async function runImport() {
    const file = fileRef.current?.files?.[0] ?? null;
    if (!file) {
      setError("Selecciona un archivo .xlsx o .csv para crear el borrador de importación.");
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);
    setSessionId(null);

    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("cycle", cycle);

      const res = await fetch("/api/admin/import-academic-offer", { method: "POST", body: fd });
      const data = (await res.json()) as (Summary & { previewRows?: OfferPreviewRow[] }) | ApiError;
      if (!res.ok || !("ok" in data) || data.ok === false) {
        throw new Error((data as ApiError)?.error || "Error al importar.");
      }

      setSummary(data);
      setPreviewRows(data.previewRows ?? []);
      setPreviewPage(0);
      setSessionId(data.sessionId ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al importar.");
    } finally {
      setLoading(false);
    }
  }

  async function saveVisibleCycles() {
    setVisibilityLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/academic-offer/visibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibleCycles }),
      });
      const data = (await res.json()) as { ok: true; visibleCycles: AcademicOfferCycle[] } | ApiError;
      if (!res.ok || !("ok" in data) || data.ok === false) {
        throw new Error((data as ApiError)?.error || "Error al guardar visibilidad.");
      }
      setVisibleCycles(data.visibleCycles);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar visibilidad.");
    } finally {
      setVisibilityLoading(false);
    }
  }

  async function saveManualOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualLoading(true);
    setManualError(null);
    setManualFeedback(null);
    try {
      const result = await upsertAcademicOfferAction(new FormData(event.currentTarget));
      if (!result.ok) throw new Error(result.error ?? "No fue posible guardar la oferta.");
      setManualDraft(null);
      setManualFeedback("Oferta por planteles guardada correctamente.");
      router.refresh();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "No fue posible guardar la oferta.");
    } finally {
      setManualLoading(false);
    }
  }

  async function deleteManualOffer(row: OfferPreviewRow) {
    const confirmed = window.confirm(
      `Eliminar la oferta de ${row.programName} en ${row.campusName} (${row.cycle})?`,
    );
    if (!confirmed) return;
    setManualLoading(true);
    setManualError(null);
    setManualFeedback(null);
    try {
      const formData = new FormData();
      formData.set("id", row.id);
      const result = await deleteAcademicOfferAction(formData);
      if (!result.ok) throw new Error(result.error ?? "No fue posible eliminar la oferta.");
      setManualFeedback("Oferta por planteles eliminada correctamente.");
      router.refresh();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "No fue posible eliminar la oferta.");
    } finally {
      setManualLoading(false);
    }
  }

  const openNewOffer = () => {
    setManualError(null);
    setManualFeedback(null);
    setManualDraft(buildManualDraft({ campusOptions, programOptions }));
    setActivePanel("list");
  };

  const renderOfferTable = () => (
    <div className="ui-table-wrap ui-table-wrap--scroll-y ui-scrollbar mt-4 max-h-[calc(100dvh-14rem)] w-full">
      <table className="ui-table w-full min-w-[1280px] table-fixed">
        <colgroup>
          <col className="w-[11%]" />
          <col className="w-[6%]" />
          <col className="w-[17%]" />
          <col className="w-[8%]" />
          <col className="w-[9%]" />
          <col className="w-[7%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[14%]" />
          <col className="w-[5%]" />
          <col className="w-[8%]" />
        </colgroup>
        <thead>
          <tr>
            <th className="ui-cell-nowrap text-left">Plantel</th>
            <th className="ui-cell-nowrap text-left">Ciclo</th>
            <th className="ui-cell-nowrap text-left">Programa</th>
            <th className="ui-cell-nowrap text-left">Línea</th>
            <th className="ui-cell-nowrap text-left">Modalidad</th>
            <th className="ui-cell-nowrap text-left">Planes</th>
            <th className="ui-cell-nowrap text-left">Módulo</th>
            <th className="ui-cell-nowrap text-left">No. módulos</th>
            <th className="ui-cell-nowrap text-left">Materias por módulo</th>
            <th className="ui-cell-nowrap text-left">Estado</th>
            <th className="ui-cell-nowrap text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.length ? (
            pageRows.map((row) => (
              <tr key={row.id}>
                <td className="text-slate-200">
                  <div className="truncate font-semibold text-slate-100">{row.campusName}</div>
                  <div className="text-xs text-slate-400">{row.campusCode}</div>
                </td>
                <td className="ui-cell-nowrap text-slate-300">{row.cycle}</td>
                <td className="text-xs text-slate-300">{row.programName}</td>
                <td className="ui-cell-nowrap text-slate-300">{row.line ?? "—"}</td>
                <td className="ui-cell-nowrap text-slate-300">{row.modality}</td>
                <td className="ui-cell-nowrap text-slate-300">
                  {row.pricingPlans.length ? formatAcademicPricingPlans(row.pricingPlans) : "Sin plan"}
                </td>
                <td className="ui-cell-nowrap text-slate-300">{formatAcademicModuleLabel(row.module)}</td>
                <td className="ui-cell-nowrap text-slate-300">{row.moduleCount ?? "—"}</td>
                <td className="text-xs text-slate-300">{row.subjectsByModule ?? "—"}</td>
                <td className="ui-cell-nowrap">
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      row.isActive
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-white/5 text-slate-400",
                    ].join(" ")}
                  >
                    {offerStateLabel(row)}
                  </span>
                </td>
                <td className="ui-cell-nowrap text-right">
                  <AdminRowActions
                    actions={[
                      {
                        type: "edit",
                        label: `Editar ${row.programName}`,
                        onClick: () => {
                          setManualError(null);
                          setManualFeedback(null);
                          setManualDraft(buildManualDraft({ row, campusOptions, programOptions }));
                        },
                      },
                      {
                        type: "delete",
                        label: `Eliminar ${row.programName}`,
                        tone: "danger",
                        disabled: manualLoading,
                        onClick: () => void deleteManualOffer(row),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))
          ) : (
            <tr>
                <td className="text-slate-400" colSpan={11}>
                No hay ofertas con los filtros seleccionados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="ui-card ui-card-pad">
      <div className="ui-toolbar">
        <div>
          <h2 className="mt-1 text-lg font-semibold">Oferta por planteles</h2>
          <p className="mt-1 text-sm text-slate-300">
            Oferta activa de la calculadora. Usa <strong className="text-slate-100">Editar</strong> para crear o actualizar
            una oferta por plantel, o actualiza oferta por reemplazo o lote desde XLSX/CSV.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewOffer}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
        >
          Nueva oferta por plantel
        </button>
      </div>

      <div className="mt-5">
        <AdminSegmentedTabs
          ariaLabel="Vistas de oferta por planteles"
          activeId={activePanel}
          onChange={(panel) => setActivePanel(panel as OfferPanel)}
          items={[
            { id: "list", label: `Listado (${filteredPreviewRows.length})` },
            { id: "imports", label: "Importación" },
          ]}
        />
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert" aria-live="assertive">
          {error}
        </div>
      ) : null}
      {manualFeedback ? (
        <div className="mt-5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {manualFeedback}
        </div>
      ) : null}
      {manualError ? (
        <div className="mt-5 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {manualError}
        </div>
      ) : null}

      {activePanel === "list" ? (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <input
              value={previewQuery}
              onChange={(event) => {
                setPreviewQuery(event.target.value);
                setPreviewPage(0);
              }}
              className="ui-control w-full min-w-0 text-sm sm:w-[320px]"
              placeholder="Buscar por plantel, programa, ciclo, línea..."
            />
            <select
              value={cycle}
              onChange={(event) => {
                setCycle(event.target.value as AcademicOfferCycle);
                setPreviewPage(0);
              }}
              className="ui-control w-full min-w-0 text-sm sm:w-auto sm:min-w-[160px]"
            >
              {ACADEMIC_OFFER_CYCLES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <span className="text-xs text-slate-400 sm:ml-auto">
              {filteredPreviewRows.length} oferta{filteredPreviewRows.length !== 1 ? "s" : ""}
            </span>
          </div>

          {manualDraft ? (
            <form onSubmit={saveManualOffer} className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <input type="hidden" name="id" value={manualDraft.id} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {manualDraft.mode === "edit" ? "Editar oferta" : "Nueva oferta"}
                  </div>
                  <div className="text-xs text-slate-400">La combinación plantel + programa + ciclo es única.</div>
                </div>
                <button type="button" onClick={() => setManualDraft(null)} className="text-sm text-slate-400 transition hover:text-slate-200">
                  Cancelar
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <label className="grid gap-2 text-sm">
                  Plantel
                  <select
                    name="campusId"
                    value={manualDraft.campusId}
                    onChange={(event) => {
                      const campus = campusOptions.find((item) => item.id === event.target.value);
                      setManualDraft((current) => current ? {
                        ...current,
                        campusId: event.target.value,
                        delivery: campus?.kind === "online" ? "ONLINE" : current.delivery,
                        escolarizado: campus?.kind === "online" ? false : current.escolarizado,
                        ejecutivo: campus?.kind === "online" ? false : current.ejecutivo,
                      } : current);
                    }}
                    className="ui-control"
                    required
                  >
                    {campusOptions.map((campus) => (
                      <option key={campus.id} value={campus.id}>{campus.name} · {campus.code}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  Ciclo
                  <select name="cycle" value={manualDraft.cycle} onChange={(event) => setManualDraft((current) => current ? { ...current, cycle: event.target.value as AcademicOfferCycle } : current)} className="ui-control" required>
                    {ACADEMIC_OFFER_CYCLES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  Estado
                  <select name="isActive" value={manualDraft.isActive ? "true" : "false"} onChange={(event) => setManualDraft((current) => current ? { ...current, isActive: event.target.value === "true" } : current)} className="ui-control">
                    <option value="true">Activa</option>
                    <option value="false">Inactiva</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-2 text-sm">
                Programa / plan de estudios
                <select
                  name="programId"
                  value={manualDraft.programId}
                  onChange={(event) => {
                    const program = programOptions.find((item) => item.id === event.target.value);
                    setManualDraft((current) => current ? {
                      ...current,
                      programId: event.target.value,
                      lineOfBusiness: program?.businessLine ?? current.lineOfBusiness,
                    } : current);
                  }}
                  className="ui-control"
                  required
                >
                  {programOptions.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}{program.businessLine ? ` · ${LINE_LABELS[program.businessLine] ?? program.businessLine}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 lg:grid-cols-4">
                <label className="grid gap-2 text-sm">
                  Línea
                  <select name="lineOfBusiness" value={manualDraft.lineOfBusiness} onChange={(event) => setManualDraft((current) => current ? { ...current, lineOfBusiness: event.target.value } : current)} className="ui-control">
                    <option value="">Usar programa</option>
                    {Object.entries(LINE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  Planes permitidos
                  <input name="pricingPlans" value={manualDraft.pricingPlans} onChange={(event) => setManualDraft((current) => current ? { ...current, pricingPlans: event.target.value } : current)} className="ui-control" placeholder="Ej. 9, 11" />
                </label>
                <label className="grid gap-2 text-sm">
                  Módulo
                  <select name="module" value={manualDraft.module} onChange={(event) => setManualDraft((current) => current ? { ...current, module: event.target.value as AcademicModuleSelection } : current)} className="ui-control">
                    <option value="">Sin módulo</option>
                    {ACADEMIC_MODULES.map((item) => <option key={item} value={item}>{formatAcademicModuleLabel(item)}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  Delivery
                  <select
                    name="delivery"
                    value={manualDraft.delivery}
                    onChange={(event) => setManualDraft((current) => current ? {
                      ...current,
                      delivery: event.target.value as "CAMPUS" | "ONLINE",
                      escolarizado: event.target.value === "ONLINE" ? false : current.escolarizado,
                      ejecutivo: event.target.value === "ONLINE" ? false : current.ejecutivo,
                    } : current)}
                    className="ui-control"
                  >
                    <option value="CAMPUS">Plantel</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  No. de módulos
                  <input name="moduleCount" value={manualDraft.moduleCount} onChange={(event) => setManualDraft((current) => current ? { ...current, moduleCount: event.target.value } : current)} className="ui-control" inputMode="numeric" placeholder="Ej. 3" />
                </label>
                <label className="grid gap-2 text-sm">
                  Materias por módulo
                  <input name="subjectsByModule" value={manualDraft.subjectsByModule} onChange={(event) => setManualDraft((current) => current ? { ...current, subjectsByModule: event.target.value } : current)} className="ui-control" placeholder="Ej. 9=(M1=2,M2=2,M3=1)" />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="grid gap-2 text-sm">
                  Modalidades
                  <div className="flex min-h-11 flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3">
                    <label className="inline-flex items-center gap-2"><input type="checkbox" name="escolarizado" value="true" checked={manualDraft.escolarizado} disabled={manualDraft.delivery === "ONLINE"} onChange={(event) => setManualDraft((current) => current ? { ...current, escolarizado: event.target.checked } : current)} />Escolarizado</label>
                    <label className="inline-flex items-center gap-2"><input type="checkbox" name="ejecutivo" value="true" checked={manualDraft.ejecutivo} disabled={manualDraft.delivery === "ONLINE"} onChange={(event) => setManualDraft((current) => current ? { ...current, ejecutivo: event.target.checked } : current)} />Ejecutivo</label>
                  </div>
                </div>
                <label className="grid gap-2 text-sm">Horario escolarizado<input name="escolarizadoSchedule" value={manualDraft.escolarizadoSchedule} onChange={(event) => setManualDraft((current) => current ? { ...current, escolarizadoSchedule: event.target.value } : current)} className="ui-control" disabled={manualDraft.delivery === "ONLINE"} /></label>
                <label className="grid gap-2 text-sm">Horario ejecutivo<input name="ejecutivoSchedule" value={manualDraft.ejecutivoSchedule} onChange={(event) => setManualDraft((current) => current ? { ...current, ejecutivoSchedule: event.target.value } : current)} className="ui-control" disabled={manualDraft.delivery === "ONLINE"} /></label>
              </div>

              <div>
                <button type="submit" disabled={manualLoading} className="rounded-2xl bg-blue-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-60">
                  {manualLoading ? "Guardando..." : "Guardar oferta"}
                </button>
              </div>
            </form>
          ) : null}

          {renderOfferTable()}
          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-4 text-sm">
              <button type="button" disabled={page === 0} onClick={() => setPreviewPage((p) => p - 1)} className="rounded-xl border border-white/10 px-4 py-2 text-slate-200 transition hover:bg-white/5 disabled:opacity-40">← Anterior</button>
              <span className="text-slate-400">Página {page + 1} de {totalPages}</span>
              <button type="button" disabled={page >= totalPages - 1} onClick={() => setPreviewPage((p) => p + 1)} className="rounded-xl border border-white/10 px-4 py-2 text-slate-200 transition hover:bg-white/5 disabled:opacity-40">Siguiente →</button>
            </div>
          ) : null}
        </>
      ) : null}

      {activePanel === "imports" ? (
        <div className="mt-5 grid gap-4">
          <section className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Actualizar oferta por planteles</div>
                <p className="mt-1 text-sm text-slate-300">
                  Importa archivos XLSX o CSV. La validación crea un borrador sin modificar la oferta activa; después revisa el diff y confirma la publicación desde el detalle de sesión.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin/importaciones" className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
                  Ver historial
                </Link>
                <button type="button" onClick={runImport} disabled={loading} className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:opacity-60">
                  {loading ? "Validando..." : "Validar archivo"}
                </button>
                {sessionId ? (
                  <Link href={`/admin/importaciones/${sessionId}`} className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25">
                    Revisar y publicar
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
              <label className="grid gap-2 text-sm">
                Archivo (.xlsx o .csv)
                <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="ui-control" required />
                <span className="text-xs text-slate-400">El archivo se valida antes de crear la sesión. No se publica ningún cambio en este paso.</span>
              </label>
              <label className="grid gap-2 text-sm">
                Ciclo a actualizar
                <select value={cycle} onChange={(event) => setCycle(event.target.value as AcademicOfferCycle)} className="ui-control">
                  {ACADEMIC_OFFER_CYCLES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Ciclos visibles en /unidep</div>
                <p className="mt-1 text-sm text-slate-300">El usuario final solo podrá consultar los ciclos activos aquí.</p>
              </div>
              <button type="button" onClick={saveVisibleCycles} disabled={visibilityLoading || visibleCycles.length === 0} className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:opacity-60">
                {visibilityLoading ? "Guardando..." : "Guardar visibilidad"}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {ACADEMIC_OFFER_CYCLES.map((item) => {
                const checked = visibleCycles.includes(item);
                return (
                  <label key={item} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-slate-200">
                    <input type="checkbox" checked={checked} onChange={() => setVisibleCycles((current) => checked ? current.filter((value) => value !== item) : [...current, item].sort((left, right) => ACADEMIC_OFFER_CYCLES.indexOf(left) - ACADEMIC_OFFER_CYCLES.indexOf(right)))} />
                    <span className="font-semibold text-slate-100">{item}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <details className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200">Formato esperado</summary>
            <div className="mt-3 grid gap-3 text-xs text-slate-400">
              <p><strong className="text-slate-200">XLSX:</strong> acepta hojas Online y Planteles, o una hoja por campus con bloques C1, C2 o C3.</p>
              <p><strong className="text-slate-200">CSV:</strong> usa columnas: Ciclo, Plantel, Programa, Línea, Modalidad, Plan, Modulo, No. de modulos, Materias por módulo, Horario escolarizado, Horario ejecutivo y Estado.</p>
              <p>Modalidad acepta presencial, escolarizado, ejecutivo, mixta u online. Estado acepta Activo/Inactivo, true/false, si/no o 1/0.</p>
            </div>
          </details>

          {sessionId ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50" role="status" aria-live="polite">
              <div>
                Borrador listo: <span className="font-semibold">{sessionId.slice(0, 8)}</span>. Revisa el impacto antes de publicar.
              </div>
              <Link href={`/admin/importaciones/${sessionId}`} className="font-semibold text-cyan-100 underline decoration-cyan-300/50 underline-offset-4 hover:text-white">
                Abrir detalle
              </Link>
            </div>
          ) : null}

          {summary ? (
            <section className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
                <div>Campus procesados: <strong className="text-slate-100">{summary.campusesProcessed}</strong></div>
                <div>Programas: <strong className="text-slate-100">+{summary.programs.created}</strong> creados · <strong className="text-slate-100">{summary.programs.updated}</strong> actualizados</div>
                <div>Ofertas: <strong className="text-slate-100">+{summary.offerings.created}</strong> creadas · <strong className="text-slate-100">{summary.offerings.updated}</strong> actualizadas</div>
                <div>Estado: <strong className="text-slate-100">{summary.offerings.reactivated}</strong> reactivadas · <strong className="text-slate-100">{summary.offerings.deactivated}</strong> desactivadas</div>
              </div>
              {summary.detectedColumns ? (
                <div className="text-xs text-slate-400">
                  Hojas detectadas: Online=&quot;{summary.detectedSheets.online}&quot; · Planteles=&quot;{summary.detectedSheets.planteles}&quot; · Columnas: Online[Lic={colLetter(summary.detectedColumns.online.licenciatura)}, Pos={colLetter(summary.detectedColumns.online.posgrado)}] · Planteles[Plantel={colLetter(summary.detectedColumns.planteles.plantel)}, Prog={colLetter(summary.detectedColumns.planteles.programa)}]
                </div>
              ) : null}
              {summary.warnings.length ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                  <div className="font-semibold">Advertencias ({summary.warnings.length})</div>
                  <ul className="mt-2 grid gap-1">
                    {summary.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
                  </ul>
                </div>
              ) : null}
              <div className="ui-table-wrap ui-scrollbar max-h-[320px]">
                <table className="ui-table ui-table--compact w-full min-w-[820px]">
                  <thead><tr><th className="text-left">Campus</th><th className="text-left">Fuente</th><th className="text-left">Filas</th><th className="text-left">Creadas</th><th className="text-left">Actualizadas</th><th className="text-left">Reactivadas</th><th className="text-left">Desactivadas</th></tr></thead>
                  <tbody>{summary.perCampus.map((campus) => <tr key={`${campus.campusCode}-${campus.sheetName}`}><td><div className="font-semibold text-slate-100">{campus.campusName}</div><div className="text-xs text-slate-400">{campus.campusCode}</div></td><td className="text-slate-400">{sourceLabel(campus.source, campus.sheetName)}</td><td>{campus.rows}</td><td>{campus.offeringsCreated}</td><td>{campus.offeringsUpdated}</td><td>{campus.offeringsReactivated}</td><td>{campus.offeringsDeactivated}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
