"use client";

import { useSearchParams } from "next/navigation";

const statusMessages: Record<string, string> = {
  success: "Número de WhatsApp Business conectado correctamente.",
  cancelled: "El registro alojado por Meta fue cancelado antes de completarse.",
  error: "Meta no pudo completar la conexión. Revisa el detalle técnico y vuelve a intentarlo.",
};

export default function EmbeddedSignupConnector() {
  const params = useSearchParams();
  const status = params.get("meta_status") ?? "";
  const error = params.get("meta_error") ?? "";
  const appId = process.env.NEXT_PUBLIC_META_APP_ID?.trim() ?? "";
  const configId = process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID?.trim() ?? "";
  const ready = Boolean(appId && configId);

  return (
    <section className="ui-card ui-card-pad grid gap-6">
      <div className="grid gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-200">META Services · Hosted Embedded Signup</div>
        <h1 className="text-xl font-semibold text-white">Agregar un número de WhatsApp Business</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-300">Recalc te redirigirá al registro alojado por Meta. Meta administrará la selección del negocio, la WABA y la verificación del número; el código temporal regresará a Recalc y se intercambiará únicamente en el servidor.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/25 p-5">
          <ol className="grid gap-3 text-sm text-slate-200">
            <li>1. Abre el registro oficial alojado por Meta.</li>
            <li>2. Inicia sesión con una cuenta administradora del negocio.</li>
            <li>3. Selecciona o crea la WABA y verifica el número.</li>
            <li>4. Meta vuelve a Recalc y el backend guarda la conexión cifrada.</li>
          </ol>
          <a href="/api/integrations/meta/hosted-signup/start" aria-disabled={!ready} className={`ui-button-primary mt-6 inline-flex ${ready ? "" : "pointer-events-none opacity-50"}`} data-testid="meta-hosted-signup-launch">
            Abrir registro de Meta
          </a>
          {status ? <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">{statusMessages[status] ?? status}{error ? <div className="mt-2 break-all text-xs text-amber-200">Detalle: {error}</div> : null}</div> : null}
        </div>
        <aside className="grid content-start gap-3 rounded-3xl border border-white/10 bg-slate-950/25 p-5 text-xs text-slate-300">
          <div className="ui-kicker">Configuración</div>
          <div>Modo: <strong className="text-slate-100">Hosted v4</strong></div>
          <div>Feature: <strong className="text-slate-100">WhatsApp Business App Onboarding</strong></div>
          <div>App ID: <strong className="break-all text-slate-100">{appId || "sin configurar"}</strong></div>
          <div>Configuration ID: <strong className="break-all text-slate-100">{configId || "sin configurar"}</strong></div>
          <div>Callback: <strong className="break-all text-slate-100">/api/integrations/meta/oauth/callback</strong></div>
        </aside>
      </div>
    </section>
  );
}
