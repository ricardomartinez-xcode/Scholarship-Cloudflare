import { AdminCapability, AdminConfigModule, AdminImportSessionStatus } from "@prisma/client";
import Link from "next/link";

import { getAdminConfigModuleMeta } from "@/lib/admin-config-modules";
import { requireAdminCapabilityUser } from "@/lib/admin-session";
import {
  listAdminImportSessions,
  type AdminImportSessionSerialized,
} from "@/lib/importers/admin-import-sessions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const MODULE_OPTIONS = Object.values(AdminConfigModule);
const STATUS_OPTIONS = Object.values(AdminImportSessionStatus);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseModule(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return MODULE_OPTIONS.includes(normalized as AdminConfigModule) ? (normalized as AdminConfigModule) : null;
}

function parseStatus(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return STATUS_OPTIONS.includes(normalized as AdminImportSessionStatus)
    ? (normalized as AdminImportSessionStatus)
    : null;
}

function parseLimit(value: string | undefined) {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(Math.trunc(parsed), 10), 100);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX");
}

function formatChecksum(value: string | null) {
  if (!value) return "—";
  return value.length > 16 ? `${value.slice(0, 16)}…` : value;
}

function jsonCount(value: unknown) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length;
  return 1;
}

function statusLabel(status: AdminImportSessionStatus) {
  const labels: Record<AdminImportSessionStatus, string> = {
    preview: "Preview",
    applied: "Aplicada",
    failed: "Fallida",
    rolled_back: "Rollback",
  };
  return labels[status] ?? status;
}

function StatusBadge({ status }: { status: AdminImportSessionStatus }) {
  const classes: Record<AdminImportSessionStatus, string> = {
    preview: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
    applied: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    failed: "border-red-500/30 bg-red-500/10 text-red-100",
    rolled_back: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        classes[status] ?? "border-white/10 bg-white/10 text-slate-100"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{helper}</div>
    </div>
  );
}

function buildFilterHref(params: { module: AdminConfigModule | null; status: AdminImportSessionStatus | null; limit: number }) {
  const search = new URLSearchParams();
  if (params.module) search.set("module", params.module);
  if (params.status) search.set("status", params.status);
  search.set("limit", String(params.limit));
  return `/admin/importaciones?${search.toString()}`;
}

function ImportSessionRow({ session }: { session: AdminImportSessionSerialized }) {
  const moduleMeta = getAdminConfigModuleMeta(session.module);
  const warnings = jsonCount(session.warnings);
  const errors = jsonCount(session.errors);
  const resultItems = jsonCount(session.result ?? session.summary);

  return (
    <tr className="border-t border-white/10 align-top">
      <td className="p-3 text-slate-300">{formatDate(session.createdAt)}</td>
      <td className="p-3">
        <div className="font-medium text-slate-100">{moduleMeta.label}</div>
        <div className="mt-1 text-xs text-slate-500">{session.module}</div>
      </td>
      <td className="p-3">
        <StatusBadge status={session.status} />
      </td>
      <td className="p-3">
        <div className="max-w-[260px] truncate text-slate-200">{session.fileName ?? "Sin archivo"}</div>
        <div className="mt-1 text-xs text-slate-500">{formatChecksum(session.fileChecksum)}</div>
      </td>
      <td className="p-3 text-slate-300">
        <div>{session.createdByEmail ?? "—"}</div>
        {session.appliedByEmail ? <div className="mt-1 text-xs text-slate-500">Aplicó: {session.appliedByEmail}</div> : null}
      </td>
      <td className="p-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-100">warnings {warnings}</span>
          <span className="rounded-full bg-red-500/10 px-2 py-1 text-red-100">errores {errors}</span>
          <span className="rounded-full bg-white/10 px-2 py-1 text-slate-200">resultado {resultItems}</span>
        </div>
      </td>
      <td className="p-3 text-right">
        <Link
          href={`/admin/importaciones/${session.id}`}
          className="inline-flex rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
        >
          Ver detalle
        </Link>
      </td>
    </tr>
  );
}

export default async function ImportSessionsPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);

  const params = (await searchParams) ?? {};
  const module = parseModule(firstParam(params.module));
  const status = parseStatus(firstParam(params.status));
  const limit = parseLimit(firstParam(params.limit));

  const sessions = await listAdminImportSessions({ module, status, limit });

  const previewCount = sessions.filter((session) => session.status === AdminImportSessionStatus.preview).length;
  const appliedCount = sessions.filter((session) => session.status === AdminImportSessionStatus.applied).length;
  const failedCount = sessions.filter((session) => session.status === AdminImportSessionStatus.failed).length;
  const rolledBackCount = sessions.filter((session) => session.status === AdminImportSessionStatus.rolled_back).length;

  return (
    <div className="grid gap-6 p-6">
      <section className="ui-card ui-card-pad">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Importaciones</div>
        <h1 className="mt-1 text-xl font-semibold">Sesiones de importación</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Historial centralizado de previews, aplicaciones y rollbacks de archivos cargados desde el admin. Esta pantalla
          usa la base común de sesiones para auditar qué se validó, quién lo hizo y qué resultado dejó.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Preview" value={previewCount} helper="Sesiones listas para revisión" />
        <MetricCard label="Aplicadas" value={appliedCount} helper="Cambios ya ejecutados" />
        <MetricCard label="Fallidas" value={failedCount} helper="Sesiones con errores" />
        <MetricCard label="Rollback" value={rolledBackCount} helper="Sesiones revertidas" />
      </section>

      <section className="ui-card ui-card-pad">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_120px_auto_auto]">
          <label className="grid gap-1 text-sm">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-400">Módulo</span>
            <select
              name="module"
              defaultValue={module ?? ""}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Todos</option>
              {MODULE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {getAdminConfigModuleMeta(option).label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-400">Estado</span>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {statusLabel(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-400">Límite</span>
            <input
              name="limit"
              type="number"
              min={10}
              max={100}
              defaultValue={limit}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <div className="flex items-end">
            <button className="w-full rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20">
              Filtrar
            </button>
          </div>

          <div className="flex items-end">
            <Link
              href="/admin/importaciones"
              className="w-full rounded-2xl border border-white/10 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Limpiar
            </Link>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
          <Link href={buildFilterHref({ module, status: AdminImportSessionStatus.preview, limit })} className="rounded-full border border-white/10 px-3 py-1 transition hover:bg-white/10">
            Ver previews
          </Link>
          <Link href={buildFilterHref({ module, status: AdminImportSessionStatus.failed, limit })} className="rounded-full border border-white/10 px-3 py-1 transition hover:bg-white/10">
            Ver fallidas
          </Link>
          <Link href={buildFilterHref({ module, status: AdminImportSessionStatus.applied, limit })} className="rounded-full border border-white/10 px-3 py-1 transition hover:bg-white/10">
            Ver aplicadas
          </Link>
        </div>
      </section>

      <section className="ui-card ui-card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Historial</div>
            <h2 className="mt-1 text-lg font-semibold">Sesiones recientes</h2>
          </div>
          <div className="text-sm text-slate-400">{sessions.length} registros</div>
        </div>

        <div className="mt-5 overflow-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-slate-950/40 text-slate-300">
              <tr>
                <th className="p-3 text-left font-semibold">Fecha</th>
                <th className="p-3 text-left font-semibold">Módulo</th>
                <th className="p-3 text-left font-semibold">Estado</th>
                <th className="p-3 text-left font-semibold">Archivo</th>
                <th className="p-3 text-left font-semibold">Usuario</th>
                <th className="p-3 text-left font-semibold">Resumen</th>
                <th className="p-3 text-right font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length ? (
                sessions.map((session) => <ImportSessionRow key={session.id} session={session} />)
              ) : (
                <tr>
                  <td className="p-6 text-center text-slate-400" colSpan={7}>
                    No hay sesiones de importación para los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
