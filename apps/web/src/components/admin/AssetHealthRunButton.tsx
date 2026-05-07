"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AssetHealthRunButtonProps = {
  lastCheckedAt: string | null;
  alertCount: number;
};

function formatDate(value: string | null) {
  if (!value) return "Sin ejecución previa";
  return new Date(value).toLocaleString("es-MX");
}

export default function AssetHealthRunButton({
  lastCheckedAt,
  alertCount,
}: AssetHealthRunButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRun() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/asset-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            summary?: {
              assetsChecked?: number;
              counts?: {
                broken?: number;
                timeout?: number;
                unauthorized?: number;
              };
            };
          }
        | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "No fue posible ejecutar el health check.");
      }
      const brokenCount =
        (data?.summary?.counts?.broken ?? 0) +
        (data?.summary?.counts?.timeout ?? 0) +
        (data?.summary?.counts?.unauthorized ?? 0);
      setMessage(
        `Health check completado: ${data?.summary?.assetsChecked ?? 0} assets revisados, ${brokenCount} alertas activas.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible ejecutar el health check.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
        Asset health
      </div>
      <div className="mt-2 text-sm text-slate-300">
        Última ejecución: {formatDate(lastCheckedAt)} · Alertas actuales: {alertCount}
      </div>
      <button
        type="button"
        onClick={() => void handleRun()}
        disabled={pending}
        className="mt-3 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Ejecutando..." : "Ejecutar health check"}
      </button>
      {message ? <div className="mt-3 text-xs text-slate-300">{message}</div> : null}
    </div>
  );
}
