import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import {
  listD1ExtensionCampaignAdminRows,
  type D1ExtensionCampaignAdminSummary,
} from "@/lib/cloudflare/extension-runtime-d1";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "Sin actividad";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function isFreshHeartbeat(value: string | null) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= 5 * 60_000;
}

function connectionLabel(row: D1ExtensionCampaignAdminSummary) {
  if (!row.lastHeartbeatAt) return "Sin heartbeat";
  return isFreshHeartbeat(row.lastHeartbeatAt) ? "Conectada" : "Desconectada";
}

function tokenLabel(row: D1ExtensionCampaignAdminSummary) {
  if (row.lastEventType === "token_revoked") return "Sesión revocada";
  if (row.lastEventType === "token_expired") return "Token vencido";
  if (row.lastHeartbeatAt) return "Token validado";
  return "Sin sesión reciente";
}

export default async function CampaignSenderAdminPage() {
  await requireAdminCapabilityUser(AdminCapability.view_reports);

  let rows: D1ExtensionCampaignAdminSummary[] = [];
  let storageError: string | null = null;

  if (!isCloudflareRuntime()) {
    storageError = "Este panel se habilita en el runtime de Cloudflare con D1.";
  } else {
    try {
      rows = await listD1ExtensionCampaignAdminRows();
    } catch {
      storageError = "Campaign Sender no está disponible. Confirma el binding D1 y las migraciones de extension_campaign.";
    }
  }

  const totals = rows.reduce(
    (summary, row) => ({
      campaigns: summary.campaigns + 1,
      recipients: summary.recipients + row.stats.total,
      sent: summary.sent + row.stats.sent,
      failed: summary.failed + row.stats.failed,
      connected: summary.connected + (isFreshHeartbeat(row.lastHeartbeatAt) ? 1 : 0),
    }),
    { campaigns: 0, recipients: 0, sent: 0, failed: 0, connected: 0 },
  );

  return (
    <div className="grid gap-6">
      <section className="ui-card ui-card-pad grid gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Campaign Sender</div>
          <h1 className="mt-1 text-lg font-semibold text-slate-100">Estado de extensión y campañas WhatsApp Web</h1>
          <p className="mt-2 text-sm text-slate-300">
            Este panel lee el backend `/api/ext/campaigns` usado por la extensión MV3. El estado
            <span className="font-medium text-white"> enviado</span> significa que WhatsApp Web aceptó el intento; entrega y lectura requieren WhatsApp Business API con webhooks.
          </p>
        </div>
        <dl className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Backend</dt>
            <dd className="mt-1 text-slate-100">{storageError ? "No disponible" : "D1 conectado"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Autenticación</dt>
            <dd className="mt-1 text-slate-100">Sesión de extensión validada sin revelar token</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Instalación</dt>
            <dd className="mt-1 text-slate-100">Abrir la extensión, iniciar sesión y mantener WhatsApp Web activo</dd>
          </div>
        </dl>
      </section>

      {storageError ? (
        <section className="ui-card ui-card-pad text-sm text-amber-200">{storageError}</section>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              ["Campañas", totals.campaigns],
              ["Destinatarios", totals.recipients],
              ["Extensiones conectadas", totals.connected],
              ["Enviados por WhatsApp Web", totals.sent],
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
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Extensión</th>
                    <th className="px-4 py-3">Progreso</th>
                    <th className="px-4 py-3">Actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((row) => (
                      <tr key={row.id} className="border-t border-white/10 text-slate-200">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{row.campaignName}</div>
                          <div className="mt-1 text-xs text-slate-400">{row.channel}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{row.ownerDisplayName || row.ownerEmail || "Sin nombre"}</div>
                          <div className="text-xs text-slate-400">{row.ownerEmail || row.ownerUserId}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{row.businessStatusLabel}</div>
                          <div className="text-xs text-slate-400">{row.status}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{connectionLabel(row)}</div>
                          <div className="text-xs text-slate-400">
                            {row.extensionVersion ? `v${row.extensionVersion}` : "Sin versión"} · {tokenLabel(row)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.stats.sent}/{row.stats.total} enviados · {row.stats.failed} fallidos
                          <div className="text-xs text-slate-400">
                            {row.stats.queued + row.stats.scheduled + row.stats.claimed} pendientes
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          <div>Última: {formatDate(row.lastActivityAt)}</div>
                          <div className="text-xs">Heartbeat: {formatDate(row.lastHeartbeatAt)}</div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-slate-400" colSpan={6}>
                        Aún no hay campañas creadas desde la extensión.
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
