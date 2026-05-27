import { AdminCapability } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAdminConfigModuleMeta } from "@/lib/admin-config-modules";
import { requireAdminCapabilityUser } from "@/lib/admin-session";
import {
  buildImportDiffSummary,
  type ImportDiffExample,
} from "@/lib/importers/admin-import-diff";
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

const DIFF_KIND_META = {
  added: { label: "Nuevo", className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" },
  updated: { label: "Actualizado", className: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100" },
  removed: { label: "Eliminado", className: "border-rose-400/20 bg-rose-400/10 text-rose-100" },
} satisfies Record<ImportDiffExample["kind"], { label: string; className: string }>;

function DiffExampleList({ examples }: { examples: ImportDiffExample[] }) {
  if (!examples.length) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-400">
        No hay ejemplos de cambios para mostrar con la estructura comparable disponible.
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-2">
      <div className="text-xs uppercase tracking-[0.22em] text-cyan-200">Cambios detectados</div>
      {examples.map((example) => {
        const meta = DIFF_KIND_META[example.kind];
        return (
          <div
            key={`${example.kind}-${example.key}-${example.label}`}
            className="rounded-2xl border border-white/10 bg-black/20 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}>
                {meta.label}
              </span>
              <span className="break-words text-sm font-medium text-slate-100">{example.label}</span>
            </div>
            <div className="mt-2 break-all font-mono text-[11px] text-slate-500">{example.key}</div>
          </div>
        );
      })}
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
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Detalle de sesión</div>
            <h1 className="mt-1 text-xl font-semibold">{session.fileName ?? "Importación sin archivo"}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              {moduleMeta.label}: {moduleMeta.description}
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
            {session.status}
          </span>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetaItem label="Módulo" value={moduleMeta.label} />
        <MetaItem label="Origen" value={session.source} />
        <MetaItem label="Creada" value={formatDate(session.createdAt)} />
        <MetaItem label="Aplicada" value={formatDate(session.appliedAt)} />
        <MetaItem label="Creada por" value={session.createdByEmail} />
        <MetaItem label="Aplicada por" value={session.appliedByEmail} />
        <MetaItem label="Checksum" value={session.fileChecksum} />
        <MetaItem label="Versión aplicada" value={session.appliedVersionId} />
      </section>

      {canRollback ? (
        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-amber-100">Rollback disponible</div>
              <p className="mt-2 max-w-3xl text-sm text-amber-50/80">
                Esta sesión tiene snapshot anterior y puede restaurarse desde el historial operativo.
              </p>
            </div>
            <form action={rollbackImportSessionAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <button className="rounded-2xl border border-amber-200/30 bg-amber-200/10 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-200/20">
                Restaurar snapshot anterior
              </button>
            </form>
          </div>
        </section>
      ) : null}

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

        <DiffExampleList examples={diffSummary.examples} />

        <ul className="mt-4 grid gap-2 text-sm text-cyan-50/90">
          {diffSummary.notes.map((note) => (
            <li key={note} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
              {note}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <JsonBlock title="Preview validado" value={session.preview} />
        <JsonBlock title="Payload preparado" value={session.payload} />
        <JsonBlock title="Warnings" value={session.warnings} />
        <JsonBlock title="Errores" value={session.errors} />
        <JsonBlock title="Resultado" value={session.result} />
        <JsonBlock title="Resumen" value={session.summary} />
        <JsonBlock title="Before snapshot" value={session.beforeSnapshot} />
        <JsonBlock title="After snapshot" value={session.afterSnapshot} />
      </section>
    </div>
  );
}
