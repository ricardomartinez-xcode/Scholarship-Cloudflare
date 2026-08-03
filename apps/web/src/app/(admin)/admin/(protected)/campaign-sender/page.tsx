import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { readExtensionAnalyticsAdmin } from "@/lib/extension-analytics";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin actividad";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function percent(sent: number, total: number) {
  if (!total) return "0%";
  return `${((sent / total) * 100).toFixed(1)}%`;
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (["completed", "sent"].includes(normalized)) return "text-emerald-300";
  if (["failed", "blocked"].includes(normalized)) return "text-rose-300";
  if (["partial", "paused"].includes(normalized)) return "text-amber-300";
  return "text-sky-300";
}

function analyticsExportUrl(params: {
  nameId?: string | null;
  campaignId?: string | null;
  status?: string | null;
}) {
  const query = new URLSearchParams();
  if (params.nameId) query.set("nameId", params.nameId);
  if (params.campaignId) query.set("campaignId", params.campaignId);
  if (params.status) query.set("status", params.status);
  return `/api/admin/campaign-sender/analytics-export?${query.toString()}`;
}

export default async function CampaignSenderAdminPage({ searchParams }: PageProps) {
  await requireAdminCapabilityUser(AdminCapability.view_reports);
  const params = (await searchParams) ?? {};
  const requestedNameId = one(params.nameId)?.trim() || null;
  const requestedCampaignId = one(params.campaignId)?.trim() || null;

  let data: Awaited<ReturnType<typeof readExtensionAnalyticsAdmin>> | null = null;
  let storageError: string | null = null;
  try {
    data = await readExtensionAnalyticsAdmin({
      nameId: requestedNameId,
      campaignId: requestedCampaignId,
      limit: 250,
    });
  } catch (error) {
    storageError =
      error instanceof Error
        ? error.message
        : "No fue posible leer la analítica de la extensión.";
  }

  const users = data?.users ?? [];
  const totals = data?.totals ?? {
    campaigns: 0,
    recipients: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    invalid: 0,
    estimatedCostMxn: 0,
    lastActivityAt: null,
  };
  const selectedNameId = requestedNameId;
  const campaigns = data?.campaigns ?? [];
  const selectedCampaign = requestedCampaignId
    ? campaigns.find((campaign) => campaign.id === requestedCampaignId) ?? campaigns[0] ?? null
    : campaigns[0] ?? null;
  const recipients = data?.recipients ?? [];

  return (
    <div className="grid gap-6">
      <section className="ui-card ui-card-pad grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">ReCalc Sender Analytics</div>
            <h1 className="mt-1 text-xl font-semibold text-slate-100">Dashboard global de envíos de la extensión</h1>
            <p className="mt-2 text-sm text-slate-300">
              Consolida campañas, horarios, enviados, fallidos e incidencias de todas las instalaciones identificadas mediante Name_ID. La extensión conserva su copia local y sincroniza únicamente como capa complementaria de analítica.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            <div className="font-medium">Arquitectura offline-first</div>
            <div className="mt-1 text-emerald-200/80">Los envíos no dependen de ReCalc ni de una sesión web.</div>
          </div>
        </div>
        <dl className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Base de datos</dt>
            <dd className="mt-1 text-slate-100">Supabase PostgreSQL · Prisma</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Identidad</dt>
            <dd className="mt-1 text-slate-100">Name_ID + UUID y clave técnica por instalación</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Última actividad global</dt>
            <dd className="mt-1 text-slate-100">{formatDate(totals.lastActivityAt)}</dd>
          </div>
        </dl>
      </section>

      {storageError ? (
        <section className="ui-card ui-card-pad text-sm text-amber-200">
          La migración de analítica todavía no está disponible en Supabase. Detalle: {storageError}
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            {[
              ["Name_ID", users.length],
              ["Campañas", totals.campaigns],
              ["Destinatarios", totals.recipients],
              ["Enviados", totals.sent],
              ["Fallidos", totals.failed],
              ["Éxito", percent(totals.sent, totals.sent + totals.failed)],
              ["Costo estimado", formatMoney(totals.estimatedCostMxn)],
            ].map(([label, value]) => (
              <article key={String(label)} className="ui-card px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
              </article>
            ))}
          </section>

          <section className="ui-card ui-card-pad grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-100">Filtrar por identificador</h2>
                <p className="mt-1 text-sm text-slate-400">Selecciona un Name_ID para revisar sus campañas y resultados.</p>
              </div>
              <form className="flex flex-wrap items-end gap-2" method="get">
                <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                  Name_ID
                  <select
                    className="min-w-64 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100"
                    defaultValue={selectedNameId ?? ""}
                    name="nameId"
                  >
                    <option value="">Todos los identificadores</option>
                    {users.map((user) => (
                      <option key={user.nameId} value={user.nameId}>{user.nameId}</option>
                    ))}
                  </select>
                </label>
                <button className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white" type="submit">Aplicar</button>
                <a className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200" href="/admin/campaign-sender">Limpiar</a>
              </form>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/50 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Name_ID</th>
                    <th className="px-4 py-3">Instalaciones</th>
                    <th className="px-4 py-3">Campañas</th>
                    <th className="px-4 py-3">Envíos</th>
                    <th className="px-4 py-3">Fallidos</th>
                    <th className="px-4 py-3">Última actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length ? users.map((user) => (
                    <tr key={user.nameId} className="border-t border-white/10 text-slate-200">
                      <td className="px-4 py-3">
                        <a className="font-medium text-sky-300 hover:text-sky-200" href={`/admin/campaign-sender?nameId=${encodeURIComponent(user.nameId)}`}>{user.nameId}</a>
                      </td>
                      <td className="px-4 py-3">{user.installations}</td>
                      <td className="px-4 py-3">{user.campaigns}</td>
                      <td className="px-4 py-3">{user.sent}/{user.recipients} · {percent(user.sent, user.sent + user.failed)}</td>
                      <td className="px-4 py-3">{user.failed} <span className="text-slate-500">· {user.invalid} inválidos</span></td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(user.lastActivityAt)}</td>
                    </tr>
                  )) : (
                    <tr><td className="px-4 py-6 text-slate-400" colSpan={6}>Aún no hay instalaciones sincronizadas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ui-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <h2 className="font-semibold text-slate-100">Campañas {selectedNameId ? `de ${selectedNameId}` : "globales"}</h2>
                <p className="mt-1 text-sm text-slate-400">Haz clic en una campaña para consultar destinatarios y errores.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200" href={analyticsExportUrl({ nameId: selectedNameId })}>CSV completo</a>
                <a className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200" href={analyticsExportUrl({ nameId: selectedNameId, status: "sent" })}>CSV enviados</a>
                <a className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200" href={analyticsExportUrl({ nameId: selectedNameId, status: "failed" })}>CSV fallidos</a>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/40 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Campaña</th>
                    <th className="px-4 py-3">Name_ID</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Progreso</th>
                    <th className="px-4 py-3">Ritmo</th>
                    <th className="px-4 py-3">Sincronización</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length ? campaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-t border-white/10 text-slate-200">
                      <td className="px-4 py-3">
                        <a className="font-medium text-sky-300 hover:text-sky-200" href={`/admin/campaign-sender?nameId=${encodeURIComponent(campaign.nameId)}&campaignId=${encodeURIComponent(campaign.id)}`}>{campaign.campaignName}</a>
                        <div className="mt-1 text-xs text-slate-500">{campaign.hasMedia ? `Con multimedia${campaign.mediaType ? ` · ${campaign.mediaType}` : ""}` : "Solo texto"}</div>
                      </td>
                      <td className="px-4 py-3">{campaign.nameId}<div className="text-xs text-slate-500">v{campaign.extensionVersion || "?"}</div></td>
                      <td className={`px-4 py-3 font-medium ${statusClass(campaign.status)}`}>{campaign.status}</td>
                      <td className="px-4 py-3">{campaign.sent}/{campaign.total} enviados<div className="text-xs text-slate-500">{campaign.failed} fallidos · {campaign.pending} pendientes</div></td>
                      <td className="px-4 py-3 text-slate-300">{(campaign.messageDelayMs / 1000).toFixed(1)}s/msg<div className="text-xs text-slate-500">Lote {campaign.batchSize} · pausa {(campaign.batchDelayMs / 1000).toFixed(0)}s</div></td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(campaign.updatedAt)}<div className="text-xs">Extensión: {formatDate(campaign.lastSyncAt)}</div></td>
                    </tr>
                  )) : (
                    <tr><td className="px-4 py-6 text-slate-400" colSpan={6}>No hay campañas para el filtro seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {selectedCampaign ? (
            <section className="ui-card overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Detalle de campaña</div>
                  <h2 className="mt-1 text-lg font-semibold text-white">{selectedCampaign.campaignName}</h2>
                  <p className="mt-1 text-sm text-slate-400">{selectedCampaign.nameId} · {selectedCampaign.total} destinatarios · {formatMoney(selectedCampaign.estimatedCostMxn)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200" href={analyticsExportUrl({ campaignId: selectedCampaign.id })}>Descargar todo</a>
                  <a className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200" href={analyticsExportUrl({ campaignId: selectedCampaign.id, status: "failed" })}>Descargar fallidos</a>
                </div>
              </div>
              <div className="grid gap-3 border-b border-white/10 p-4 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Total", selectedCampaign.total],
                  ["Enviados", selectedCampaign.sent],
                  ["Fallidos", selectedCampaign.failed],
                  ["Pendientes", selectedCampaign.pending],
                  ["Éxito", percent(selectedCampaign.sent, selectedCampaign.sent + selectedCampaign.failed)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
                    <div className="mt-1 text-xl font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-950/40 text-xs uppercase tracking-[0.16em] text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Destinatario</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Hora</th>
                      <th className="px-4 py-3">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.length ? recipients.map((recipient) => (
                      <tr key={recipient.id} className="border-t border-white/10 text-slate-200">
                        <td className="px-4 py-3"><div>{recipient.contactName || "Sin nombre"}</div><div className="text-xs text-slate-500">{recipient.contactValue}</div></td>
                        <td className={`px-4 py-3 font-medium ${statusClass(recipient.status)}`}>{recipient.status}</td>
                        <td className="px-4 py-3 text-slate-400">{formatDate(recipient.sentAt || recipient.failedAt || recipient.attemptedAt || recipient.updatedAt)}</td>
                        <td className="max-w-md px-4 py-3 text-slate-400">{recipient.lastError || "—"}</td>
                      </tr>
                    )) : (
                      <tr><td className="px-4 py-6 text-slate-400" colSpan={4}>Selecciona una campaña para cargar el detalle de destinatarios.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
