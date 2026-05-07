"use client";

import { useState, useTransition } from "react";

type StepResult = { name: string; ok: boolean; error?: string };

export default function MigrateClient() {
  const [results, setResults] = useState<StepResult[] | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    if (
      !confirm(
        "¿Aplicar la migración de BD para UNIDEP? Esta operación es idempotente y segura de re-ejecutar."
      )
    )
      return;

    setError("");
    setResults(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/apply-unidep-migration", {
          method: "POST",
        });
        const data = (await res.json()) as { ok: boolean; results?: StepResult[]; error?: string };
        if (data.results) {
          setResults(data.results);
        } else {
          setError(data.error ?? "Error desconocido.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error de red.");
      }
    });
  }

  const allOk = results?.every((r) => r.ok);
  const failedSteps = results?.filter((r) => !r.ok) ?? [];

  return (
    <div className="grid gap-6">
    <div className="ui-card ui-card-pad">
        <h3 className="font-semibold text-amber-300">Aplicar migración de base de datos</h3>
        <p className="mt-2 text-sm text-slate-300">
          Si ves errores 500 en las APIs de UNIDEP (campuses, oferta, planes, costos), es porque las
          nuevas columnas y tablas aún no están creadas en Neon. Haz clic en{" "}
          <strong>&quot;Aplicar migración&quot;</strong> para crearlas. La operación es{" "}
          <strong>idempotente</strong> — puedes ejecutarla varias veces sin riesgo.
        </p>

        <div className="mt-4 text-sm text-slate-400">
          <strong>Qué crea esta migración:</strong>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              Columnas en <code className="rounded bg-black/30 px-1">campus</code>:{" "}
              <code className="rounded bg-black/30 px-1">address</code>,{" "}
              <code className="rounded bg-black/30 px-1">phone</code>,{" "}
              <code className="rounded bg-black/30 px-1">whatsapp</code>
            </li>
            <li>
              Columnas en <code className="rounded bg-black/30 px-1">program</code>:{" "}
              <code className="rounded bg-black/30 px-1">businessLine</code>,{" "}
              <code className="rounded bg-black/30 px-1">planPdfUrl</code>,{" "}
              <code className="rounded bg-black/30 px-1">brochurePdfUrl</code>
            </li>
            <li>
              Tabla <code className="rounded bg-black/30 px-1">academic_fee</code> (costos académicos)
            </li>
            <li>
              Tabla <code className="rounded bg-black/30 px-1">campus_academic_fee</code>{" "}
              (disponibilidad por plantel)
            </li>
          </ul>
        </div>

        <div className="mt-6">
          <button
            onClick={handleApply}
            disabled={isPending}
            className="rounded-full border border-amber-500/40 bg-amber-500/20 px-6 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-50"
          >
            {isPending ? "Aplicando migración..." : "Aplicar migración"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {results && (
          <div className="mt-4 grid gap-2">
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                allOk
                  ? "border-blue-900/40 bg-blue-950/20 text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              }`}
            >
              {allOk ? (
                <div className="font-semibold">
                  ✓ Migración completada. Todos los pasos aplicados correctamente.
                </div>
              ) : (
                <div className="font-semibold">
                  ⚠ Migración parcial — {failedSteps.length} paso(s) fallaron (ver abajo).
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Detalle de pasos
              </div>
              <ul className="mt-3 grid gap-1.5">
                {results.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className={r.ok ? "text-emerald-400" : "text-red-400"}>
                      {r.ok ? "✓" : "✗"}
                    </span>
                    <div>
                      <span className="text-slate-200">{r.name}</span>
                      {r.error && (
                        <div className="mt-0.5 font-mono text-red-300">{r.error}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
