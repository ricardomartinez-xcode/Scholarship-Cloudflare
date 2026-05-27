import { AdminCapability } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAdminConfigModuleMeta } from "@/lib/admin-config-modules";
import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { buildImportDiffSummary } from "@/lib/importers/admin-import-diff";
import { getAdminImportSession } from "@/lib/importers/admin-import-sessions";
import { canRollbackAdminImportSession } from "@/lib/importers/admin-import-rollbacks";
import { rollbackImportSessionAction } from "./actions";

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
  const canRollback = canRollbackAdminImportSession(session);

  const diffSummary = buildImportDiffSummary({
    beforeSnapshot: session.beforeSnapshot,
    afterSnapshot: session.afterSnapshot,
    preview: session.preview,
    result: session.result,
  });

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

      <section className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-cyan-200">Diff preview</div>
            <h2 className="mt-1 text-lg font-semibold text-white">Resumen preliminar de cambios</h2>
          </div>
          <div className="rounded-2xl border border-cyan-500/30 bg-black/20 px-4 py-2 text-xs text-cyan-100">
            Comparados: {diffSummary.totalCompared}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <MetaItem label="Nuevos" value={String(diffSummary.added)} />
          <MetaItem label="Actualizados" value={String(diffSummary.updated)} />
          <MetaItem label="Eliminados" value={String(diffSummary.removed)} />
          <MetaItem label="Sin cambios" value={String(diffSummary.unchanged)} />
        </div>

        <ul className="mt-4 grid gap-2 text-sm text-cyan-50/90">
          {diffSummary.notes.map((note) => (
            <li key={note} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
              {note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
