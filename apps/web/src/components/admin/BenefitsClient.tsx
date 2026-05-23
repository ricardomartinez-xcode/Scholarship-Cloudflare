"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AdminDialogShell from "@/components/admin/AdminDialogShell";
import { useAdminActionForm } from "@/components/admin/useAdminActionForm";
import SmartMultiSelect from "@/components/SmartMultiSelect";
import SmartSelect from "@/components/SmartSelect";
import AppSelect from "@/components/ui/AppSelect";

type Benefit = {
  id: string;
  appliesToAll: boolean;
  campusIds: string[];
  campusNames: string[];
  benefitType: "percentage" | "first_payment" | "fixed_scholarship";
  enrollmentType: "nuevo_ingreso" | "regreso" | "reingreso" | null;
  extraPercent: number;
  firstPaymentAmount: number;
  isActive: boolean;
  notes: string | null;
  businessLine: string | null;
  modality: string | null;
  duration: string | null;
};

type ActionResult = { ok: boolean; error?: string };

type BenefitImportPreviewRow = {
  rowNumber: number;
  action: "create" | "update" | "noop";
  benefitType: "percentage" | "first_payment" | "fixed_scholarship";
  enrollmentType: "nuevo_ingreso" | "regreso" | "reingreso" | null;
  businessLine: string | null;
  modality: string | null;
  duration: string | null;
  appliesToAll: boolean;
  campusIds: string[];
  extraPercent: number;
  firstPaymentAmount: number;
  isActive: boolean;
  notes: string | null;
};

type BenefitImportSummary = {
  ok: true;
  sessionId: string;
  processed: number;
  ready: number;
  created: number;
  updated: number;
  unchanged: number;
  warnings: string[];
  errors: string[];
  previewRows?: BenefitImportPreviewRow[];
  applied?: boolean;
  rolledBack?: boolean;
};

type ApiError = { ok: false; error: string };

const BUSINESS_LINE_OPTIONS = [
  { value: "__ALL__", label: "Todas" },
  { value: "salud", label: "Salud" },
  { value: "licenciatura", label: "Licenciatura" },
  { value: "prepa", label: "Preparatoria" },
  { value: "posgrado", label: "Posgrado" },
];

const MODALITY_OPTIONS = [
  { value: "__ALL__", label: "Todas" },
  { value: "presencial", label: "Presencial" },
  { value: "mixta", label: "Mixta" },
  { value: "online", label: "Online" },
];

const DURATION_OPTIONS = [
  { value: "__ALL__", label: "Cualquiera" },
  { value: "primer_cuatrimestre", label: "Primer cuatrimestre" },
  { value: "toda_la_carrera", label: "Toda la carrera" },
  { value: "pago_inicial", label: "Pago inicial" },
];

const BENEFIT_TYPE_OPTIONS = [
  { value: "percentage", label: "Porcentaje adicional" },
  { value: "first_payment", label: "Primer pago" },
  { value: "fixed_scholarship", label: "Beca fija" },
];

const ENROLLMENT_TYPE_OPTIONS = [
  { value: "__ALL__", label: "Cualquier ingreso" },
  { value: "nuevo_ingreso", label: "Nuevo ingreso" },
  { value: "regreso", label: "Regreso" },
  { value: "reingreso", label: "Reingreso" },
];

function resolveLabel(
  value: string | null,
  options: { value: string; label: string }[],
  fallback: string,
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function formatBenefitValue(benefit: Benefit) {
  if (benefit.benefitType === "first_payment") {
    return benefit.firstPaymentAmount.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return `${benefit.extraPercent}%`;
}

export default function BenefitsClient({
  benefits,
  campusOptions,
  upsertBenefitAction,
  deleteBenefitAction,
}: {
  benefits: Benefit[];
  campusOptions: { value: string; label: string; kind: string }[];
  upsertBenefitAction: (formData: FormData) => Promise<ActionResult>;
  deleteBenefitAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const labelId = useId();
  const percentId = useId();
  const activeId = useId();
  const businessLineId = useId();
  const modalityId = useId();
  const durationId = useId();
  const benefitTypeId = useId();
  const enrollmentTypeId = useId();
  const firstPaymentId = useId();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Benefit | null>(null);

  const percentOptions = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => (index + 1) * 5).map((value) => ({
        value: String(value),
        label: `${value}%`,
      })),
    [],
  );

  const campusSelectOptions = useMemo(
    () => [{ value: "__ALL__", label: "Todos" }, ...campusOptions.map((campus) => ({
      value: campus.value,
      label: campus.label,
    }))],
    [campusOptions],
  );

  const [campusIds, setCampusIds] = useState<string[]>([]);
  const [extraPercent, setExtraPercent] = useState<string>("");
  const [firstPaymentAmount, setFirstPaymentAmount] = useState<string>("");
  const [isActive, setIsActive] = useState<string>("true");
  const [notes, setNotes] = useState<string>("");
  const [benefitType, setBenefitType] = useState<string>("percentage");
  const [enrollmentType, setEnrollmentType] = useState<string>("");
  const [businessLine, setBusinessLine] = useState<string>("");
  const [modality, setModality] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [importLoading, setImportLoading] = useState(false);
  const [applyImportLoading, setApplyImportLoading] = useState(false);
  const [rollbackImportLoading, setRollbackImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<BenefitImportSummary | null>(null);
  const [importPreviewRows, setImportPreviewRows] = useState<BenefitImportPreviewRow[]>([]);
  const [importSessionId, setImportSessionId] = useState<string | null>(null);
  const [importApplied, setImportApplied] = useState(false);
  const [importRolledBack, setImportRolledBack] = useState(false);

  const { handleSubmit, saveState, saving, clearSaveState } = useAdminActionForm(
    upsertBenefitAction,
    "No fue posible guardar el beneficio.",
  );

  useEffect(() => {
    if (!saveState?.ok) return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setEditing(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [saveState?.ok]);

  function handleBenefitTypeChange(value: string) {
    setBenefitType(value);
    if (value === "first_payment") {
      setDuration("pago_inicial");
      setExtraPercent("");
    } else {
      setFirstPaymentAmount("");
    }
  }

  function startCreate() {
    clearSaveState();
    setEditing(null);
    setCampusIds([]);
    setExtraPercent("");
    setFirstPaymentAmount("");
    setIsActive("true");
    setNotes("");
    setBenefitType("percentage");
    setEnrollmentType("");
    setBusinessLine("");
    setModality("");
    setDuration("");
    setOpen(true);
  }

  function startEdit(benefit: Benefit) {
    clearSaveState();
    setEditing(benefit);
    setCampusIds(benefit.appliesToAll ? ["__ALL__"] : benefit.campusIds ?? []);
    setExtraPercent(
      benefit.benefitType === "percentage" ? String(benefit.extraPercent ?? "") : "",
    );
    setFirstPaymentAmount(
      benefit.benefitType === "first_payment"
        ? String(benefit.firstPaymentAmount ?? "")
        : "",
    );
    setIsActive(benefit.isActive ? "true" : "false");
    setNotes(benefit.notes ?? "");
    setBenefitType(benefit.benefitType ?? "percentage");
    setEnrollmentType(benefit.enrollmentType ?? "");
    setBusinessLine(benefit.businessLine ?? "");
    setModality(benefit.modality ?? "");
    setDuration(
      benefit.benefitType === "first_payment"
        ? benefit.duration ?? "pago_inicial"
        : benefit.duration ?? "",
    );
    setOpen(true);
  }

  const normalizedCampusIds = campusIds.includes("__ALL__")
    ? ["__ALL__"]
    : campusIds.filter((value) => value !== "__ALL__");

  async function validateImportCsv() {
    setImportLoading(true);
    setImportError(null);
    setImportApplied(false);
    setImportRolledBack(false);
    setImportSummary(null);
    try {
      const file = importFileRef.current?.files?.[0] ?? null;
      if (!file) {
        throw new Error("Selecciona un archivo CSV de beneficios.");
      }
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/admin/benefits/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as BenefitImportSummary | ApiError;
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.ok === false ? payload.error : "No fue posible validar el CSV.");
      }
      setImportSummary(payload);
      setImportPreviewRows(payload.previewRows ?? []);
      setImportSessionId(payload.sessionId);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "No fue posible validar el CSV.");
    } finally {
      setImportLoading(false);
    }
  }

  async function applyImportSession() {
    if (!importSessionId) return;
    setApplyImportLoading(true);
    setImportError(null);
    try {
      const response = await fetch(`/api/admin/benefits/import/${importSessionId}/apply`, {
        method: "POST",
      });
      const payload = (await response.json()) as BenefitImportSummary | ApiError;
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.ok === false ? payload.error : "No fue posible aplicar la sesión.");
      }
      setImportSummary((previous) =>
        previous
          ? { ...previous, ...payload, applied: true }
          : { ...payload, applied: true },
      );
      setImportApplied(true);
      setImportRolledBack(false);
      router.refresh();
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "No fue posible aplicar la importación.",
      );
    } finally {
      setApplyImportLoading(false);
    }
  }

  async function rollbackImportSession() {
    if (!importSessionId) return;
    setRollbackImportLoading(true);
    setImportError(null);
    try {
      const response = await fetch(`/api/admin/benefits/import/${importSessionId}/rollback`, {
        method: "POST",
      });
      const payload = (await response.json()) as { ok: true } | ApiError;
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.ok === false ? payload.error : "No fue posible revertir la sesión.");
      }
      setImportRolledBack(true);
      setImportApplied(false);
      router.refresh();
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "No fue posible ejecutar rollback.",
      );
    } finally {
      setRollbackImportLoading(false);
    }
  }

  return (
    <section className="ui-card ui-card-pad">
      <div className="ui-toolbar">
        <div>
          <h1 className="mt-1 text-lg font-semibold">Beneficios adicionales</h1>
          <p className="mt-1 text-sm text-slate-300">
            Configura descuentos porcentuales y el beneficio especial de Primer pago por
            plantel, tipo de ingreso y alcance académico.
          </p>
        </div>

        <button
          type="button"
          onClick={startCreate}
          className="ui-button-primary px-4 py-2 text-sm"
        >
          Nuevo
        </button>
      </div>

      <section className="mt-5 grid min-w-0 gap-3 overflow-hidden rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-secondary)] p-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--ui-text-secondary)]">
              Import CSV
            </div>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              Flujo: subir archivo, validar diff, confirmar aplicación y rollback lógico.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={validateImportCsv}
              disabled={importLoading || applyImportLoading || rollbackImportLoading}
              className="ui-button-secondary min-h-[34px] px-3 text-xs disabled:opacity-60"
            >
              {importLoading ? "Analizando..." : "Validar CSV"}
            </button>
            <button
              type="button"
              onClick={applyImportSession}
              disabled={Boolean(
                !importSessionId || applyImportLoading || importSummary?.errors?.length,
              )}
              className="ui-button-primary min-h-[34px] px-3 text-xs disabled:opacity-60"
            >
              {applyImportLoading ? "Aplicando..." : "Aplicar"}
            </button>
            <button
              type="button"
              onClick={rollbackImportSession}
              disabled={!importSessionId || !importApplied || rollbackImportLoading}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
            >
              {rollbackImportLoading ? "Revirtiendo..." : "Rollback"}
            </button>
          </div>
        </div>
        <input
          ref={importFileRef}
          type="file"
          accept=".csv,text/csv"
          className="ui-control min-w-0 max-w-full text-sm"
        />
        {importError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {importError}
          </div>
        ) : null}
        {importSummary ? (
          <div className="grid min-w-0 gap-3">
            <div className="grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-5">
              <div className="rounded-xl border border-[color:var(--ui-border)] bg-white p-2 text-xs text-[color:var(--ui-text-secondary)]">
                Procesadas: <strong className="text-[color:var(--ui-text-primary)]">{importSummary.processed}</strong>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
                Crear: <strong>{importSummary.created}</strong>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                Actualizar: <strong>{importSummary.updated}</strong>
              </div>
              <div className="rounded-xl border border-[color:var(--ui-border)] bg-white p-2 text-xs text-[color:var(--ui-text-secondary)]">
                Sin cambios: <strong className="text-[color:var(--ui-text-primary)]">{importSummary.unchanged}</strong>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-900">
                Errores: <strong>{importSummary.errors.length}</strong>
              </div>
            </div>
            {importSummary.warnings.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                {importSummary.warnings[0]}
              </div>
            ) : null}
            {importSummary.errors.length ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                {importSummary.errors[0]}
              </div>
            ) : null}
            {importRolledBack ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                Rollback ejecutado para la sesión actual.
              </div>
            ) : null}
            {importPreviewRows.length ? (
              <div className="ui-table-wrap ui-scrollbar">
                <table className="ui-table min-w-[900px]">
                  <thead>
                    <tr>
                      <th className="ui-cell-nowrap text-left">Fila</th>
                      <th className="ui-cell-nowrap text-left">Acción</th>
                      <th className="ui-cell-nowrap text-left">Tipo</th>
                      <th className="ui-cell-nowrap text-left">Planteles</th>
                      <th className="ui-cell-nowrap text-left">Valor</th>
                      <th className="ui-cell-nowrap text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreviewRows.slice(0, 30).map((row) => (
                      <tr key={`${row.rowNumber}-${row.action}`}>
                        <td className="ui-cell-nowrap text-slate-200">{row.rowNumber}</td>
                        <td className="ui-cell-nowrap text-slate-200">{row.action}</td>
                        <td className="ui-cell-nowrap text-slate-200">{row.benefitType}</td>
                        <td className="text-slate-200">
                          {row.appliesToAll ? "Todos" : row.campusIds.join(", ")}
                        </td>
                        <td className="ui-cell-nowrap text-slate-100">
                          {row.benefitType === "percentage"
                            ? `${row.extraPercent}%`
                            : row.firstPaymentAmount.toLocaleString("es-MX", {
                                style: "currency",
                                currency: "MXN",
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                        </td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {row.isActive ? "Activo" : "Desactivado"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {benefits.length ? (
        <div className="ui-table-wrap ui-scrollbar mt-6">
          <table className="ui-table min-w-[1120px]">
            <thead>
              <tr>
                <th className="min-w-[220px] text-left">Planteles</th>
                <th className="ui-cell-nowrap text-left">Tipo</th>
                <th className="ui-cell-nowrap text-left">Ingreso</th>
                <th className="ui-cell-nowrap text-left">Línea</th>
                <th className="ui-cell-nowrap text-left">Modalidad</th>
                <th className="ui-cell-nowrap text-left">Duración</th>
                <th className="ui-cell-nowrap text-left">Valor</th>
                <th className="ui-cell-nowrap text-left">Estado</th>
                <th className="text-left">Notas</th>
                <th className="ui-cell-nowrap text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {benefits.map((benefit) => (
                <tr key={benefit.id}>
                  <td className="text-slate-100">
                    <span className="block min-w-[200px]">
                      {benefit.appliesToAll
                        ? "Todos"
                        : benefit.campusNames?.length
                          ? benefit.campusNames.join(", ")
                          : "Sin planteles (legacy)"}
                    </span>
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {resolveLabel(
                      benefit.benefitType,
                      BENEFIT_TYPE_OPTIONS,
                      benefit.benefitType,
                    )}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {resolveLabel(
                      benefit.enrollmentType,
                      ENROLLMENT_TYPE_OPTIONS,
                      "Cualquier ingreso",
                    )}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {resolveLabel(benefit.businessLine, BUSINESS_LINE_OPTIONS, "Todas")}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {resolveLabel(benefit.modality, MODALITY_OPTIONS, "Todas")}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {resolveLabel(benefit.duration, DURATION_OPTIONS, "Cualquiera")}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {formatBenefitValue(benefit)}
                  </td>
                  <td className="ui-cell-nowrap text-slate-100">
                    {benefit.isActive ? "Activo" : "Desactivado"}
                  </td>
                  <td className="text-slate-200">{benefit.notes ?? "-"}</td>
                  <td className="ui-cell-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(benefit)}
                        className="ui-button-secondary min-h-[34px] whitespace-nowrap px-3 text-xs"
                      >
                        Editar
                      </button>
                      <form
                        action={deleteBenefitAction}
                        onSubmit={(event) => {
                          if (!window.confirm("¿Eliminar este beneficio?")) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="id" value={benefit.id} />
                        <button
                          type="submit"
                          className="whitespace-nowrap rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-950 transition hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                        >
                          Eliminar
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-6">
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path
                  d="M12 6v12m6-6H6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100">
                No hay beneficios configurados.
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Crea un beneficio adicional para iniciar.
              </div>
            </div>
            <button
              type="button"
              onClick={startCreate}
              className="ui-button-primary px-4 py-2 text-sm"
            >
              Nuevo
            </button>
          </div>
        </div>
      )}

      <AdminDialogShell
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            clearSaveState();
          }
        }}
        kicker={editing ? "Editar" : "Nuevo"}
        title="Beneficio adicional"
        description="Configura alcance, tipo, valor y estado del beneficio adicional sin salir del módulo."
        size="xl"
      >
        {saveState?.ok === false && saveState.error ? (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {saveState.error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <input type="hidden" name="id" value={editing?.id ?? ""} />
          <input type="hidden" name="campusIds" value={JSON.stringify(normalizedCampusIds)} />
          <input type="hidden" name="benefitType" value={benefitType} />
          <input type="hidden" name="enrollmentType" value={enrollmentType || ""} />
          <input type="hidden" name="businessLine" value={businessLine || ""} />
          <input type="hidden" name="modality" value={modality || ""} />
          <input type="hidden" name="duration" value={duration || ""} />
          <input type="hidden" name="extraPercent" value={extraPercent} />
          <input
            type="hidden"
            name="firstPaymentAmount"
            value={firstPaymentAmount}
          />
          <input type="hidden" name="isActive" value={isActive} />

          <SmartMultiSelect
            label="Plantel(es)"
            labelId={labelId}
            options={campusSelectOptions.map((option) => ({
              ...option,
              disabled:
                campusIds.includes("__ALL__") && option.value !== "__ALL__" ? true : false,
            }))}
            value={campusIds}
            onChange={setCampusIds}
            placeholder="Selecciona uno o varios"
          />

          <div className="ui-form-grid ui-form-grid--two ui-form-grid--four">
            <div className="grid gap-2 text-sm">
              <span id={benefitTypeId}>Tipo de beneficio</span>
              <SmartSelect
                labelId={benefitTypeId}
                placeholder="Selecciona tipo"
                value={benefitType}
                onChange={handleBenefitTypeChange}
                options={BENEFIT_TYPE_OPTIONS}
              />
            </div>

            <div className="grid gap-2 text-sm">
              <span id={enrollmentTypeId}>Tipo de ingreso</span>
              <SmartSelect
                labelId={enrollmentTypeId}
                placeholder="Cualquier ingreso"
                value={enrollmentType || ""}
                onChange={setEnrollmentType}
                options={ENROLLMENT_TYPE_OPTIONS}
              />
            </div>

            <div className="grid gap-2 text-sm">
              <span id={businessLineId}>Línea de negocio</span>
              <SmartSelect
                labelId={businessLineId}
                placeholder="Todas"
                value={businessLine || ""}
                onChange={setBusinessLine}
                options={BUSINESS_LINE_OPTIONS}
              />
            </div>

            <div className="grid gap-2 text-sm">
              <span id={modalityId}>Modalidad</span>
              <SmartSelect
                labelId={modalityId}
                placeholder="Todas"
                value={modality || ""}
                onChange={setModality}
                options={MODALITY_OPTIONS}
              />
            </div>

            <div className="grid gap-2 text-sm">
              <span id={durationId}>Duración</span>
              <SmartSelect
                labelId={durationId}
                placeholder={benefitType === "first_payment" ? "Pago inicial" : "Cualquiera"}
                value={duration || ""}
                onChange={setDuration}
                options={DURATION_OPTIONS}
                disabled={benefitType === "first_payment"}
              />
            </div>

            {benefitType === "first_payment" ? (
              <label className="grid gap-2 text-sm">
                <span id={firstPaymentId}>Monto de primer pago</span>
                <input
                  aria-labelledby={firstPaymentId}
                  value={firstPaymentAmount}
                  onChange={(event) => setFirstPaymentAmount(event.target.value)}
                  inputMode="decimal"
                  className="ui-control"
                  placeholder="Ej. 1500"
                />
              </label>
            ) : (
              <div className="grid gap-2">
                <div id={percentId} className="text-sm">
                  % adicional
                </div>
                <SmartSelect
                  labelId={percentId}
                  placeholder="Selecciona..."
                  value={extraPercent}
                  onChange={setExtraPercent}
                  options={percentOptions}
                />
              </div>
            )}

            <div className="grid gap-2 sm:col-span-2 xl:col-span-2">
              <div id={activeId} className="text-sm">
                Estado
              </div>
              <AppSelect
                labelId={activeId}
                placeholder="Selecciona..."
                value={isActive}
                onValueChange={setIsActive}
                options={[
                  { value: "true", label: "Activo" },
                  { value: "false", label: "Desactivado" },
                ]}
              />
            </div>
          </div>

          <label className="grid gap-2 text-sm">
            {benefitType === "first_payment" ? "Notas visibles del primer pago" : "Notas"}
            <textarea
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="ui-control min-h-[96px]"
              placeholder={
                benefitType === "first_payment"
                  ? "Ej. Aplica al primer pago."
                  : "Opcional"
              }
            />
          </label>

          <div className="sticky bottom-0 z-10 -mx-1 bg-[color:var(--ui-surface-primary)] px-1 pt-3">
            <button
              type="submit"
              disabled={saving}
              className="ui-button-primary w-full px-3 py-2 text-sm disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </AdminDialogShell>
    </section>
  );
}
