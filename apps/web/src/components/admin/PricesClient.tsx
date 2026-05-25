"use client";

import { useEffect, useMemo, useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";

import AdminDialogShell from "@/components/admin/AdminDialogShell";
import { useAdminActionForm } from "@/components/admin/useAdminActionForm";
import {
  compareAdminPricingScope,
  formatAdminPricingPlantel,
  formatAdminPricingTier,
  normalizeAdminPricingRegion,
} from "@/lib/admin-pricing-display";

type BecaRule = {
  id: string;
  programa_key: string;
  nivel_key: string;
  modalidad_key: string;
  plan: string;
  tier: string | null;
  rango_min: number | null;
  rango_max: number | null;
  porcentaje: number | null;
  monto: number | null;
  basePriceMxn: number | null;
  origen: string | null;
};

type MontoOverride = {
  id: string;
  targetKeys: unknown;
  newPrice: unknown;
  isActive: boolean;
};

type PriceRow = {
  id: string;
  region: string | null;
  plantel: string | null;
  nivel_key: string;
  modalidad_key: string;
  plan: string;
  tier: string | null;
  basePriceMxn: number | null;
};

type ActionResult = { ok: boolean; error?: string };

type PriceImportPreviewRow = {
  rowNumber: number;
  action: "create" | "update" | "noop";
  region: string | null;
  plantel: string | null;
  programaKey: string | null;
  nivelKey: string;
  modalidadKey: string;
  plan: string;
  tier: string | null;
  newPrice: number;
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

const PAGE_SIZE = 20;

function normalizeTierKey(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function findOverride(rule: PriceRow, overrides: MontoOverride[]): MontoOverride | null {
  return (
    overrides.find((o) => {
      const keys = o.targetKeys as Record<string, string>;
      return (
        keys.nivel_key === rule.nivel_key &&
        keys.modalidad_key === rule.modalidad_key &&
        keys.plan === rule.plan &&
        normalizeTierKey(keys.tier) === normalizeTierKey(rule.tier)
      );
    }) ?? null
  );
}

function fmt(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `$${Number(v).toLocaleString("es-MX")}`;
}

export default function PricesClient({
  becaRules,
  montoOverrides,
  upsertMontoOverrideAction,
  deletePriceOverrideAction,
}: {
  becaRules: BecaRule[];
  montoOverrides: MontoOverride[];
  upsertMontoOverrideAction: (fd: FormData) => Promise<ActionResult>;
  deletePriceOverrideAction: (fd: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const priceRows = useMemo(() => {
    const rows = new Map<string, PriceRow>();
    for (const rule of becaRules) {
      const tier = normalizeTierKey(rule.tier);
      const key = [
        rule.nivel_key,
        rule.modalidad_key,
        rule.plan,
        tier ?? "",
      ].join("|");
      const current = rows.get(key);
      if (!current || current.basePriceMxn === null) {
        rows.set(key, {
          id: key,
          region: null,
          plantel: null,
          nivel_key: rule.nivel_key,
          modalidad_key: rule.modalidad_key,
          plan: rule.plan,
          tier,
          basePriceMxn: rule.basePriceMxn,
        });
      }
    }
    return Array.from(rows.values()).sort((a, b) => {
      const scope = compareAdminPricingScope(a, b);
      if (scope !== 0) return scope;
      return (
        [
          a.nivel_key.localeCompare(b.nivel_key),
          a.modalidad_key.localeCompare(b.modalidad_key),
          a.plan.localeCompare(b.plan, undefined, { numeric: true }),
        ].find((result) => result !== 0) ?? 0
      );
    });
  }, [becaRules]);

  const [filterNivel, setFilterNivel] = useState("");
  const [page, setPage] = useState(0);

  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PriceRow | null>(null);
  const [editingOverride, setEditingOverride] = useState<MontoOverride | null>(null);
  const [newPrice, setNewPrice] = useState("");

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
    "No fue posible guardar el ajuste."
  );

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
    setNewPrice(override ? String(override.newPrice) : String(rule.basePriceMxn ?? ""));
    setOpen(true);
  }

  function removeOverride(override: MontoOverride) {
    if (!window.confirm("¿Quitar el ajuste y volver al precio base?")) return;
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

  async function applyImportSession() {
    if (!importSessionId) return;
    setApplyImportLoading(true);
    setImportError(null);
    try {
      const response = await fetch(`/api/admin/prices/import/${importSessionId}/apply`, {
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

  return (
    <section className="ui-card ui-card-pad">
      <div className="ui-toolbar">
        <div>
          <h1 className="mt-1 text-lg font-semibold">Precios lista y ajustes</h1>
          <p className="mt-1 text-sm text-slate-300">
            Precios lista activos de la calculadora. Usa{" "}
            <strong className="text-slate-100">Editar</strong> para crear un ajuste sobre el
            precio lista. El badge{" "}
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
              Editado
            </span>{" "}
            indica que la calculadora usará el precio ajustado.
          </p>
        </div>
      </div>

      <section className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Importar precio lista
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
              onClick={applyImportSession}
              disabled={Boolean(
                !importSessionId || applyImportLoading || importSummary?.errors?.length,
              )}
              className="rounded-xl border border-emerald-500/40 bg-blue-950/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-blue-950/25 disabled:opacity-60"
            >
              {applyImportLoading ? "Aplicando..." : "Aplicar"}
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
            <div className="font-semibold text-slate-100">Orden canónico</div>
            <div className="mt-1 font-mono text-[11px]">
              Region | Plantel | Tier | Precio lista
            </div>
          </div>
          <div className="font-mono text-[11px] leading-5">
            region,plantel,tier,precio,nivel,modalidad,plan
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
              <div className="ui-table-wrap ui-scrollbar max-h-[360px]">
                <table className="ui-table ui-table--compact min-w-[940px]">
                  <thead>
                    <tr>
                      <th className="ui-cell-nowrap text-left">Fila</th>
                      <th className="ui-cell-nowrap text-left">Acción</th>
                      <th className="ui-cell-nowrap text-left">Region</th>
                      <th className="ui-cell-nowrap text-left">Plantel</th>
                      <th className="ui-cell-nowrap text-left">Tier</th>
                      <th className="ui-cell-nowrap text-right">Precio lista</th>
                      <th className="text-left">Detalle</th>
                      <th className="ui-cell-nowrap text-left">Activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreviewRows.slice(0, 40).map((row) => (
                      <tr key={`${row.rowNumber}-${row.plantel ?? "general"}-${row.plan}`}>
                        <td className="ui-cell-nowrap text-slate-200">{row.rowNumber}</td>
                        <td className="ui-cell-nowrap text-slate-200">{row.action}</td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {normalizeAdminPricingRegion(row.region)}
                        </td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {formatAdminPricingPlantel(row)}
                        </td>
                        <td className="ui-cell-nowrap text-slate-200">
                          {formatAdminPricingTier(row)}
                        </td>
                        <td className="ui-cell-nowrap text-right font-mono text-slate-100">
                          {fmt(row.newPrice)}
                        </td>
                        <td className="text-slate-200">
                          {row.nivelKey} · {row.modalidadKey} · plan {row.plan}
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
      <div className="ui-table-wrap ui-scrollbar mt-4 max-h-[620px]">
        <table className="ui-table min-w-[1120px]">
          <thead>
            <tr>
              <th className="ui-cell-nowrap text-left">Region</th>
              <th className="ui-cell-nowrap text-left">Plantel</th>
              <th className="ui-cell-nowrap text-left">Tier</th>
              <th className="ui-cell-nowrap text-right">Precio lista</th>
              <th className="ui-cell-nowrap text-left">Nivel</th>
              <th className="ui-cell-nowrap text-left">Modalidad</th>
              <th className="ui-cell-nowrap text-left">Plan</th>
              <th className="ui-cell-nowrap text-right">Ajuste activo</th>
              <th className="ui-cell-nowrap text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? (
              pageRows.map((rule) => {
                const override = findOverride(rule, montoOverrides);
                return (
                  <tr key={rule.id}>
                    <td className="ui-cell-nowrap text-slate-200">
                      {normalizeAdminPricingRegion(rule.region)}
                    </td>
                    <td className="ui-cell-nowrap text-slate-200">
                      {formatAdminPricingPlantel(rule)}
                    </td>
                    <td className="ui-cell-nowrap text-xs text-slate-300">
                      {formatAdminPricingTier(rule)}
                    </td>
                    <td className="ui-cell-nowrap text-right font-mono text-slate-100">
                      {fmt(rule.basePriceMxn)}
                    </td>
                    <td className="ui-cell-nowrap text-slate-200">{rule.nivel_key}</td>
                    <td className="ui-cell-nowrap text-slate-200">{rule.modalidad_key}</td>
                    <td className="ui-cell-nowrap text-xs text-slate-300">
                      {rule.plan}
                    </td>
                    <td className="ui-cell-nowrap text-right">
                      {override ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span className="font-mono text-emerald-300">
                            {fmt(Number(override.newPrice))}
                          </span>
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            Editado
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-500 whitespace-nowrap">—</span>
                      )}
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
                        {override && (
                          <button
                            type="button"
                            disabled={deleteTransition}
                            onClick={() => removeOverride(override)}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 whitespace-nowrap"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="text-slate-400" colSpan={9}>
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

      {/* Edit / Create Override Dialog */}
      <AdminDialogShell
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            clearSaveState();
          }
        }}
        kicker={editingOverride ? "Modificar ajuste" : "Nuevo ajuste"}
        title="Ajuste de precio lista"
        description={
          editingRule
            ? `${editingRule.nivel_key} · ${editingRule.modalidad_key} · ${editingRule.plan}/${editingRule.tier ?? "General"}`
            : "Actualiza el precio lista que usará la calculadora."
        }
        size="md"
      >
        {editingRule && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <span className="text-slate-400">Precio lista actual: </span>
            <span className="font-mono font-semibold text-slate-100">
              {fmt(editingRule.basePriceMxn)}
            </span>
          </div>
        )}

        {saveState?.ok === false && saveState.error ? (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {saveState.error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
              <input type="hidden" name="programa_key" value="" />
              <input type="hidden" name="nivel_key" value={editingRule?.nivel_key ?? ""} />
              <input
                type="hidden"
                name="modalidad_key"
                value={editingRule?.modalidad_key ?? ""}
              />
              <input type="hidden" name="plan" value={editingRule?.plan ?? ""} />
              <input type="hidden" name="tier" value={editingRule?.tier ?? ""} />
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

              <div className="sticky bottom-0 z-10 -mx-1 bg-slate-950/95 px-1 pt-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-2xl bg-blue-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar ajuste"}
                </button>
              </div>
        </form>
      </AdminDialogShell>
    </section>
  );
}
