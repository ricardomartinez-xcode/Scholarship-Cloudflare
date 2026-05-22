import { AdminCapability } from "@prisma/client";

import ExtensionCampaignsClient from "@/components/admin/ExtensionCampaignsClient";
import ExtensionPanelSettingsClient from "@/components/admin/ExtensionPanelSettingsClient";
import {
  adminHasCapability,
  requireAdminCapabilityUser,
} from "@/lib/admin-session";
import { getExtensionAdminDashboard } from "@/lib/extension-admin";

import { saveExtensionPanelConfigAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ExtensionPanelPage() {
  const admin = await requireAdminCapabilityUser(AdminCapability.manage_ctas);
  const dashboard = await getExtensionAdminDashboard();
  const canViewReports = adminHasCapability(admin, [
    AdminCapability.view_reports,
    AdminCapability.view_admin_operations,
  ]);

  return (
    <div className="grid gap-6">
      <section className="ui-card ui-card-pad grid gap-2">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
          Extensión Chrome
        </div>
        <h1 className="text-lg font-semibold text-slate-100">
          Runtime, campañas y handoff
        </h1>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <article key={metric.label} className="ui-card px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
              {metric.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">{metric.value}</div>
          </article>
        ))}
      </section>

      <ExtensionCampaignsClient />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <article className="ui-card ui-card-pad grid gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Selector pack activo
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">
              {dashboard.config.selectorPack.version}
            </h2>
            <p className="mt-2 text-sm text-slate-300">Canal: {dashboard.config.selectorPack.channel}</p>
          </div>
          <dl className="grid gap-3 text-sm text-slate-200 md:grid-cols-2">
            {[
              ["Buscador", dashboard.config.selectorPack.selectors.searchBox],
              ["Composer", dashboard.config.selectorPack.selectors.messageInput],
              ["Enviar", dashboard.config.selectorPack.selectors.sendButton],
              ["Adjuntar", dashboard.config.selectorPack.selectors.attachButton],
              ["Input de archivo", dashboard.config.selectorPack.selectors.fileInput],
              ["Caption de media", dashboard.config.selectorPack.selectors.mediaCaptionInput],
              ["Chat listo", dashboard.config.selectorPack.selectors.conversationReady],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  {label}
                </dt>
                <dd className="mt-2 font-mono text-xs text-slate-100">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="ui-card ui-card-pad grid gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Estado comercial
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">
              Templates y dominio
            </h2>
          </div>
          <div className="grid gap-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Templates oficiales
              </div>
              <div className="mt-2 text-xl font-semibold text-white">
                {dashboard.templateSummary.officialCount}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Default actual: {dashboard.templateSummary.defaultOfficialName ?? "Sin definir"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Cola de revisión
              </div>
              <div className="mt-2 text-xl font-semibold text-white">
                {dashboard.templateSummary.pendingReviewCount}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-blue-950/20 p-3 text-sm text-emerald-100">
              Dominio activo:
              <code className="ml-2 rounded bg-black/25 px-1">recalc.relead.com.mx</code>
            </div>
          </div>
        </article>
      </section>

      {canViewReports ? (
        <section className="ui-card ui-card-pad grid gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Eventos recientes
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">
              Trazabilidad del canal extensión
            </h2>
          </div>
          <div className="grid gap-3">
            {dashboard.recentEvents.length ? (
              dashboard.recentEvents.map((event) => (
                <article
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-300"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-slate-100">{event.type}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(event.createdAt).toLocaleString("es-MX")}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    Usuario: {event.userEmail ?? "Sin usuario"} · Run: {event.subjectId ?? "—"}
                  </div>
                  <div className="mt-2">{event.summary}</div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-300">
                Sin eventos recientes.
              </div>
            )}
          </div>
        </section>
      ) : null}

      <ExtensionPanelSettingsClient
        config={dashboard.config}
        saveExtensionPanelConfigAction={saveExtensionPanelConfigAction}
      />
    </div>
  );
}
