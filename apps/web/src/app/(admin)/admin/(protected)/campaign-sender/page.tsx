import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import { listCampaignSenderAdminRows } from "@/lib/public-campaign-sender";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function statusLabel(status: string) {
  return (
    {
      queued: "En cola",
      running: "En curso",
      paused: "Pausada",
      completed: "Completada",
      stopped: "Detenida",
    }[status] ?? status
  );
}

export default async function CampaignSenderAdminPage() {
  await requireAdminCapabilityUser(AdminCapability.view_reports);

  let rows: Awaited<ReturnType<typeof listCampaignSenderAdminRows>> = [];
  let storageError: string | null = null;

  if (!isCloudflareRuntime()) {
    storageError = "Este panel se habilita en el runtime de Cloudflare con D1.";
  } else {
    try {
      rows = await listCampaignSenderAdminRows();
    } catch {
      storageError = "Aún no hay datos disponibles. Confirma que la migración 0011 está aplicada en D1.";
    }
  }

  const totals = rows.reduce(
    (summary, row) => ({
      campaigns: summary.campaigns + 1,
      recipients: summary.recipients + row.total,
      sent: summary.sent + row.sent,
      failed: summary.failed + row.failed,
    }),
    { campaigns: 0, recipients: 0, sent: 0, failed: 0 },
  );

  return (
    <div className="grid gap-6">
      <section className="ui-card ui-card-pad grid gap-2">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Campaign Sender</div>
        <h1 className="text-lg font-semibold text-slate-100">Trazabilidad de envíos desde la extensión</h1>
        <p className="text-sm text-slate-300">
          Solo muestra campañas de texto registradas por perfiles locales. No gestiona imágenes ni adjuntos.
        </p>
      </section>

      {storageError ? (
        <section className="ui-card ui-card-pad text-sm text-amber-200">{storageError}</section>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Campañas", totals.campaigns],
              ["Destinatarios", totals.recipients],
              ["Enviados", totals.sent],
              ["Fallidos", totals.failed],
            ].map(([label, value]) => (
              <article key={String(label)} className="ui-card px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
              </article>
            ))}
          </section>

          <section className="ui-card overflow-hidden">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="font-semibold text-slate-100">Últimas campañas</h2>
              <p className="mt-1 text-sm text-slate-400">Historial de hasta 100 campañas recientes.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/40 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Campaña</th>
                    <th className="px-4 py-3">Emisor</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Resultados</th>
                    <th className="px-4 py-3">Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((row) => (
                      <tr key={row.id} className="border-t border-white/10 text-slate-200">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{row.campaignName}</div>
                          <code className="text-xs text-slate-400">{row.id}</code>
                        </td>
                        <td className="px-4 py-3">
                          <div>{row.senderLabel || "Sin etiqueta"}</div>
                          <div className="text-xs text-slate-400">{row.senderPhone}</div>
                        </td>
                        <td className="px-4 py-3">{statusLabel(row.status)}</td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.sent}/{row.total} enviados · {row.failed} fallidos
                        </td>
                        <td className="px-4 py-3 text-slate-400">{formatDate(row.createdAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-slate-400" colSpan={5}>
                        Aún no hay campañas creadas desde ReCalc Campaigns.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
