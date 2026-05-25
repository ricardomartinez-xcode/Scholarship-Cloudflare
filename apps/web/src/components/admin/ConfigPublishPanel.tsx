"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminConfigModule } from "@prisma/client";

import type {
  ConfigDiffSummary,
  ConfigVersionListItem,
} from "@/lib/admin-config-snapshots";

type ConfigActionResult = {
  ok: boolean;
  error?: string;
};

const adminDateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "America/Mexico_City",
});

function formatDate(date: Date | string | null) {
  if (!date) return "Nunca";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "Fecha inválida";
  return adminDateFormatter.format(value);
}

function diffTone(kind: "added" | "removed" | "changed") {
  if (kind === "added") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (kind === "removed") return "border-red-200 bg-red-50 text-red-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export default function ConfigPublishPanel({
  module,
  title,
  description,
  canPublish,
  state,
  publishConfigModuleAction,
  rollbackConfigVersionAction,
}: {
  module: AdminConfigModule;
  title: string;
  description: string;
  canPublish: boolean;
  state: {
    draftCount: number;
    publishedCount: number;
    publishedVersionId: string | null;
    publishedAt: Date | null;
    publishedByEmail: string | null;
    diffSummary: ConfigDiffSummary;
    recentVersions: ConfigVersionListItem[];
  };
  publishConfigModuleAction: (formData: FormData) => Promise<ConfigActionResult>;
  rollbackConfigVersionAction: (formData: FormData) => Promise<ConfigActionResult>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishPending, startPublishTransition] = useTransition();
  const [repairPending, startRepairTransition] = useTransition();
  const [rollbackPendingId, setRollbackPendingId] = useState<string | null>(null);

  const diff = state.diffSummary;
  const hasDraftChanges = diff.added > 0 || diff.removed > 0 || diff.changed > 0;

  const recentVersions = useMemo(
    () => state.recentVersions.filter((version) => version.id !== state.publishedVersionId),
    [state.publishedVersionId, state.recentVersions],
  );

  function handlePublish() {
    setMessage(null);
    setError(null);
    startPublishTransition(async () => {
      const formData = new FormData();
      formData.set("module", module);
      const result = await publishConfigModuleAction(formData);
      if (!result.ok) {
        setError(result.error ?? "No fue posible publicar.");
        return;
      }
      setMessage("Snapshot publicado correctamente.");
      router.refresh();
    });
  }

  function handleRepairPublish() {
    setMessage(null);
    setError(null);
    startRepairTransition(async () => {
      const formData = new FormData();
      formData.set("module", module);
      formData.set("notes", "Reparar publicación: republicar snapshot draft actual.");
      const result = await publishConfigModuleAction(formData);
      if (!result.ok) {
        setError(result.error ?? "No fue posible reparar la publicación.");
        return;
      }
      setMessage("Publicación reparada con el snapshot actual.");
      router.refresh();
    });
  }

  function handleRollback(versionId: string) {
    setMessage(null);
    setError(null);
    setRollbackPendingId(versionId);
    void (async () => {
      try {
        const formData = new FormData();
        formData.set("module", module);
        formData.set("versionId", versionId);
        const result = await rollbackConfigVersionAction(formData);
        if (!result.ok) {
          setError(result.error ?? "No fue posible revertir.");
          return;
        }
        setMessage("Rollback lógico aplicado y republicado.");
        router.refresh();
      } finally {
        setRollbackPendingId(null);
      }
    })();
  }

  return (
    <section className="ui-card ui-card-pad">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Draft / Publish</div>
          <h2 className="mt-1 text-lg font-semibold">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-[color:var(--ui-text-secondary)]">
            {description}
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="min-w-0 rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-secondary)] px-4 py-3 text-sm text-[color:var(--ui-text-secondary)]">
            <div>
              Live:{" "}
              <span className="font-semibold text-[color:var(--ui-text-primary)]">
                {state.publishedVersionId ? state.publishedVersionId.slice(0, 8) : "fallback"}
              </span>
            </div>
            <div className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              {state.publishedVersionId
                ? `Publicado ${formatDate(state.publishedAt)}${
                    state.publishedByEmail ? ` por ${state.publishedByEmail}` : ""
                  }`
                : "Aún no existe snapshot publicado; la app sigue usando el estado actual como fallback."}
            </div>
          </div>

          <button
            type="button"
            disabled={!canPublish || publishPending || repairPending || !hasDraftChanges}
            onClick={handlePublish}
            className="ui-button-primary min-h-9 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishPending ? "Publicando..." : "Publicar draft"}
          </button>

          <button
            type="button"
            disabled={!canPublish || publishPending || repairPending}
            onClick={handleRepairPublish}
            title="Republica el snapshot actual aunque no haya diferencias visibles."
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {repairPending ? "Reparando..." : "Reparar publicación"}
          </button>
        </div>
      </div>

      {canPublish && !hasDraftChanges ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          No hay diferencias visibles. Si un rollback dejó la publicación bloqueada,
          <span className="font-semibold"> Reparar publicación </span>
          republica el snapshot actual.
        </div>
      ) : null}

      {!canPublish ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          Tu usuario puede editar draft, pero no tiene permisos para publicar o revertir snapshots.
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          {message}
        </div>
      ) : null}

      <div className="mt-5 grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.62fr)]">
        <div className="min-w-0 overflow-hidden rounded-3xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-secondary)] p-4">
          <div className="ui-shell-metric-grid ui-shell-metric-grid--three text-sm">
            <div className="ui-shell-metric">
              <div className="ui-shell-metric__label">Draft</div>
              <div className="ui-shell-metric__value">{state.draftCount}</div>
              <div className="ui-shell-metric__copy">Items listos para revisión</div>
            </div>
            <div className="ui-shell-metric">
              <div className="ui-shell-metric__label">Live</div>
              <div className="ui-shell-metric__value">{state.publishedCount}</div>
              <div className="ui-shell-metric__copy">Items visibles en producción</div>
            </div>
            <div className="ui-shell-metric">
              <div className="ui-shell-metric__label">Delta</div>
              <div className="ui-shell-metric__value">
                +{diff.added} / {diff.changed} / -{diff.removed}
              </div>
              <div className="ui-shell-metric__copy">Altas, cambios y bajas pendientes</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--ui-text-secondary)]">Diff visible</div>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              {hasDraftChanges
                ? "Esto es lo que cambiará en vivo al publicar."
                : "No hay diferencias entre el draft y la versión publicada."}
            </p>
          </div>

          {diff.examples.length ? (
            <div className="mt-4 grid gap-2">
              {diff.examples.map((example) => (
                <div
                  key={`${example.kind}:${example.key}`}
                  className={`rounded-2xl border px-3 py-2 text-sm ${diffTone(example.kind)}`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.2em]">
                    {example.kind === "added"
                      ? "Alta"
                      : example.kind === "removed"
                        ? "Baja"
                        : "Cambio"}
                  </div>
                  <div className="mt-1 font-medium">{example.label}</div>
                  <div className="mt-1 text-xs opacity-75">{example.key}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 overflow-hidden rounded-3xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-secondary)] p-4">
          <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--ui-text-secondary)]">Historial</div>
          <div className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
            Versiones recientes disponibles para rollback lógico.
          </div>

          <div className="mt-4 grid gap-3">
            {recentVersions.length ? (
              recentVersions.map((version) => {
                const versionDiff = version.diffSummary;
                return (
                  <div
                    key={version.id}
                    className="min-w-0 rounded-2xl border border-[color:var(--ui-border)] bg-white p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[color:var(--ui-text-primary)]">
                          {version.id.slice(0, 8)}
                        </div>
                        <div className="mt-1 break-words text-xs text-[color:var(--ui-text-secondary)]">
                          {formatDate(version.publishedAt ?? version.createdAt)}
                          {version.publishedByEmail ? ` · ${version.publishedByEmail}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canPublish || rollbackPendingId === version.id}
                        onClick={() => handleRollback(version.id)}
                        className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-secondary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ui-text-primary)] transition hover:bg-[color:var(--ui-surface-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {rollbackPendingId === version.id ? "Revirtiendo..." : "Rollback"}
                      </button>
                    </div>
                    {versionDiff ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-[color:var(--ui-text-primary)]">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1">
                          +{versionDiff.added}
                        </span>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1">
                          {versionDiff.changed} cambios
                        </span>
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1">
                          -{versionDiff.removed}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-[color:var(--ui-border)] bg-white px-3 py-4 text-sm text-[color:var(--ui-text-secondary)]">
                Aún no hay versiones previas registradas para este módulo.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
