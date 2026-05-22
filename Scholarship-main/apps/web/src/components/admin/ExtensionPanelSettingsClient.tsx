"use client";

import { useState } from "react";

import { useAdminActionForm } from "@/components/admin/useAdminActionForm";

type ExtensionPanelConfig = {
  sessionRequiredLabel: string;
  openSiteLabel: string;
  openSitePath: string;
  openWhatsAppLabel: string;
  selectorPackJson: string;
};

type ActionResult = { ok: boolean; error?: string };

export default function ExtensionPanelSettingsClient({
  config,
  saveExtensionPanelConfigAction,
}: {
  config: ExtensionPanelConfig;
  saveExtensionPanelConfigAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const [sessionRequiredLabel, setSessionRequiredLabel] = useState(config.sessionRequiredLabel);
  const [openSiteLabel, setOpenSiteLabel] = useState(config.openSiteLabel);
  const [openSitePath, setOpenSitePath] = useState(config.openSitePath);
  const [openWhatsAppLabel, setOpenWhatsAppLabel] = useState(config.openWhatsAppLabel);
  const [selectorPackJson, setSelectorPackJson] = useState(config.selectorPackJson);

  const { handleSubmit, saveState, saving } = useAdminActionForm(
    saveExtensionPanelConfigAction,
    "No fue posible guardar la configuración de la extensión.",
  );

  return (
    <section className="ui-card ui-card-pad">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Extensión Chrome
          </div>
          <h1 className="mt-1 text-lg font-semibold text-slate-100">
            Runtime y side panel
          </h1>
        </div>
      </div>

      {saveState?.ok === false && saveState.error ? (
        <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {saveState.error}
        </div>
      ) : null}

      {saveState?.ok ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/35 bg-blue-950/20 px-3 py-2 text-sm text-emerald-100">
          Configuración actualizada.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm">
          Indicador cuando no hay sesión
          <input
            name="sessionRequiredLabel"
            value={sessionRequiredLabel}
            onChange={(event) => setSessionRequiredLabel(event.target.value)}
            className="ui-control"
            placeholder="Sesión requerida"
          />
        </label>

        <label className="grid gap-2 text-sm">
          Texto del botón principal
          <input
            name="openSiteLabel"
            value={openSiteLabel}
            onChange={(event) => setOpenSiteLabel(event.target.value)}
            className="ui-control"
            placeholder="Abrir sitio completo"
          />
        </label>

        <label className="grid gap-2 text-sm">
          Texto del botón WhatsApp
          <input
            name="openWhatsAppLabel"
            value={openWhatsAppLabel}
            onChange={(event) => setOpenWhatsAppLabel(event.target.value)}
            className="ui-control"
            placeholder="Abrir WhatsApp Web"
          />
        </label>

        <label className="grid gap-2 text-sm">
          Ruta o URL del botón
          <input
            name="openSitePath"
            value={openSitePath}
            onChange={(event) => setOpenSitePath(event.target.value)}
            className="ui-control"
            placeholder="/unidep"
          />
          <span className="text-xs text-slate-400">Acepta ruta interna o URL completa.</span>
        </label>

        <label className="grid gap-2 text-sm">
          Selector pack de WhatsApp Web
          <textarea
            name="selectorPackJson"
            value={selectorPackJson}
            onChange={(event) => setSelectorPackJson(event.target.value)}
            className="ui-control min-h-[220px] font-mono text-xs"
            spellCheck={false}
          />
          <span className="text-xs text-slate-400">Versión y selectores activos de WhatsApp Web.</span>
        </label>

        <div className="sticky bottom-0 z-10 -mx-1 bg-slate-950/95 px-1 pt-3">
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-blue-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      </form>
    </section>
  );
}
