"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FbResponse = { status?: string; authResponse?: { code?: string; userID?: string } };
type SignupAsset = { wabaId: string | null; phoneNumberId: string | null; businessAccountId: string | null };

type MetaWindow = Window & {
  FB?: {
    init: (params: Record<string, unknown>) => void;
    login: (callback: (response: FbResponse | undefined) => void, params: Record<string, unknown>) => void;
    getLoginStatus: (callback: (response: FbResponse) => void) => void;
    AppEvents?: { logPageView?: () => void };
  };
  fbAsyncInit?: () => void;
};

function metaWindow() {
  return window as MetaWindow;
}


const SDK_URL = "https://connect.facebook.net/en_US/sdk.js";

export default function EmbeddedSignupConnector() {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID?.trim() ?? "";
  const configId = process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID?.trim() ?? "";
  const graphVersion = process.env.NEXT_PUBLIC_META_GRAPH_API_VERSION?.trim() ?? "v25.0";
  const sessionInfoVersion = Number(process.env.NEXT_PUBLIC_WHATSAPP_ES_SESSION_INFO_VERSION ?? "3");
  const assetsRef = useRef<SignupAsset>({ wabaId: null, phoneNumberId: null, businessAccountId: null });
  const [sdkReady, setSdkReady] = useState(false);
  const [loginStatus, setLoginStatus] = useState("unknown");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [assets, setAssets] = useState<SignupAsset>({ wabaId: null, phoneNumberId: null, businessAccountId: null });

  const recordSession = useCallback(async (body: Record<string, unknown>) => {
    await fetch("/api/integrations/meta/embedded-signup/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
  }, []);

  useEffect(() => {
    if (!appId) return;
    const scriptId = "facebook-jssdk";
    metaWindow().fbAsyncInit = () => {
      metaWindow().FB?.init({ appId, cookie: true, xfbml: true, version: graphVersion });
      metaWindow().FB?.AppEvents?.logPageView?.();
      metaWindow().FB?.getLoginStatus((response) => setLoginStatus(response?.status ?? "unknown"));
      setSdkReady(true);
    };
    if (metaWindow().FB) {
      metaWindow().fbAsyncInit?.();
      return;
    }
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = SDK_URL;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
    return () => { metaWindow().fbAsyncInit = undefined; };
  }, [appId, graphVersion]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!["https://www.facebook.com", "https://web.facebook.com"].includes(event.origin)) return;
      let payload: { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string; business_account_id?: string } } | null = null;
      try { payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (payload.event === "FINISH") {
        const next = { wabaId: payload.data?.waba_id ?? null, phoneNumberId: payload.data?.phone_number_id ?? null, businessAccountId: payload.data?.business_account_id ?? null };
        assetsRef.current = next;
        setAssets(next);
        setMessage("Meta confirmó el número. Finalizando la conexión segura…");
      } else if (payload.event === "CANCEL") setMessage("El registro fue cancelado.");
      else if (payload.event === "ERROR") setMessage("Meta reportó un error durante el registro.");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const launch = useCallback(() => {
    if (!metaWindow().FB || !appId || !configId) {
      setMessage("Falta configurar App ID, Configuration ID o cargar el SDK de Facebook.");
      return;
    }
    const clientSessionId = crypto.randomUUID();
    setSubmitting(true);
    setMessage(null);
    void recordSession({ clientSessionId, status: "started", flowType: "embedded_signup", appId, configId, sessionInfoVersion });
    const facebook = metaWindow().FB;
    if (!facebook) return;
    facebook.login(async (response) => {
      setLoginStatus(response?.status ?? "unknown");
      const code = response?.authResponse?.code;
      if (!code) {
        setSubmitting(false);
        setMessage("Meta no devolvió un código de autorización.");
        await recordSession({ clientSessionId, status: "error", flowType: "embedded_signup", errorMessage: "missing_authorization_code" });
        return;
      }
      const currentAssets = assetsRef.current;
      const exchange = await fetch("/api/integrations/meta/exchange-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, clientSessionId, flowType: "embedded_signup", configId, sessionInfoVersion, facebookUserId: response?.authResponse?.userID ?? null, facebookLoginStatus: response?.status ?? null, ...currentAssets }),
      });
      const payload = await exchange.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      setSubmitting(false);
      setMessage(exchange.ok && payload?.ok ? "Número de WhatsApp Business conectado correctamente." : payload?.error ?? "No fue posible guardar la conexión.");
    }, {
      config_id: configId,
      response_type: "code",
      override_default_response_type: true,
      extras: { feature: "whatsapp_embedded_signup", sessionInfoVersion, setup: {} },
    });
  }, [appId, configId, recordSession, sessionInfoVersion]);

  const ready = Boolean(appId && configId && sdkReady);
  return (
    <section className="ui-card ui-card-pad grid gap-6">
      <div className="grid gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-200">META Services · Embedded Signup</div>
        <h1 className="text-xl font-semibold text-white">Agregar un número de WhatsApp Business</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-300">Inicia sesión con Facebook, selecciona o crea el negocio y la WABA, y registra el número en el flujo oficial. El código temporal se intercambia únicamente en el backend.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/25 p-5">
          <ol className="grid gap-3 text-sm text-slate-200">
            <li>1. Inicia sesión con una cuenta administradora del negocio.</li>
            <li>2. Selecciona o crea el portafolio empresarial y la WABA.</li>
            <li>3. Agrega y verifica el número de WhatsApp.</li>
            <li>4. La aplicación guarda los identificadores y token cifrado.</li>
          </ol>
          <button type="button" onClick={launch} disabled={!ready || submitting} className="ui-button-primary mt-6" data-testid="meta-embedded-signup-launch">
            {submitting ? "Conectando con Meta…" : "Continuar con Facebook"}
          </button>
          {message ? <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">{message}</div> : null}
        </div>
        <aside className="grid content-start gap-3 rounded-3xl border border-white/10 bg-slate-950/25 p-5 text-xs text-slate-300">
          <div className="ui-kicker">Estado técnico</div>
          <div>SDK: <strong className="text-slate-100">{sdkReady ? "listo" : "cargando"}</strong></div>
          <div>Facebook: <strong className="text-slate-100">{loginStatus}</strong></div>
          <div>App ID: <strong className="break-all text-slate-100">{appId || "sin configurar"}</strong></div>
          <div>WABA ID: <strong className="break-all text-slate-100">{assets.wabaId ?? "pendiente"}</strong></div>
          <div>Phone Number ID: <strong className="break-all text-slate-100">{assets.phoneNumberId ?? "pendiente"}</strong></div>
        </aside>
      </div>
    </section>
  );
}
