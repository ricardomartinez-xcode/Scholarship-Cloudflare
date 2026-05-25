"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  offerings: {
    created: number;
    updated: number;
    reactivated: number;
    deactivated: number;
  };
  warnings: string[];
  detectedSheets: { online: string | null; planteles: string | null };
  detectedColumns: {
    online: { licenciatura: number; posgrado: number };
    planteles: {
      plantel: number;
      programa: number;
      escolarizado: number;
      ejecutivo: number;
      horEscolarizado: number;
      horEjecutivo: number;
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
  delivery: "CAMPUS" | "ONLINE";
  escolarizado: boolean;
  ejecutivo: boolean;
  escolarizadoSchedule: string | null;
  ejecutivoSchedule: string | null;
  isActive: boolean;
  hasPlanPdf: boolean;
  hasBrochurePdf: boolean;
};

type CampusOption = {
  id: string;
  code: string;
  name: string;
  kind: "campus" | "online";
};

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
  isActive: boolean;
};

type ApiError = { ok: false; error: string };

const colLetter = (n: number) => String.fromCharCode(64 + n);

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
    escolarizado: true,
    ejecutivo: false,
    escolarizadoSchedule: "",
    ejecutivoSchedule: "",
    lineOfBusiness: defaultProgram?.businessLine ?? "",
    isActive: true,
  };
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
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [previewRows, setPreviewRows] = useState<OfferPreviewRow[]>(initialPreviewRows);
  const [previewQuery, setPreviewQuery] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [rolledBack, setRolledBack] = useState(false);
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

  const totals = useMemo(() => {
    if (!summary) return null;
    return {
      programsCreated: summary.programs.created,
      programsUpdated: summary.programs.updated,
      offeringsCreated: summary.offerings.created,
      offeringsUpdated: summary.offerings.updated,
      offeringsReactivated: summary.offerings.reactivated,
      offeringsDeactivated: summary.offerings.deactivated,
    };
  }, [summary]);

  async function runImport() {
    setLoading(true);
    setError(null);
    setSummary(null);
    setSessionId(null);
    setApplied(false);
    setRolledBack(false);

    try {
      const fd = new FormData();
      const file = fileRef.current?.files?.[0] ?? null;
      if (file) fd.set("file", file);
      fd.set("cycle", cycle);

      const res = await fetch("/api/admin/import-academic-offer", {
        method: "POST",
        body: fd,
      });

      const data = (await res.json()) as (Summary & { previewRows?: OfferPreviewRow[] }) | ApiError;
      if (!res.ok || !("ok" in data) || data.ok === false) {
        throw new Error((data as ApiError)?.error || "Error al importar.");
      }

      setSummary(data);
      setPreviewRows(data.previewRows ?? []);
      setPreviewPage(1);
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
      const data = (await res.json()) as
        | { ok: true; visibleCycles: AcademicOfferCycle[] }
        | ApiError;
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

  async function applyImport() {
    if (!sessionId) return;
    setApplyLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/import-academic-offer/${sessionId}/apply`, {
        method: "POST",
      });
      const data = (await res.json()) as Summary | ApiError;
      if (!res.ok || !("ok" in data) || data.ok === false) {
        throw new Error((data as ApiError)?.error || "Error al aplicar la sesión.");
      }
      setSummary(data);
      setApplied(true);
      setRolledBack(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al aplicar la sesión.");
    } finally {
      setApplyLoading(false);
    }
  }

  async function rollbackImport() {
    if (!sessionId) return;
    setRollbackLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/import-academic-offer/${sessionId}/rollback`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok: boolean; error?: string } | ApiError;
      if (!res.ok || !("ok" in data) || data.ok === false) {
        throw new Error((data as ApiError)?.error || "Error al revertir la sesión.");
      }
      setApplied(false);
      setRolledBack(true);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al revertir la sesión.");
    } finally {
      setRollbackLoading(false);
    }
  }

  async function saveManualOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualDraft) return;
    setManualLoading(true);
    setManualError(null);
    setManualFeedback(null);

    try {
      const formData = new FormData(event.currentTarget);
      const result = await upsertAcademicOfferAction(formData);
      if (!result.ok) {
        throw new Error(result.error ?? "No fue posible guardar la oferta.");
      }
      setManualDraft(null);
      setManualFeedback("Oferta académica guardada correctamente.");
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
      if (!result.ok) {
        throw new Error(result.error ?? "No fue posible eliminar la oferta.");
      }
      setManualFeedback("Oferta académica eliminada correctamente.");
      router.refresh();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "No fue posible eliminar la oferta.");
    } finally {
      setManualLoading(false);
    }
  }

  const filteredPreviewRows = useMemo(() => {
    const q = previewQuery.trim().toLowerCase();
    if (!q) return previewRows;
    return previewRows.filter((row) =>
      [row.campusName, row.campusCode, row.programName, row.line, row.modality]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [previewQuery, previewRows]);

  const previewPageSize = 20;
  const previewPageCount = Math.max(1, Math.ceil(filteredPreviewRows.length / previewPageSize));
  const currentPreviewPage = Math.min(previewPage, previewPageCount);
  const paginatedPreviewRows = useMemo(() => {
    const start = (currentPreviewPage - 1) * previewPageSize;
    return filteredPreviewRows.slice(start, start + previewPageSize);
  }, [currentPreviewPage, filteredPreviewRows]);

  return (
    <section className="ui-card ui-card-pad">
      <div className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/20 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Gestión manual
            </div>
            <h1 className="mt-1 text-lg font-semibold">Oferta académica</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">
              Agrega, modifica o elimina ofertas puntuales sin pasar por importación.
              La carga Excel sigue disponible para cambios masivos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setManualError(null);
              setManualFeedback(null);
              setManualDraft(buildManualDraft({ campusOptions, programOptions }));
            }}
            className="rounded-2xl border border-cyan-500/30 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
          >
            Agregar oferta
          </button>
        </div>

        {manualFeedback ? (
          <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 px-3 py-2 text-sm text-emerald-200">
            {manualFeedback}
          </div>
        ) : null}
        {manualError ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {manualError}
          </div>
        ) : null}

        {manualDraft ? (
          <form onSubmit={saveManualOffer} className="grid gap-4 rounded-2xl border border-white/10 bg-black/15 p-4">
            <input type="hidden" name="id" value={manualDraft.id} />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  {manualDraft.mode === "edit" ? "Editar oferta" : "Nueva oferta"}
                </div>
                <div className="text-xs text-slate-400">
                  La combinación plantel + programa + ciclo es única.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManualDraft(null)}
                className="text-sm text-slate-400 transition hover:text-slate-200"
              >
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
                    setManualDraft((current) =>
                      current
                        ? {
                            ...current,
                            campusId: event.target.value,
                            delivery: campus?.kind === "online" ? "ONLINE" : current.delivery,
                            escolarizado: campus?.kind === "online" ? false : current.escolarizado,
                            ejecutivo: campus?.kind === "online" ? false : current.ejecutivo,
                          }
                        : current,
                    );
                  }}
                  className="ui-control"
                  required
                >
                  {campusOptions.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name} · {campus.code}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                Ciclo
                <select
                  name="cycle"
                  value={manualDraft.cycle}
                  onChange={(event) =>
                    setManualDraft((current) =>
                      current
                        ? { ...current, cycle: event.target.value as AcademicOfferCycle }
                        : current,
                    )
                  }
                  className="ui-control"
                  required
                >
                  {ACADEMIC_OFFER_CYCLES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                Estado
                <select
                  name="isActive"
                  value={manualDraft.isActive ? "true" : "false"}
                  onChange={(event) =>
                    setManualDraft((current) =>
                      current ? { ...current, isActive: event.target.value === "true" } : current,
                    )
                  }
                  className="ui-control"
                >
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
                  setManualDraft((current) =>
                    current
                      ? {
                          ...current,
                          programId: event.target.value,
                          lineOfBusiness: program?.businessLine ?? current.lineOfBusiness,
                        }
                      : current,
                  );
                }}
                className="ui-control"
                required
              >
                {programOptions.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                    {program.businessLine ? ` · ${LINE_LABELS[program.businessLine] ?? program.businessLine}` : ""}
                    {program.hasPlanPdf ? " · PDF" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className="grid gap-2 text-sm">
                Línea
                <select
                  name="lineOfBusiness"
                  value={manualDraft.lineOfBusiness}
                  onChange={(event) =>
                    setManualDraft((current) =>
                      current ? { ...current, lineOfBusiness: event.target.value } : current,
                    )
                  }
                  className="ui-control"
                >
                  <option value="">Usar programa</option>
                  {Object.entries(LINE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                Delivery
                <select
                  name="delivery"
                  value={manualDraft.delivery}
                  onChange={(event) =>
                    setManualDraft((current) =>
                      current
                        ? {
                            ...current,
                            delivery: event.target.value as "CAMPUS" | "ONLINE",
                            escolarizado:
                              event.target.value === "ONLINE" ? false : current.escolarizado,
                            ejecutivo: event.target.value === "ONLINE" ? false : current.ejecutivo,
                          }
                        : current,
                    )
                  }
                  className="ui-control"
                >
                  <option value="CAMPUS">Plantel</option>
                  <option value="ONLINE">Online</option>
                </select>
              </label>

              <div className="grid gap-2 text-sm">
                Modalidades
                <div className="flex min-h-11 flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="escolarizado"
                      value="true"
                      checked={manualDraft.escolarizado}
                      disabled={manualDraft.delivery === "ONLINE"}
                      onChange={(event) =>
                        setManualDraft((current) =>
                          current ? { ...current, escolarizado: event.target.checked } : current,
                        )
                      }
                    />
                    Escolarizado
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="ejecutivo"
                      value="true"
                      checked={manualDraft.ejecutivo}
                      disabled={manualDraft.delivery === "ONLINE"}
                      onChange={(event) =>
                        setManualDraft((current) =>
                          current ? { ...current, ejecutivo: event.target.checked } : current,
                        )
                      }
                    />
                    Ejecutivo
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2 text-sm">
                Horario escolarizado
                <input
                  name="escolarizadoSchedule"
                  value={manualDraft.escolarizadoSchedule}
                  onChange={(event) =>
                    setManualDraft((current) =>
                      current ? { ...current, escolarizadoSchedule: event.target.value } : current,
                    )
                  }
                  className="ui-control"
                  disabled={manualDraft.delivery === "ONLINE"}
                />
              </label>
              <label className="grid gap-2 text-sm">
                Horario ejecutivo
                <input
                  name="ejecutivoSchedule"
                  value={manualDraft.ejecutivoSchedule}
                  onChange={(event) =>
                    setManualDraft((current) =>
                      current ? { ...current, ejecutivoSchedule: event.target.value } : current,
                    )
                  }
                  className="ui-control"
                  disabled={manualDraft.delivery === "ONLINE"}
                />
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={manualLoading}
                className="rounded-2xl border border-cyan-500/30 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:opacity-60"
              >
                {manualLoading ? "Guardando..." : "Guardar oferta"}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Importador Excel
          </div>
          <h1 className="mt-1 text-lg font-semibold">Oferta Académica</h1>
          <p className="mt-1 text-sm text-slate-300">
            La sesión primero valida y previsualiza el Excel del ciclo seleccionado;
            después puedes aplicar al draft y publicar cuando el diff esté aprobado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runImport}
            disabled={loading}
            className="rounded-2xl bg-blue-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-60"
          >
            {loading ? "Validando..." : "Validar archivo"}
          </button>
          {sessionId && !applied && !rolledBack ? (
            <button
              type="button"
              onClick={applyImport}
              disabled={applyLoading}
              className="rounded-2xl border border-cyan-500/30 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:opacity-60"
            >
              {applyLoading ? "Aplicando..." : "Aplicar al draft"}
            </button>
          ) : null}
          {sessionId && applied && !rolledBack ? (
            <button
              type="button"
              onClick={rollbackImport}
              disabled={rollbackLoading}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-60"
            >
              {rollbackLoading ? "Revirtiendo..." : "Rollback lógico"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
        <label className="grid gap-2 text-sm">
          Archivo (.xlsx)
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="ui-control"
          />
          <div className="text-xs text-slate-400">
            Si no seleccionas archivo, en desarrollo se intentará usar el Excel por defecto en
            <code className="mx-1 rounded bg-black/30 px-1">/docs</code>.
            En producción, sube el archivo.
          </div>
        </label>
        <label className="grid gap-2 text-sm">
          Ciclo a importar
          <select
            value={cycle}
            onChange={(event) => setCycle(event.target.value as AcademicOfferCycle)}
            className="ui-control"
          >
            {ACADEMIC_OFFER_CYCLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 rounded-3xl border border-white/10 bg-slate-950/20 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Ciclos visibles en /unidep
            </div>
            <div className="mt-1 text-sm text-slate-300">
              El usuario final solo podrá consultar los ciclos activos aquí.
            </div>
          </div>
          <button
            type="button"
            onClick={saveVisibleCycles}
            disabled={visibilityLoading || visibleCycles.length === 0}
            className="rounded-2xl border border-cyan-500/30 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:opacity-60"
          >
            {visibilityLoading ? "Guardando..." : "Guardar visibilidad"}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ACADEMIC_OFFER_CYCLES.map((item) => {
            const checked = visibleCycles.includes(item);
            return (
              <label
                key={item}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setVisibleCycles((current) =>
                      checked
                        ? current.filter((value) => value !== item)
                        : [...current, item].sort(
                            (left, right) =>
                              ACADEMIC_OFFER_CYCLES.indexOf(left) -
                              ACADEMIC_OFFER_CYCLES.indexOf(right),
                          ),
                    )
                  }
                />
                <span className="font-semibold text-slate-100">{item}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Format hint */}
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
          Formato esperado del Excel
        </summary>
        <div className="mt-2 grid gap-3 text-xs text-slate-300 rounded-2xl border border-white/10 bg-slate-950/20 p-3">
          <div>
            <span className="font-semibold text-slate-100">Hoja 1 — Online</span>
            <span className="ml-2 text-slate-400">
              (nombre: &quot;Online&quot; o detectado por encabezados)
            </span>
            <div className="mt-1 text-slate-400">
              Col A: Licenciatura · Col B: Posgrado. Cada celda con texto se importa
              como programa online del nivel correspondiente.
            </div>
          </div>
          <div>
            <span className="font-semibold text-slate-100">Hoja 2 — Planteles</span>
            <span className="ml-2 text-slate-400">
              (nombre: &quot;Planteles&quot; o detectado por encabezados)
            </span>
            <div className="mt-1 text-slate-400">
              Col A: Plantel · Col B: Programa · Col C: Escolarizado · Col D: Ejecutivo · Col E: Horario Escolarizado · Col F: Horario Ejecutivo
            </div>
          </div>
          <div className="text-slate-500">
            El importador detecta automáticamente los nombres de hojas y columnas basándose en los encabezados.
          </div>
        </div>
      </details>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {sessionId ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/25 px-4 py-3 text-sm text-slate-300">
          Sesión: <span className="font-semibold text-slate-100">{sessionId.slice(0, 8)}</span>
          {applied ? (
            <span className="ml-2 text-emerald-300">· aplicada al draft</span>
          ) : null}
          {rolledBack ? (
            <span className="ml-2 text-amber-300">· rollback ejecutado</span>
          ) : null}
        </div>
      ) : null}

      {summary && totals ? (
        <div className="mt-6 grid gap-4">
          {/* Detected sheets & columns */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">Hojas detectadas: </span>
            <span className="text-slate-300">
              Online=&quot;{summary.detectedSheets.online}&quot;
            </span>
            {" · "}
            <span className="text-slate-300">
              Planteles=&quot;{summary.detectedSheets.planteles}&quot;
            </span>
            {summary.detectedColumns ? (
              <>
                <span className="ml-3 font-semibold text-slate-200">Columnas: </span>
                <span>
                  Online[Lic={colLetter(summary.detectedColumns.online.licenciatura)},
                  Pos={colLetter(summary.detectedColumns.online.posgrado)}]
                </span>
                {" · "}
                <span>
                  Planteles[Plantel={colLetter(summary.detectedColumns.planteles.plantel)},
                  Prog={colLetter(summary.detectedColumns.planteles.programa)},
                  Escol={colLetter(summary.detectedColumns.planteles.escolarizado)},
                  Ejec={colLetter(summary.detectedColumns.planteles.ejecutivo)},
                  HorE={colLetter(summary.detectedColumns.planteles.horEscolarizado)},
                  HorEj={colLetter(summary.detectedColumns.planteles.horEjecutivo)}]
                </span>
              </>
            ) : null}
          </div>

          {/* Warnings */}
          {summary.warnings.length > 0 ? (
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-yellow-300 mb-1">
                Advertencias ({summary.warnings.length})
              </div>
              <ul className="grid gap-1 text-xs text-yellow-200">
                {summary.warnings.map((w, i) => (
                  <li key={i} className="flex gap-1">
                    <span className="opacity-60">·</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Totals */}
          <div className="rounded-3xl border border-white/10 bg-slate-950/20 p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Resumen
            </div>
            <div className="mt-2 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
              <div>
                Campus procesados:{" "}
                <span className="font-semibold text-slate-100">
                  {summary.campusesProcessed}
                </span>
              </div>
              <div>
                Programas:{" "}
                <span className="font-semibold text-slate-100">
                  +{totals.programsCreated}
                </span>{" "}
                <span className="text-slate-400">creados</span>,{" "}
                <span className="font-semibold text-slate-100">
                  {totals.programsUpdated}
                </span>{" "}
                <span className="text-slate-400">actualizados</span>
              </div>
              <div>
                Ofertas:{" "}
                <span className="font-semibold text-slate-100">
                  +{totals.offeringsCreated}
                </span>{" "}
                <span className="text-slate-400">creadas</span>,{" "}
                <span className="font-semibold text-slate-100">
                  {totals.offeringsUpdated}
                </span>{" "}
                <span className="text-slate-400">actualizadas</span>
              </div>
              <div>
                Estado:{" "}
                <span className="font-semibold text-slate-100">
                  {totals.offeringsReactivated}
                </span>{" "}
                <span className="text-slate-400">reactivadas</span>,{" "}
                <span className="font-semibold text-slate-100">
                  {totals.offeringsDeactivated}
                </span>{" "}
                <span className="text-slate-400">desactivadas</span>
              </div>
            </div>
          </div>

          {/* Per-campus table */}
          <details open className="rounded-3xl border border-white/10">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-200 hover:text-slate-100">
              Detalle por campus ({summary.perCampus.length})
            </summary>
            <div className="overflow-auto">
              <table className="w-full min-w-[660px] md:min-w-[820px] border-collapse text-sm">
                <thead className="bg-slate-950/40 text-slate-300">
                  <tr>
                    <th className="p-3 text-left font-semibold">Campus</th>
                    <th className="p-3 text-left font-semibold">Fuente</th>
                    <th className="p-3 text-left font-semibold">Filas</th>
                    <th className="p-3 text-left font-semibold">+Creadas</th>
                    <th className="p-3 text-left font-semibold">Act</th>
                    <th className="p-3 text-left font-semibold">Reac</th>
                    <th className="p-3 text-left font-semibold">Desac</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.perCampus.map((c) => (
                    <tr key={c.campusCode} className="border-t border-white/10">
                      <td className="p-3 text-slate-100">
                        <div className="font-semibold">{c.campusName}</div>
                        <div className="text-xs text-slate-400">{c.campusCode}</div>
                      </td>
                      <td className="p-3 text-slate-400 text-xs">
                        {c.source === "online-sheet" ? "Online" : `Hoja "${c.sheetName}"`}
                      </td>
                      <td className="p-3 text-slate-100">{c.rows}</td>
                      <td className="p-3 text-slate-100">{c.offeringsCreated}</td>
                      <td className="p-3 text-slate-100">{c.offeringsUpdated}</td>
                      <td className="p-3 text-slate-100">{c.offeringsReactivated}</td>
                      <td className="p-3 text-slate-100">{c.offeringsDeactivated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <details open className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/20 p-4">
            <summary className="-mx-1 cursor-pointer px-1 text-sm font-semibold text-slate-200 hover:text-slate-100">
              Vista previa activa ({filteredPreviewRows.length})
            </summary>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
                  Vista previa activa
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  Confirmación visual de la oferta activa para el ciclo {summary.cycle}.
                </div>
              </div>
              <label className="grid gap-1 text-xs text-slate-400">
                Buscar
                <input
                  value={previewQuery}
                  onChange={(event) => { setPreviewQuery(event.target.value); setPreviewPage(1); }}
                  className="ui-control w-full sm:min-w-[220px]"
                  placeholder="Campus, programa, línea..."
                />
              </label>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead className="bg-slate-950/40 text-slate-300">
                  <tr>
                    <th className="p-3 text-left font-semibold">Campus</th>
                    <th className="p-3 text-left font-semibold">Ciclo</th>
                    <th className="p-3 text-left font-semibold">Programa</th>
                    <th className="p-3 text-left font-semibold">Línea</th>
                    <th className="p-3 text-left font-semibold">Modalidad</th>
                    <th className="p-3 text-left font-semibold">Plan PDF</th>
                    <th className="p-3 text-left font-semibold">Brochure</th>
                    <th className="p-3 text-left font-semibold">Estado</th>
                    <th className="p-3 text-left font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPreviewRows.map((row) => (
                    <tr key={row.id} className="border-t border-white/10">
                      <td className="p-3 text-slate-100">
                        <div className="font-semibold">{row.campusName}</div>
                        <div className="text-xs text-slate-400">{row.campusCode}</div>
                      </td>
                      <td className="p-3 text-slate-300">{row.cycle}</td>
                      <td className="p-3 text-slate-100">{row.programName}</td>
                      <td className="p-3 text-slate-300">{row.line ?? "—"}</td>
                      <td className="p-3 text-slate-300">{row.modality}</td>
                      <td className="p-3 text-slate-300">{row.hasPlanPdf ? "Sí" : "No"}</td>
                      <td className="p-3 text-slate-300">{row.hasBrochurePdf ? "Sí" : "No"}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs ${
                            row.isActive
                              ? "border-blue-900/40 bg-blue-950/20 text-emerald-200"
                              : "border-white/10 bg-white/5 text-slate-400"
                          }`}
                        >
                          {row.isActive ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setManualError(null);
                              setManualFeedback(null);
                              setManualDraft(buildManualDraft({ row, campusOptions, programOptions }));
                            }}
                            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteManualOffer(row)}
                            disabled={manualLoading}
                            className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredPreviewRows.length ? (
                    <tr>
                      <td className="p-4 text-slate-300" colSpan={9}>
                        Sin resultados para los filtros actuales.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 px-3 py-3 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
              <div>
                Mostrando {filteredPreviewRows.length ? (currentPreviewPage - 1) * previewPageSize + 1 : 0}–{Math.min(currentPreviewPage * previewPageSize, filteredPreviewRows.length)} de {filteredPreviewRows.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewPage((current) => Math.max(1, current - 1))}
                  disabled={currentPreviewPage <= 1}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-200">
                  Página {currentPreviewPage} de {previewPageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewPage((current) => Math.min(previewPageCount, current + 1))}
                  disabled={currentPreviewPage >= previewPageCount}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </details>
        </div>
      ) : null}

      {!summary && previewRows.length ? (
        <details open className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-slate-950/20 p-4">
          <summary className="-mx-1 cursor-pointer px-1 text-sm font-semibold text-slate-200 hover:text-slate-100">
            Vista previa activa ({filteredPreviewRows.length})
          </summary>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Vista previa activa
              </div>
              <div className="mt-1 text-sm text-slate-300">
                Estado actual de la oferta cargada en draft para todos los ciclos visibles.
              </div>
            </div>
            <label className="grid gap-1 text-xs text-slate-400">
              Buscar
              <input
                value={previewQuery}
                onChange={(event) => { setPreviewQuery(event.target.value); setPreviewPage(1); }}
                className="ui-control w-full sm:min-w-[220px]"
                placeholder="Campus, programa, línea..."
              />
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-slate-950/40 text-slate-300">
                <tr>
                  <th className="p-3 text-left font-semibold">Campus</th>
                  <th className="p-3 text-left font-semibold">Ciclo</th>
                  <th className="p-3 text-left font-semibold">Programa</th>
                  <th className="p-3 text-left font-semibold">Línea</th>
                  <th className="p-3 text-left font-semibold">Modalidad</th>
                  <th className="p-3 text-left font-semibold">Plan PDF</th>
                  <th className="p-3 text-left font-semibold">Brochure</th>
                  <th className="p-3 text-left font-semibold">Estado</th>
                  <th className="p-3 text-left font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPreviewRows.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="p-3 text-slate-100">
                      <div className="font-semibold">{row.campusName}</div>
                      <div className="text-xs text-slate-400">{row.campusCode}</div>
                    </td>
                    <td className="p-3 text-slate-300">{row.cycle}</td>
                    <td className="p-3 text-slate-100">{row.programName}</td>
                    <td className="p-3 text-slate-300">{row.line ?? "—"}</td>
                    <td className="p-3 text-slate-300">{row.modality}</td>
                    <td className="p-3 text-slate-300">{row.hasPlanPdf ? "Sí" : "No"}</td>
                    <td className="p-3 text-slate-300">{row.hasBrochurePdf ? "Sí" : "No"}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs ${
                          row.isActive
                            ? "border-blue-900/40 bg-blue-950/20 text-emerald-200"
                            : "border-white/10 bg-white/5 text-slate-400"
                        }`}
                      >
                        {row.isActive ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setManualError(null);
                            setManualFeedback(null);
                            setManualDraft(buildManualDraft({ row, campusOptions, programOptions }));
                          }}
                          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteManualOffer(row)}
                          disabled={manualLoading}
                          className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

            <div className="flex flex-col gap-3 border-t border-white/10 px-3 py-3 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
              <div>
                Mostrando {filteredPreviewRows.length ? (currentPreviewPage - 1) * previewPageSize + 1 : 0}–{Math.min(currentPreviewPage * previewPageSize, filteredPreviewRows.length)} de {filteredPreviewRows.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewPage((current) => Math.max(1, current - 1))}
                  disabled={currentPreviewPage <= 1}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-200">
                  Página {currentPreviewPage} de {previewPageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewPage((current) => Math.min(previewPageCount, current + 1))}
                  disabled={currentPreviewPage >= previewPageCount}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
        </details>
      ) : null}
    </section>
  );
}
