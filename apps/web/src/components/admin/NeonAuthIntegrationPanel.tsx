"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type StatusPayload = {
  projectId: string;
  branchId: string;
  webhookUrl: string;
  env: Record<string, boolean>;
  health: unknown;
  webhookConfig: unknown;
  oauthProviders: unknown;
  authPlugins: unknown;
  recentEvents?: Array<{
    id: string;
    event: string;
    receivedAt: string;
    forwarded: boolean;
    ok: boolean;
    email?: string | null;
    userId?: string | null;
    error?: string | null;
  }>;
  errors: string[];
};

type RequestState = "idle" | "loading" | "success" | "error";

const CORE_WEBHOOK_EVENTS = [
  "user.created",
  "organization.invitation.created",
  "organization.invitation.accepted",
  "phone.number.verified",
] as const;

const DELIVERY_WEBHOOK_EVENTS = ["send.magic_link", "send.otp"] as const;

const EVENT_LABELS: Record<string, { label: string; detail: string }> = {
  "user.created": {
    label: "Usuario creado",
    detail: "Sincroniza altas hacia ReCalc, CRM o auditoria.",
  },
  "organization.invitation.created": {
    label: "Invitación creada",
    detail: "Rastrea invitaciones de organización.",
  },
  "organization.invitation.accepted": {
    label: "Invitación aceptada",
    detail: "Confirma activación de accesos invitados.",
  },
  "phone.number.verified": {
    label: "Teléfono verificado",
    detail: "Registra verificación de phone authentication.",
  },
  "send.magic_link": {
    label: "Enviar magic link",
    detail: "Delivery event para canal propio de magic link.",
  },
  "send.otp": {
    label: "Enviar OTP",
    detail: "Delivery event para canal propio de códigos OTP.",
  },
};

const DEFAULT_SELECTED_EVENTS = [...CORE_WEBHOOK_EVENTS];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

function firstStringList(...values: unknown[]) {
  for (const value of values) {
    const list = stringList(value);
    if (list.length) return list;
  }
  return [];
}

function extractEnabledEvents(value: unknown): string[] {
  if (!isRecord(value)) return [];

  const direct = firstStringList(value.enabled_events, value.enabledEvents, value.events);
  if (direct.length) return direct;

  const webhook = value.webhook;
  if (isRecord(webhook)) {
    const nested = firstStringList(webhook.enabled_events, webhook.enabledEvents, webhook.events);
    if (nested.length) return nested;
  }

  const webhooks = value.webhooks;
  if (Array.isArray(webhooks)) {
    for (const item of webhooks) {
      const events = extractEnabledEvents(item);
      if (events.length) return events;
    }
  }

  return [];
}

function includesSerialized(value: unknown, patterns: string[]) {
  try {
    const haystack = JSON.stringify(value ?? "").toLowerCase();
    return patterns.some((pattern) => haystack.includes(pattern.toLowerCase()));
  } catch {
    return false;
  }
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="ui-admin-card" style={{ overflow: "auto", maxHeight: 320, whiteSpace: "pre-wrap" }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={ok ? "ui-admin-chip ui-admin-chip--success" : "ui-admin-chip ui-admin-chip--warn"}>{label}: {ok ? "OK" : "Falta"}</span>;
}

function FeatureTile({
  title,
  status,
  tone,
  detail,
}: {
  title: string;
  status: string;
  tone: "success" | "warn" | "info";
  detail: string;
}) {
  const chipClass = tone === "success"
    ? "ui-admin-chip ui-admin-chip--success"
    : tone === "warn"
      ? "ui-admin-chip ui-admin-chip--warn"
      : "ui-admin-chip";

  return (
    <div className="rounded-lg border border-[color:var(--ui-border)] bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">{title}</h3>
        <span className={chipClass}>{status}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[color:var(--ui-text-secondary)]">{detail}</p>
    </div>
  );
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = (await response.json().catch(() => null)) as T & { error?: string };
  if (!response.ok) throw new Error(payload?.error ?? "La operación falló.");
  return payload;
}

export default function NeonAuthIntegrationPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [state, setState] = useState<RequestState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [provider, setProvider] = useState("google");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(DEFAULT_SELECTED_EVENTS);

  const integrationOk = useMemo(() => {
    if (!status) return false;
    return Boolean(status.env.NEON_API_KEY && status.health && !status.errors.length);
  }, [status]);

  const refresh = useCallback(async () => {
    setState("loading");
    setMessage(null);
    try {
      const payload = await readJson<StatusPayload>("/api/admin/integrations/neon-auth/status");
      setStatus(payload);
      const configuredEvents = extractEnabledEvents(payload.webhookConfig);
      setSelectedEvents(configuredEvents.length ? configuredEvents : DEFAULT_SELECTED_EVENTS);
      setState("success");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el estado.");
    }
  }, []);

  async function syncWebhook() {
    setState("loading");
    setMessage(null);
    try {
      await readJson("/api/admin/integrations/neon-auth/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: selectedEvents }),
      });
      setMessage("Webhook registrado/actualizado en Neon Auth.");
      await refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo registrar el webhook.");
    }
  }

  async function updateProvider() {
    setState("loading");
    setMessage(null);
    try {
      await readJson("/api/admin/integrations/neon-auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, clientId, clientSecret, microsoftTenantId: tenantId }),
      });
      setClientSecret("");
      setMessage(`Provider ${provider} actualizado en Neon Auth.`);
      await refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el provider.");
    }
  }

  function toggleEvent(event: string) {
    setSelectedEvents((current) =>
      current.includes(event)
        ? current.filter((item) => item !== event)
        : [...current, event],
    );
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const configuredEvents = useMemo(
    () => extractEnabledEvents(status?.webhookConfig),
    [status?.webhookConfig],
  );
  const visibleEvents = configuredEvents.length ? configuredEvents : selectedEvents;
  const deliveryHandlerReady = Boolean(status?.env.NEON_AUTH_WEBHOOK_FORWARD_URL);
  const deliverySelected = selectedEvents.some((event) => DELIVERY_WEBHOOK_EVENTS.includes(event as typeof DELIVERY_WEBHOOK_EVENTS[number]));
  const webhookConfigReady = Boolean(
    status?.env.NEON_AUTH_WEBHOOK_SECRET &&
    status?.webhookConfig &&
    !status.errors.some((error) => error.toLowerCase().includes("webhook config")),
  );
  const magicLinkDeliveryEnabled = visibleEvents.includes("send.magic_link");
  const otpDeliveryEnabled = visibleEvents.includes("send.otp");
  const phoneAuthDetected =
    visibleEvents.includes("phone.number.verified") ||
    includesSerialized(status?.authPlugins, ["phone.number", "phone-number", "phoneNumber"]);

  return (
    <div className="ui-admin-stack" style={{ gap: 20 }}>
      <section className="ui-admin-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="ui-admin-eyebrow">Integraciones</div>
            <h1 className="ui-admin-title">Neon Auth</h1>
            <p className="ui-admin-copy">Panel funcional para verificar, sincronizar y operar Neon Auth desde ReCalc.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="ui-admin-action ui-admin-action--secondary" type="button" onClick={() => void refresh()} disabled={state === "loading"}>Actualizar estado</button>
            <button className="ui-admin-action" type="button" onClick={() => void syncWebhook()} disabled={state === "loading"}>Registrar webhook</button>
          </div>
        </div>
        {message ? <p className={state === "error" ? "ui-admin-error" : "ui-admin-success"}>{message}</p> : null}
      </section>

      {status ? (
        <>
          <section className="ui-admin-card">
            <div className="flex flex-wrap gap-2">
              <StatusPill ok={integrationOk} label="Integración" />
              {Object.entries(status.env).map(([key, ok]) => <StatusPill key={key} ok={ok} label={key} />)}
            </div>
            <div className="ui-admin-grid ui-admin-grid--two" style={{ marginTop: 16 }}>
              <div><strong>Project ID</strong><p>{status.projectId}</p></div>
              <div><strong>Branch ID</strong><p>{status.branchId}</p></div>
              <div style={{ gridColumn: "1 / -1" }}><strong>Webhook URL</strong><p>{status.webhookUrl}</p></div>
            </div>
            {status.errors.length ? <div className="ui-admin-error">{status.errors.map((error) => <div key={error}>{error}</div>)}</div> : null}
          </section>

          <section className="ui-admin-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="ui-admin-section-title">Novedades Neon Auth</h2>
                <p className="ui-admin-copy">Estado operativo de webhooks, Magic link, OTP y phone authentication.</p>
              </div>
              <span className="ui-admin-chip">Eventos: {visibleEvents.length}</span>
            </div>
            <div className="ui-admin-grid ui-admin-grid--two" style={{ marginTop: 16 }}>
              <FeatureTile
                title="Webhook"
                status={webhookConfigReady ? "Listo" : "Revisar"}
                tone={webhookConfigReady ? "success" : "warn"}
                detail={webhookConfigReady ? "Firma y configuración de webhook disponibles." : "Verifica secreto, URL y configuración en Neon."}
              />
              <FeatureTile
                title="Magic link"
                status={magicLinkDeliveryEnabled ? (deliveryHandlerReady ? "Delivery listo" : "Requiere forward") : "SDK activo"}
                tone={magicLinkDeliveryEnabled && !deliveryHandlerReady ? "warn" : "success"}
                detail={magicLinkDeliveryEnabled ? "El evento send.magic_link está seleccionado para entrega custom." : "El flujo de magic link usa el SDK de Neon Auth y puede operar con entrega nativa."}
              />
              <FeatureTile
                title="OTP"
                status={otpDeliveryEnabled ? (deliveryHandlerReady ? "Delivery listo" : "Requiere forward") : "SDK activo"}
                tone={otpDeliveryEnabled && !deliveryHandlerReady ? "warn" : "success"}
                detail={otpDeliveryEnabled ? "El evento send.otp está seleccionado para entrega custom." : "El flujo de OTP usa emailOtp del SDK y puede operar con entrega nativa."}
              />
              <FeatureTile
                title="Phone authentication"
                status={phoneAuthDetected ? "Detectado" : "Pendiente"}
                tone={phoneAuthDetected ? "success" : "info"}
                detail={phoneAuthDetected ? "El evento/plugin de teléfono aparece en la configuración visible." : "Activa Phone Number en Neon Auth antes de depender de SMS OTP."}
              />
            </div>
          </section>

          <section className="ui-admin-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="ui-admin-section-title">Eventos del webhook</h2>
                <p className="ui-admin-copy">Selecciona los eventos que se registrarán al pulsar Registrar webhook.</p>
              </div>
              <button className="ui-admin-action" type="button" onClick={() => void syncWebhook()} disabled={state === "loading"}>Guardar eventos</button>
            </div>
            {deliverySelected && !deliveryHandlerReady ? (
              <div className="ui-note ui-note--warning mt-4 text-sm">
                Los eventos send.magic_link y send.otp reemplazan la entrega nativa. Configura NEON_AUTH_WEBHOOK_FORWARD_URL o un handler propio antes de activarlos en producción.
              </div>
            ) : null}
            <div className="mt-4 grid gap-2">
              {[...CORE_WEBHOOK_EVENTS, ...DELIVERY_WEBHOOK_EVENTS].map((event) => {
                const copy = EVENT_LABELS[event];
                return (
                  <label key={event} className="flex items-start gap-3 rounded-lg border border-[color:var(--ui-border)] bg-white p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="mt-1"
                    />
                    <span className="grid gap-1">
                      <span className="font-semibold text-[color:var(--ui-text-primary)]">{copy.label}</span>
                      <span className="text-[color:var(--ui-text-secondary)]">{copy.detail}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="ui-admin-card">
            <h2 className="ui-admin-section-title">Actualizar OAuth provider</h2>
            <div className="ui-admin-grid ui-admin-grid--two">
              <label>Provider<select className="ui-admin-input" value={provider} onChange={(event) => setProvider(event.target.value)}><option value="google">Google</option><option value="github">GitHub</option><option value="microsoft">Microsoft</option><option value="vercel">Vercel</option></select></label>
              <label>Client ID<input className="ui-admin-input" value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="Nuevo client_id" /></label>
              <label>Client Secret<input className="ui-admin-input" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} placeholder="Nuevo client_secret" type="password" /></label>
              <label>Microsoft tenant ID<input className="ui-admin-input" value={tenantId} onChange={(event) => setTenantId(event.target.value)} placeholder="Solo Microsoft" /></label>
            </div>
            <button className="ui-admin-action" type="button" onClick={() => void updateProvider()} disabled={state === "loading"} style={{ marginTop: 12 }}>Guardar provider en Neon</button>
          </section>

          <section className="ui-admin-card">
            <h2 className="ui-admin-section-title">Últimos eventos recibidos</h2>
            {status.recentEvents?.length ? (
              <div className="ui-admin-table-wrap"><table className="ui-admin-table"><thead><tr><th>Evento</th><th>Recibido</th><th>Email</th><th>Forward</th><th>Estado</th></tr></thead><tbody>{status.recentEvents.map((event) => <tr key={event.id}><td>{event.event}</td><td>{new Date(event.receivedAt).toLocaleString("es-MX")}</td><td>{event.email ?? "—"}</td><td>{event.forwarded ? "Sí" : "No"}</td><td>{event.ok ? "OK" : event.error ?? "Error"}</td></tr>)}</tbody></table></div>
            ) : <p className="ui-admin-copy">Todavía no hay eventos recientes en esta instancia. Cuando Neon llame el webhook aparecerán aquí.</p>}
          </section>

          <section className="ui-admin-grid ui-admin-grid--two">
            <div><h2 className="ui-admin-section-title">Health endpoint</h2><JsonBlock value={status.health} /></div>
            <div><h2 className="ui-admin-section-title">Webhook en Neon</h2><JsonBlock value={status.webhookConfig} /></div>
            <div><h2 className="ui-admin-section-title">OAuth providers</h2><JsonBlock value={status.oauthProviders} /></div>
            <div><h2 className="ui-admin-section-title">Auth plugins</h2><JsonBlock value={status.authPlugins} /></div>
          </section>
        </>
      ) : (
        <section className="ui-admin-card"><p>{state === "loading" ? "Cargando integración..." : "Sin datos todavía."}</p></section>
      )}
    </div>
  );
}
