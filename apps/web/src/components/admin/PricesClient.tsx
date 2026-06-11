"use client";

import { useEffect, useMemo, useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";

import AdminSegmentedTabs from "@/components/admin/AdminSegmentedTabs";
import AdminDialogShell from "@/components/admin/AdminDialogShell";
import { useAdminActionForm } from "@/components/admin/useAdminActionForm";
import {
  formatAdminPricingPlantel,
  formatAdminPricingTier,
  normalizeAdminPricingRegion,
} from "@/lib/admin-pricing-display";
import {
  PRICE_SCOPE_PRESETS,
  adminPriceScopeDefinition,
  describeAdminPriceScopePreset,
  formatAdminPriceScopePreset,
  inferAdminPriceScopePreset,
  type AdminPriceScopePreset,
} from "@/lib/admin-price-scope";
import { ACADEMIC_MODULES, type AcademicModule } from "@/lib/academic-modules";
import {
  buildAdminPriceRows,
  findOverride,
  type MontoOverride,
  type PriceRow,
} from "@/lib/admin-price-rows";

type ActionResult = { ok: boolean; error?: string };

type PriceImportPreviewRow = {
  rowNumber: number;
  action: "create" | "update" | "noop";
  region: string | null;
  plantel: string | null;
  programaKey: string | null;
  scopePreset?: AdminPriceScopePreset;
  scopeLabel?: string;
  nivelKey: string;
  modalidadKey: string;
  plan: string;
  module: AcademicModule;
  tier: string | null;
  newPrice: number;
  subjectPrice: number | null;
  isActive: boolean;
  notes: string | null;
};

type PriceImportSummary = {
  ok: true;
  sessionId: string;
  processed: number;
  ready: number;
  created: number;
  updated: number;
  unchanged: number;
  warnings: string[];
  errors: string[];
  previewRows?: PriceImportPreviewRow[];
  applied?: boolean;
  rolledBack?: boolean;
};

type ApiError = { ok: false; error: string };

type PricePanel = "list" | "imports";
type PriceImportApplyMode = "replace" | "update-only";

const PAGE_SIZE = 20;

function fmt(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `$${Number(v).toLocaleString("es-MX")}`;
}

function priceSourceLabel(row: PriceRow) {
  if (row.source === "canonical") return "Canónico";
  if (row.source === "derived") return "Derivado";
  return "Sin precio";
}

function priceScopePresetForRow(row: PriceRow): AdminPriceScopePreset {
  return inferAdminPriceScopePreset({
    programa_key: row.programa_key,
    plantel: row.plantel,
    tier: row.tier,
  });
}

function priceScopeLabel(row: PriceRow) {
  return formatAdminPriceScopePreset(priceScopePresetForRow(row));
}

function priceScopeDescription(row: PriceRow) {
  return adminPriceScopeDefinition(priceScopePresetForRow(row)).label;
}

export default function PricesClient({
  montoOverrides,
  upsertMontoOverrideAction,
  deletePriceOverrideAction,
}: {
  montoOverrides: MontoOverride[];
  upsertMontoOverrideAction: (fd: FormData) => Promise<ActionResult>;
  deletePriceOverrideAction: (fd: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const priceRows = useMemo(
    () => buildAdminPriceRows({ montoOverrides }),
    [montoOverrides],
  );

  const [filterNivel, setFilterNivel] = useState("");
  const [page, setPage] = useState(0);
  const [activePanel, setActivePanel] = useState<PricePanel>("list");

  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PriceRow | null>(null);
  const [editingOverride, setEditingOverride] = useState<MontoOverride | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [subjectPrice, setSubjectPrice] = useState("");
  const [newPriceScopePreset, setNewPriceScopePreset] =
    useState<AdminPriceScopePreset>("program_campus_tier");

  const [deleteTransition, startDeleteTransition] = useTransition();
  const [importLoading, setImportLoading] = useState(false);
  const [applyImportLoading, setApplyImportLoading] = useState(false);
  const [rollbackImportLoading, setRollbackImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<PriceImportSummary | null>(null);
  const [importPreviewRows, setImportPreviewRows] = useState<PriceImportPreviewRow[]>([]);
  const [importSessionId, setImportSessionId] = useState<string | null>(null);
  const [importApplied, setImportApplied] = useState(false);
  const [importRolledBack, setImportRolledBack] = useState(false);

  const { handleSubmit, saveState, saving, clearSaveState } = useAdminActionForm(
    upsertMontoOverrideAction,
    "No fue posible guardar el precio lista."
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("panel") === "imports") setActivePanel("imports");
  }, []);

  useEffect(() => {
    if (!saveState?.ok) return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setEditingRule(null);
      setEditingOverride(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [saveState?.ok]);

  const uniqueNiveles = [
    ...new Set(priceRows.map((r) => r.nivel_key)),
  ].sort();

  const filtered = priceRows.filter((r) => {
    if (filterNivel && r.nivel_key !== filterNivel) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function openEdit(rule: PriceRow) {
    clearSaveState();
    const override = findOverride(rule, montoOverrides);
    setEditingRule(rule);
    setEditingOverride(override);
    setNewPriceScopePreset(priceScopePresetForRow(rule));
    setNewPrice(rule.basePriceMxn === null ? "" : String(rule.basePriceMxn));
    setSubjectPrice(rule.subjectPriceMxn === null ? "" : String(rule.subjectPriceMxn));
    setOpen(true);
  }

  function openCreateProgramPrice() {
    clearSaveState();
    setNewPriceScopePreset("program_campus_tier");
    setEditingRule({
      id: "new:program-price",
      region: null,
      plantel: null,
      programa_key: null,
      nivel_key: "",
      modalidad_key: "presencial",
      plan: "",
      module: "Longitudinal",
      tier: null,
      basePriceMxn: null,
      subjectPriceMxn: null,
      sourceOverrideId: null,
      source: "canonical",
    });
    setEditingOverride(null);
    setNewPrice("");
    setSubjectPrice("");
    setOpen(true);
  }

  function removeOverride(override: MontoOverride) {
    if (!window.confirm("¿Eliminar este precio lista canónico?")) return;
    startDeleteTransition(async () => {
      const fd = new FormData();
      fd.set("id", override.id);
      await deletePriceOverrideAction(fd);
    });
  }

  async function buildNormalizedImportFile(file: File) {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".csv")) return file;
    if (!lowerName.endsWith(".xlsx")) {
      throw new Error("Formato no soportado. Usa un archivo .xlsx o .csv.");
    }
    return file;
  }

  async function validateImportCsv() {
    setImportLoading(true);
    setImportError(null);
    setImportApplied(false);
    setImportRolledBack(false);
    setImportSummary(null);
    try {
      const file = importFileRef.current?.files?.[0] ?? null;
      if (!file) {
        throw new Error("Selecciona un archivo de precios.");
      }
      const normalizedFile = await buildNormalizedImportFile(file);
      const formData = new FormData();
      formData.set("file", normalizedFile);
      const response = await fetch("/api/admin/prices/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as PriceImportSummary | ApiError;
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

  async function applyImportSession(mode: PriceImportApplyMode = "replace") {
    if (!importSessionId) return;
    setApplyImportLoading(true);
    setImportError(null);
    try {
      const response = await fetch(`/api/admin/prices/import/${importSessionId}/apply?mode=${mode}`, {
        method: "POST",
      });
      const payload = (await response.json()) as PriceImportSummary | ApiError;
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
      const response = await fetch(`/api/admin/prices/import/${importSessionId}/rollback`, {
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

  const newScopeDefinition = adminPriceScopeDefinition(newPriceScopePreset);
  const showProgramInput = newScopeDefinition.fields.includes("programa");
  const showPlantelInput = newScopeDefinition.fields.includes("plantel");
  const showTierInput = newScopeDefinition.fields.includes("tier");

  return (
    <section className="ui-card ui-card-pad">
      <div className="ui-toolbar">
        <div>
          <h1 className="mt-1 text-lg font-semibold">Precios lista canónicos</h1>
          <p className="mt-1 text-sm text-slate-300">
            Precios lista activos de la calculadora. Usa{" "}
            <strong className="text-slate-100">Editar</strong> para crear o actualizar el
            precio lista canónico del alcance seleccionado.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateProgramPrice}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
        >
          Nuevo precio canónico
        </button>
      </div>

      <div className="mt-5">
        <AdminSegmentedTabs
          ariaLabel="Vistas de precios"
          activeId={activePanel}
          onChange={(panel) => setActivePanel(panel as PricePanel)}
          items={[
          { id: "list", label: `Listado (${filtered.length})` },
          { id: "imports", label: "Actualizacion" },
          ]}
        />
      </div>

      {activePanel === "imports" ? (
      <section className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Actualizar precios
            </div>
            <p className="mt-1 text-sm text-slate-300">
              Importa archivos XLSX o CSV con el orden canónico de precio. Se genera preview
              de diff antes de aplicar cambios.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={validateImportCsv}
              disabled={importLoading || applyImportLoading || rollbackImportLoading}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:opacity-60"
            >
              {importLoading ? "Analizando..." : "Validar archivo"}
            </button>
            <button
              type="button"
              onClick={() => void applyImportSession("replace")}
              disabled={Boolean(
                !importSessionId || applyImportLoading || importSummary?.errors?.length,
              )}
              className="rounded-xl border border-emerald-500/40 bg-blue-950/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-blue-950/25 disabled:opacity-60"
            >
              {applyImportLoading ? "Actualizando..." : "Actualizar precios"}
            </button>
            <button
              type="button"
              onClick={() => void applyImportSession("update-only")}
              disabled={Boolean(
                !importSessionId || applyImportLoading || importSummary?.errors?.length,
              )}
              className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-60"
            >
              {applyImportLoading ? "Actualizando..." : "Actualizar lote"}
            </button>
            <button
              type="button"
              onClick={rollbackImportSession}
              disabled={!importSessionId || !importApplied || rollbackImportLoading}
              className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-60"
            >
              {rollbackImportLoading ? "Revirtiendo..." : "Rollback"}
            </button>
          </div>
        </div>
        <input
          ref={importFileRef}
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="ui-control max-w-full text-sm"
        />
        <div className="grid gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-slate-300 md:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
          <div>
            <div className="font-semibold text-slate-100">Orden canónico visible</div>
            <div className="mt-1 font-mono text-[11px]">
              Línea de negocio | Alcance | Region | Plantel | Programa | Tier | Precio lista | Precio por materia | Modalidad | Plan | Módulo
            </div>
          </div>
          <div className="grid gap-1">
            <div>
              <div className="font-semibold text-slate-100">Encabezados CSV aceptados</div>
              <div className="mt-1 font-mono text-[11px]">
                linea, alcance, region, plantel, programa, tier, precio, precio_por_materia, modalidad, plan, modulo
              </div>
            </div>
            <div className="text-[11px] leading-5 text-slate-400">
              Alias: “Alcance” permite elegir general, tier, plantel, programa, programa + tier, programa + plantel o programa + plantel + tier. “Programa”
              acota un precio a una carrera, por ejemplo psicologia. “Precio lista” también es válido para precio.
            </div>
          </div>
        </div>
        {importError ? (
          <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {importError}
          </div>
        ) : null}
        {importSummary ? (
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-xs text-slate-300">
                Procesadas: <strong className="text-slate-100">{importSummary.processed}</strong>
              </div>
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2 text-xs text-cyan-100">
                Crear: <strong>{importSummary.created}</strong>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-100">
                Actualizar: <strong>{importSummary.updated}</strong>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-xs text-slate-300">
                Sin cambios: <strong className="text-slate-100">{importSummary.unchanged}</strong>
              </div>
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-100">
                Errores: <strong>{importSummary.errors.length}</strong>
              </div>
            </div>
            {importSummary.warnings.length ? (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {importSummary.warnings[0]}
              </div>
            ) : null}
            {importSummary.errors.length ? (
              <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                {importSummary.errors[0]}
              </div>
            ) : null}
            {importRolledBack ? (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Rollback ejecutado para la sesión actual.
              </div>
            ) : null}
            {importPreviewRows.length ? (
              <div className="ui-table-wrap ui-table-wrap--scroll-y ui-scrollbar max-h-[360px]">
                <table className="ui-table ui-table--compact w-full min-w-[1160px]">
                  <thead>
                    <tr>
                      <th className="ui-cell-nowrap text-left">Fila</th>
                      <th className="ui-cell-nowrap text-left">Acción</th>
                      <th className="ui-cell-nowrap text-left">Alcance</th>
                      <th className="ui-cell-nowrap text-left">Línea de negocio</th>
                      <th className="ui-cell-nowrap text-left">Region</th>
                      <th className="ui-cell-nowrap text-left">Plantel</th>
                      <th className="ui-cell-nowrap text-left">Programa</th>
                      <th className="ui-cell-nowrap text-left">Tier</th>
                      <th className="ui-cell-nowrap text-left">Módulo</th>
                      <th className="ui-cell-nowrap text-right">Precio lista</th>
                      <th className="ui-cell-nowrap text-right">Precio materia</th>
                      <th className="text-left">Detalle</th>
                      <th className="ui-cell-nowrap text-left">Activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreviewRows.slice(0, 40).map((row) => (
                      <tr key={`${row.rowNumber}-${row.plantel ?? "general"}-${row.plan}-${row.module}`}>
                        <td className="ui-cell-nowrap text-slate-200">{row.rowNumber}</td>
                        <td className="ui-cell-nowrap text-slate-200">{row.action}</td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {row.scopeLabel ?? (row.scopePreset ? formatAdminPriceScopePreset(row.scopePreset) : "—")}
                        </td>
                        <td className="ui-cell-nowrap text-slate-200">{row.nivelKey}</td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {normalizeAdminPricingRegion(row.region)}
                        </td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {formatAdminPricingPlantel(row)}
                        </td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {row.programaKey ?? "Todos"}
                        </td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {formatAdminPricingTier(row)}
                        </td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {row.module}
                        </td>
                        <td className="ui-cell-nowrap text-right font-mono text-slate-100">
                          {fmt(row.newPrice)}
                        </td>
                        <td className="ui-cell-nowrap text-right font-mono text-slate-100">
                          {fmt(row.subjectPrice)}
                        </td>
                        <td className="text-slate-200">
                          {row.modalidadKey} · plan {row.plan}
                        </td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {row.isActive ? "Sí" : "No"}
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
      ) : null}

      {activePanel === "list" ? (
      <>
      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <select
          value={filterNivel}
          onChange={(e) => {
            setFilterNivel(e.target.value);
            setPage(0);
          }}
          className="ui-control w-full min-w-0 sm:w-auto sm:min-w-[170px] text-sm"
        >
          <option value="">Todos los niveles</option>
          {uniqueNiveles.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400 sm:ml-auto">
          {filtered.length} precio{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="ui-table-wrap ui-table-wrap--scroll-y ui-scrollbar mt-4 max-h-[calc(100dvh-14rem)] w-full">
        <table className="ui-table !w-full !min-w-full table-fixed">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[6%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="ui-cell-nowrap text-left">Línea de negocio</th>
              <th className="ui-cell-nowrap text-left">Region</th>
              <th className="ui-cell-nowrap text-left">Plantel</th>
              <th className="ui-cell-nowrap text-left">Programa</th>
              <th className="ui-cell-nowrap text-left">Alcance</th>
              <th className="ui-cell-nowrap text-left">Tier</th>
              <th className="ui-cell-nowrap text-left">Módulo</th>
              <th className="ui-cell-nowrap text-right">Precio lista</th>
              <th className="ui-cell-nowrap text-right">Precio materia</th>
              <th className="ui-cell-nowrap text-left">Modalidad</th>
              <th className="ui-cell-nowrap text-left">Plan</th>
              <th className="ui-cell-nowrap text-left">Fuente</th>
              <th className="ui-cell-nowrap text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? (
              pageRows.map((rule) => {
                return (
                  <tr key={rule.id}>
                    <td className="ui-cell-nowrap text-slate-200">{rule.nivel_key}</td>
                    <td className="ui-cell-nowrap text-slate-200">
                      {normalizeAdminPricingRegion(rule.region)}
                    </td>
                    <td className="ui-cell-nowrap text-slate-200">
                      {formatAdminPricingPlantel(rule)}
                    </td>
                    <td className="ui-cell-nowrap text-xs text-slate-300">
                      {rule.programa_key ?? "Todos"}
                    </td>
                    <td className="ui-cell-nowrap text-xs text-slate-200" title={priceScopeDescription(rule)}>
                      {priceScopeLabel(rule)}
                    </td>
                    <td className="ui-cell-nowrap text-xs text-slate-300">
                      {formatAdminPricingTier(rule)}
                    </td>
                    <td className="ui-cell-nowrap text-slate-200">{rule.module}</td>
                    <td className="ui-cell-nowrap text-right font-mono text-slate-100">
                      {fmt(rule.basePriceMxn)}
                    </td>
                    <td className="ui-cell-nowrap text-right font-mono text-slate-100">
                      {fmt(rule.subjectPriceMxn)}
                    </td>
                    <td className="ui-cell-nowrap text-slate-200">{rule.modalidad_key}</td>
                    <td className="ui-cell-nowrap text-xs text-slate-300">
                      {rule.plan}
                    </td>
                    <td className="ui-cell-nowrap text-slate-300">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          rule.source === "canonical"
                            ? "bg-emerald-500/15 text-emerald-200"
                            : rule.source === "derived"
                              ? "bg-cyan-500/15 text-cyan-200"
                              : "bg-amber-500/15 text-amber-200",
                        ].join(" ")}
                      >
                        {priceSourceLabel(rule)}
                      </span>
                    </td>
                    <td className="ui-cell-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(rule)}
                          className="rounded-xl border border-white/10 bg-white/0 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 whitespace-nowrap"
                        >
                          Editar
                        </button>
                        {rule.sourceOverrideId && (
                          <button
                            type="button"
                            disabled={deleteTransition}
                            onClick={() => {
                              const override = findOverride(rule, montoOverrides);
                              if (override) removeOverride(override);
                            }}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 whitespace-nowrap"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="text-slate-400" colSpan={13}>
                  No hay precios con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4 text-sm">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl border border-white/10 bg-white/0 px-4 py-2 text-slate-200 transition hover:bg-white/5 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-slate-400">
            Página {page + 1} de {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border border-white/10 bg-white/0 px-4 py-2 text-slate-200 transition hover:bg-white/5 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
      </>
      ) : null}

      {/* Edit / create canonical list price dialog */}
      <AdminDialogShell
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            clearSaveState();
          }
        }}
        kicker={editingOverride ? "Modificar precio" : "Nuevo precio"}
        title="Precio lista canónico"
        description={
          editingRule
            ? `${normalizeAdminPricingRegion(editingRule.region)} · ${formatAdminPricingPlantel(editingRule)} · ${editingRule.programa_key ?? "Todos los programas"} · ${formatAdminPricingTier(editingRule)}`
            : "Actualiza el precio lista que usará la calculadora."
        }
        size="md"
      >
        {editingRule && (
          <div className="mb-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm sm:grid-cols-2">
            <div>
              <span className="block text-xs uppercase tracking-[0.2em] text-slate-400">
                Alcance
              </span>
              <span className="mt-1 block text-slate-100">
                {editingRule.nivel_key || "línea"} · {editingRule.modalidad_key || "modalidad"} · {priceScopeLabel(editingRule)} · plan {editingRule.plan || "—"}
              </span>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-[0.2em] text-slate-400">
                Precio actual
              </span>
              <span className="mt-1 block font-mono font-semibold text-slate-100">
                {fmt(editingRule.basePriceMxn)}
              </span>
            </div>
          </div>
        )}

        {saveState?.ok === false && saveState.error ? (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {saveState.error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
              {editingRule?.id === "new:program-price" ? (
                <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 sm:col-span-2">
                    Alcance del precio
                    <select
                      name="priceScopePreset"
                      value={newPriceScopePreset}
                      onChange={(event) =>
                        setNewPriceScopePreset(event.target.value as AdminPriceScopePreset)
                      }
                      className="ui-control text-sm normal-case tracking-normal"
                    >
                      {PRICE_SCOPE_PRESETS.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] normal-case tracking-normal text-slate-300">
                      {describeAdminPriceScopePreset(newPriceScopePreset)}
                    </span>
                  </label>
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Línea
                    <input
                      name="nivel_key"
                      defaultValue={editingRule.nivel_key}
                      className="ui-control text-sm normal-case tracking-normal"
                      placeholder="salud, licenciatura, posgrado..."
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Modalidad
                    <input
                      name="modalidad_key"
                      defaultValue={editingRule.modalidad_key}
                      className="ui-control text-sm normal-case tracking-normal"
                      placeholder="presencial, mixta u online"
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Plan / duración
                    <input
                      name="plan"
                      defaultValue={editingRule.plan}
                      className="ui-control text-sm normal-case tracking-normal"
                      placeholder="9, 11, 4..."
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Módulo
                    <select
                      name="module"
                      defaultValue={editingRule.module}
                      className="ui-control text-sm normal-case tracking-normal"
                      required
                    >
                      {ACADEMIC_MODULES.map((module) => (
                        <option key={module} value={module}>
                          {module}
                        </option>
                      ))}
                    </select>
                  </label>
                  {showProgramInput ? (
                    <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Programa
                      <input
                        name="programa_key"
                        defaultValue={editingRule.programa_key ?? ""}
                        className="ui-control text-sm normal-case tracking-normal"
                        placeholder="psicologia"
                        required
                      />
                    </label>
                  ) : null}
                  {showPlantelInput ? (
                    <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Plantel
                      <input
                        name="plantel"
                        defaultValue={editingRule.plantel ?? ""}
                        className="ui-control text-sm normal-case tracking-normal"
                        placeholder="Hermosillo"
                        required
                      />
                    </label>
                  ) : null}
                  {showTierInput ? (
                    <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Tier
                      <input
                        name="tier"
                        defaultValue={editingRule.tier ?? ""}
                        className="ui-control text-sm normal-case tracking-normal"
                        placeholder="T3"
                        required
                      />
                    </label>
                  ) : null}
                  {showPlantelInput ? (
                    <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 sm:col-span-2">
                      Región
                      <input
                        name="region"
                        defaultValue={editingRule.region ?? ""}
                        className="ui-control text-sm normal-case tracking-normal"
                        placeholder="Opcional"
                      />
                    </label>
                  ) : null}
                </div>
              ) : (
                <>
                  <input type="hidden" name="priceScopePreset" value={editingRule ? priceScopePresetForRow(editingRule) : "general"} />
                  <input type="hidden" name="programa_key" value={editingRule?.programa_key ?? ""} />
                  <input type="hidden" name="region" value={editingRule?.region ?? ""} />
                  <input type="hidden" name="plantel" value={editingRule?.plantel ?? ""} />
                  <input type="hidden" name="nivel_key" value={editingRule?.nivel_key ?? ""} />
                  <input
                    type="hidden"
                    name="modalidad_key"
                    value={editingRule?.modalidad_key ?? ""}
                  />
                  <input type="hidden" name="plan" value={editingRule?.plan ?? ""} />
                  <input type="hidden" name="module" value={editingRule?.module ?? "Longitudinal"} />
                  <input type="hidden" name="tier" value={editingRule?.tier ?? ""} />
                </>
              )}
              <input type="hidden" name="existingId" value={editingOverride?.id ?? ""} />

              <label className="grid gap-2 text-sm">
                Nuevo precio lista (MXN)
                <input
                  name="newPrice"
                  type="number"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="ui-control"
                  placeholder="0.00"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm">
                Precio por materia (MXN, opcional)
                <input
                  name="subjectPrice"
                  type="number"
                  step="0.01"
                  value={subjectPrice}
                  onChange={(e) => setSubjectPrice(e.target.value)}
                  className="ui-control"
                  placeholder="Sin precio por materia"
                />
                <span className="text-xs text-slate-400">
                  Se usa en Regresos cuando se indique el número de materias inscritas.
                </span>
              </label>

              <div className="sticky bottom-0 z-10 -mx-1 bg-slate-950/95 px-1 pt-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-2xl bg-blue-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar precio lista"}
                </button>
              </div>
        </form>
      </AdminDialogShell>
    </section>
  );
}
