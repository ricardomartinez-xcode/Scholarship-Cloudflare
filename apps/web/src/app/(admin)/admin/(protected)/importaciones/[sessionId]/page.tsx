import { AdminCapability } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAdminConfigModuleMeta } from "@/lib/admin-config-modules";
import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { getAdminImportSession } from "@/lib/importers/admin-import-sessions";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ sessionId: string }>;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX");
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const isEmpty =
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0);

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{title}</div>
          <div className="mt-1 text-sm text-slate-500">{isEmpty ? "Sin datos registrados" : "Payload capturado"}</div>
        </div>
      </div>
      <pre className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-slate-200">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm text-slate-200">{value || "—"}</div>
    </div>
  );
}

export default async function ImportSessionDetailPage({ params }: { params: PageParams }) {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);

  const { sessionId } = await params;
  const session = await getAdminImportSession({ sessionId });
  if (!session) notFound();

  const moduleMeta = getAdminConfigModuleMeta(session.module);

  return (
    <div className="grid gap-6 p-6">
      <section className="ui-card ui-card-pad">
        <Link href="/admin/importaciones" className="text-sm text-cyan-200 transition hover:text-cyan-100">
          ← Volver a importaciones
        </Link>
        <div className="mt-4 text-xs uppercase tracking-[0.28em] text-slate-400">Detalle de sesión</div>
        <h1 className="mt-1 text-xl font-semibold">{session.fileName ?? "Importación sin archivo"}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Revisión técnica de la sesión de importación. Aquí puedes auditar el preview validado, payload aplicado,
          warnings, errores, snapshots y resultado.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Resumen</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <MetaItem label="ID" value={session.id} />
            <MetaItem label="Módulo" value={`${moduleMeta.label} · ${session.module}`} />
            <MetaItem label="Estado" value={session.status} />
            <MetaItem label="Origen" value={session.source} />
            <MetaItem label="Creada" value={formatDate(session.createdAt)} />
            <MetaItem label="Actualizada" value={formatDate(session.updatedAt)} />
            <MetaItem label="Creada por" value={session.createdByEmail} />
            <MetaItem label="Aplicada por" value={session.appliedByEmail} />
            <MetaItem label="Aplicada" value={formatDate(session.appliedAt)} />
            <MetaItem label="Rollback" value={formatDate(session.rolledBackAt)} />
            <MetaItem label="Versión aplicada" value={session.appliedVersionId} />
            <MetaItem label="Versión rollback" value={session.rolledBackVersionId} />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Archivo</div>
          <div className="mt-4 space-y-3">
            <MetaItem label="Nombre" value={session.fileName} />
            <MetaItem label="Checksum" value={session.fileChecksum} />
          </div>
          <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">
            Esta vista es de auditoría. La acción de rollback operativo queda para la Fase 5C.
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <JsonBlock title="Warnings" value={session.warnings} />
        <JsonBlock title="Errores" value={session.errors} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <JsonBlock title="Preview" value={session.preview} />
        <JsonBlock title="Resultado / summary" value={session.result ?? session.summary} />
      </section>

      <JsonBlock title="Payload preparado" value={session.payload} />

      <section className="grid gap-4 xl:grid-cols-2">
        <JsonBlock title="Snapshot antes" value={session.beforeSnapshot} />
        <JsonBlock title="Snapshot después" value={session.afterSnapshot} />
      </section>
    </div>
  );
}
