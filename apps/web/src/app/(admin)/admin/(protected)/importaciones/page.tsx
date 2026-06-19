import { AdminCapability, AdminConfigModule, AdminImportSessionStatus } from "@prisma/client";
import Link from "next/link";

import AdminDataTable from "@/components/admin/AdminDataTable";
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

const IMPORT_STEPS = [
  {
    label: "1. Origen",
    title: "Prepara o ubica el archivo",
    description: "Sube un archivo local en el importador del módulo, o sincroniza primero assets existentes desde R2.",
  },
  {
    label: "2. Destino",
    title: "Elige qué catálogo cambia",
    description: "Cada destino abre directamente su importador real con la pestaña correcta lista para validar.",
  },
  {
    label: "3. Control",
    title: "Valida, aplica y audita",
    description: "Mantén preview, aplicación, rollback e historial en el flujo existente de cada módulo.",
  },
];

const IMPORT_TARGETS = [
  {
    label: "Precio lista",
    description: "Carga CSV/XLSX con alcance, programa, línea, modalidad, plan, módulo, tier y precio normalizados.",
    href: "/admin/prices?panel=imports",
    format: "XLSX / CSV",
    action: "Importar precios",
    templateId: "prices",
  },
  {
    label: "Beneficios adicionales",
    description: "Importa porcentajes extra o primer pago con los mismos tipos, ingresos y estados que la captura manual.",
    href: "/admin/benefits?panel=imports",
    format: "CSV",
    action: "Importar beneficios",
    templateId: "benefits",
  },
  {
    label: "% de beca por promedio",
    description: "Actualiza reglas base por promedio, línea, modalidad, plan, programa, plantel y tier.",
    href: "/admin/benefits?panel=base",
    format: "CSV",
    action: "Importar becas base",
    templateId: "base-scholarships",
  },
  {
    label: "Oferta académica",
    description: "Administra programas académicos, datos base y assets R2 de planes o brochures.",
    href: "/admin/unidep/programs",
    format: "Catálogo / R2",
    action: "Administrar oferta académica",
  },
  {
    label: "Oferta por planteles",
    description: "Valida oferta activa por campus, programa, ciclo, línea, modalidad, plan, módulos y horarios.",
    href: "/admin/oferta?panel=imports",
    format: "XLSX / CSV",
    action: "Importar oferta",
    templateId: "academic-offer",
  },
  {
    label: "Planteles",
    description: "Actualiza dirección, teléfono y WhatsApp de campus existentes.",
    href: "/admin/unidep/campuses#importacion",
    format: "CSV / XLSX",
    action: "Importar planteles",
  },
  {
    label: "Costos académicos",
    description: "Carga costos base y disponibilidad/costo por plantel; Todos actualiza solo el costo base.",
    href: "/admin/unidep/fees?tab=seed&seedMode=unified",
    format: "CSV",
    action: "Importar costos",
    templateId: "academic-fees",
  },
];

const GLOBAL_INPUT_CONTRACT = [
  {
    label: "Estados",
    value: "Activo/Inactivo, true/false, si/no, 1/0",
  },
  {
    label: "Líneas",
    value: "licenciatura, salud, preparatoria/bachillerato, posgrado/maestría",
  },
  {
    label: "Modalidades",
    value: "presencial/escolarizada, ejecutiva/mixta, online/en línea",
  },
  {
    label: "Alcances",
    value: "Todos/General omite dimensión; programa, plantel y tier se normalizan por aliases",
  },
  {
    label: "Números",
    value: "precios, porcentajes y promedios aceptan punto o coma decimal, sin símbolos requeridos",
  },
];

function ImportStepCard({ step }: { step: (typeof IMPORT_STEPS)[number] }) {
  return (
    <article className="rounded-[22px] border border-[#c8d6e2] bg-[#f7fafc] p-4">
      <div className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-[#0f4c6b]">
        {step.label}
      </div>
      <h2 className="mt-2 text-base font-black tracking-[-0.03em] text-[#102838]">{step.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#536a7c]">{step.description}</p>
    </article>
  );
}

function ImportTargetCard({ target }: { target: (typeof IMPORT_TARGETS)[number] }) {
  return (
    <article className="grid gap-4 rounded-[22px] border border-[#c8d6e2] bg-white p-4 shadow-[0_10px_30px_rgb(16_32_42/0.04)]">
      <div>
        <div className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">
          {target.format}
        </div>
        <h3 className="mt-2 text-lg font-black tracking-[-0.035em] text-[#102838]">
          {target.label}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#536a7c]">{target.description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={target.href}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-4 text-sm font-extrabold text-white transition hover:bg-[#0b3d56]"
        >
          {target.action}
        </Link>
        {"templateId" in target && target.templateId ? (
          <a
            href={`/api/admin/import-templates/${target.templateId}`}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#c8d6e2] bg-[#f7fafc] px-4 text-sm font-extrabold text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10"
          >
            Plantilla
          </a>
        ) : null}
      </div>
    </article>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseModule(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return MODULE_OPTIONS.includes(normalized as AdminConfigModule)
    ? (normalized as AdminConfigModule)
    : null;
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
    preview: "border-[#0f4c6b]/24 bg-[#0f4c6b]/10 text-[#0f4c6b]",
    applied: "border-[#0c5f3a]/22 bg-[#ddf8ea] text-[#0c5f3a]",
    failed: "border-[#8a2d2d]/22 bg-[#fde7e7] text-[#8a2d2d]",
    rolled_back: "border-[#7a4a00]/22 bg-[#fff3d6] text-[#7a4a00]",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${classes[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

function MetricCard({ label, value, helper, tone = "neutral" }: { label: string; value: number; helper: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const valueClass =
    tone === "success"
      ? "text-[#0c5f3a]"
      : tone === "warning"
        ? "text-[#7a4a00]"
        : tone === "danger"
          ? "text-[#8a2d2d]"
          : "text-[#102838]";

  return (
    <div className="rounded-[24px] border border-[#c8d6e2] bg-white p-4 shadow-[0_12px_34px_rgb(16_32_42/0.05)]">
      <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-black tracking-[-0.04em] ${valueClass}`}>
        {value}
      </div>
      <div className="mt-1 text-sm leading-5 text-[#536a7c]">{helper}</div>
    </div>
  );
}

function CountPill({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warning" | "danger" | "success" }) {
  const classes =
    tone === "danger"
      ? "border-[#8a2d2d]/22 bg-[#fde7e7] text-[#8a2d2d]"
      : tone === "warning"
        ? "border-[#7a4a00]/22 bg-[#fff3d6] text-[#7a4a00]"
        : tone === "success"
          ? "border-[#0c5f3a]/22 bg-[#ddf8ea] text-[#0c5f3a]"
          : "border-[#c8d6e2] bg-[#f7fafc] text-[#163247]";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${classes}`}>
      {label} {value}
    </span>
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
    <tr>
      <td>{formatDate(session.createdAt)}</td>
      <td>
        <div className="font-extrabold text-[#102838]">{moduleMeta.label}</div>
        <div className="mt-1 text-xs font-semibold text-[#536a7c]">{session.module}</div>
      </td>
      <td>
        <StatusBadge status={session.status} />
      </td>
      <td>
        <div className="max-w-[300px] truncate font-semibold text-[#163247]" title={session.fileName ?? "Sin archivo"}>
          {session.fileName ?? "Sin archivo"}
        </div>
        <div className="mt-1 text-xs font-semibold text-[#536a7c]">{formatChecksum(session.fileChecksum)}</div>
      </td>
      <td>
        <div className="font-semibold text-[#163247]">{session.createdByEmail ?? "—"}</div>
        {session.appliedByEmail ? (
          <div className="mt-1 text-xs font-semibold text-[#536a7c]">Aplicó: {session.appliedByEmail}</div>
        ) : null}
      </td>
      <td>
        <div className="flex flex-wrap gap-2">
          <CountPill label="warnings" value={warnings} tone={warnings ? "warning" : "neutral"} />
          <CountPill label="errores" value={errors} tone={errors ? "danger" : "neutral"} />
          <CountPill label="resultado" value={resultItems} tone="success" />
        </div>
      </td>
      <td>
        <Link
          href={`/admin/importaciones/${session.id}`}
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-[#0f4c6b]/28 bg-[#0f4c6b]/10 px-3 text-xs font-extrabold text-[#0f4c6b] transition hover:border-[#0f4c6b]/44 hover:bg-[#0f4c6b]/15"
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
  const moduleFilter = parseModule(firstParam(params.module));
  const status = parseStatus(firstParam(params.status));
  const limit = parseLimit(firstParam(params.limit));

  const sessions = await listAdminImportSessions({ module: moduleFilter, status, limit });

  const previewCount = sessions.filter((session) => session.status === AdminImportSessionStatus.preview).length;
  const appliedCount = sessions.filter((session) => session.status === AdminImportSessionStatus.applied).length;
  const failedCount = sessions.filter((session) => session.status === AdminImportSessionStatus.failed).length;
  const rolledBackCount = sessions.filter((session) => session.status === AdminImportSessionStatus.rolled_back).length;

  return (
    <div className="grid gap-5 p-4 sm:p-5 lg:p-6">
      <section className="rounded-[28px] border border-[#c8d6e2] bg-white p-5 shadow-[0_18px_60px_rgb(16_32_42/0.07)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
              Importaciones
            </div>
            <h1 className="mt-2 max-w-4xl text-3xl font-black leading-tight tracking-[-0.055em] text-[#102838] md:text-4xl">
              Centro de importación.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#536a7c]">
              Punto único para decidir qué documento vas a cargar, abrir el importador correcto y conservar la auditoría de previews, aplicaciones y rollback en la misma vista.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/importaciones/plantillas"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#c8d6e2] bg-white px-4 text-sm font-extrabold text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10"
            >
              Plantillas
            </Link>
            <Link
              href="/admin/importaciones/flujo-publicacion"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-4 text-sm font-extrabold text-white transition hover:bg-[#0b3d56]"
            >
              Flujo publicación
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {IMPORT_STEPS.map((step) => (
          <ImportStepCard key={step.label} step={step} />
        ))}
      </section>

      <section className="rounded-[26px] border border-[#c8d6e2] bg-[#f7fafc] p-5">
        <div className="mb-4">
          <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
            Contrato global
          </div>
          <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[#102838]">
            La captura manual y los importadores leen las mismas entradas
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {GLOBAL_INPUT_CONTRACT.map((item) => (
            <div key={item.label} className="rounded-[18px] border border-[#c8d6e2] bg-white p-3">
              <div className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-[#0f4c6b]">
                {item.label}
              </div>
              <div className="mt-2 text-sm font-semibold leading-5 text-[#163247]">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[26px] border border-[#c8d6e2] bg-white p-5 shadow-[0_16px_50px_rgb(16_32_42/0.06)]">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
              Importar documento
            </div>
            <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[#102838]">
              Elige el destino y valida ahí mismo
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#536a7c]">
              Ya no necesitas buscar la sección correcta. Estos accesos abren el módulo con su panel de importación listo para seleccionar archivo, previsualizar y aplicar.
            </p>
          </div>
          <Link
            href="/admin/files"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#c8d6e2] bg-[#f7fafc] px-4 text-sm font-extrabold text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10"
          >
            Revisar archivos R2
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {IMPORT_TARGETS.map((target) => (
            <ImportTargetCard key={target.href} target={target} />
          ))}
        </div>
      </section>

      <section className="rounded-[26px] border border-[#c8d6e2] bg-[#f7fafc] p-5">
        <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
          R2 como origen
        </div>
        <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[#102838]">
          Si el archivo ya está en el bucket, primero sincroniza o relaciónalo
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[#536a7c]">
          Archivos R2 administra assets y materiales. Para que un importador los use, el archivo debe estar registrado o descargarse desde R2 y después cargarse en el destino operativo. Para capacitación, selecciona `Material de capacitación` y un uso de material desde Archivos R2.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Preview" value={previewCount} helper="Sesiones listas para revisión" />
        <MetricCard label="Aplicadas" value={appliedCount} helper="Cambios ejecutados" tone="success" />
        <MetricCard label="Fallidas" value={failedCount} helper="Sesiones con errores" tone="danger" />
        <MetricCard label="Rollback" value={rolledBackCount} helper="Sesiones revertidas" tone="warning" />
      </section>

      <section className="rounded-[26px] border border-[#c8d6e2] bg-white p-5 shadow-[0_16px_50px_rgb(16_32_42/0.06)]">
        <div className="mb-5">
          <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
            Filtros
          </div>
          <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[#102838]">Explorar sesiones</h2>
          <p className="mt-2 text-sm leading-6 text-[#536a7c]">
            Reduce la vista por módulo, estado y cantidad máxima de registros para evitar tablas largas.
          </p>
        </div>

        <form className="grid gap-3 md:grid-cols-[1fr_1fr_120px_auto_auto]">
          <label className="grid gap-1 text-sm">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-400">Módulo</span>
            <select
              name="module"
              defaultValue={moduleFilter ?? ""}
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

          <label className="grid gap-2 text-sm font-bold text-[#163247]">
            Estado
            <select name="status" defaultValue={status ?? ""} className="ui-control">
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {statusLabel(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold text-[#163247]">
            Límite
            <input name="limit" type="number" min={10} max={100} defaultValue={limit} className="ui-control" />
          </label>

          <div className="flex items-end">
            <button className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-4 text-sm font-extrabold text-white transition hover:bg-[#0b3d56]">
              Filtrar
            </button>
          </div>

          <div className="flex items-end">
            <Link
              href="/admin/importaciones"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#c8d6e2] bg-white px-4 text-center text-sm font-extrabold text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10"
            >
              Limpiar
            </Link>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
          <Link href={buildFilterHref({ module: moduleFilter, status: AdminImportSessionStatus.preview, limit })} className="rounded-full border border-white/10 px-3 py-1 transition hover:bg-white/10">
            Ver previews
          </Link>
          <Link href={buildFilterHref({ module: moduleFilter, status: AdminImportSessionStatus.failed, limit })} className="rounded-full border border-white/10 px-3 py-1 transition hover:bg-white/10">
            Ver fallidas
          </Link>
          <Link href={buildFilterHref({ module: moduleFilter, status: AdminImportSessionStatus.applied, limit })} className="rounded-full border border-white/10 px-3 py-1 transition hover:bg-white/10">
            Ver aplicadas
          </Link>
        </div>
      </section>

      <section className="rounded-[26px] border border-[#c8d6e2] bg-white p-5 shadow-[0_16px_50px_rgb(16_32_42/0.06)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
              Historial
            </div>
            <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[#102838]">Sesiones recientes</h2>
          </div>
          <div className="rounded-full border border-[#c8d6e2] bg-[#f7fafc] px-3 py-1 text-xs font-extrabold text-[#163247]">
            {sessions.length} registros
          </div>
        </div>

        <AdminDataTable
          title="Historial de importaciones"
          count={sessions.length}
          description="Tabla con scroll controlado para revisar estado, archivo, usuario, alertas y detalle."
          maxHeight="min(72dvh, 760px)"
        >
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Módulo</th>
                <th>Estado</th>
                <th>Archivo</th>
                <th>Usuario</th>
                <th>Resumen</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length ? (
                sessions.map((session) => <ImportSessionRow key={session.id} session={session} />)
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="rounded-[18px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-6 text-center text-sm text-[#536a7c]">
                      No hay sesiones de importación para los filtros actuales.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminDataTable>
      </section>
    </div>
  );
}
