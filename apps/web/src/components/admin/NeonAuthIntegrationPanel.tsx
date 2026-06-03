"use client";

import { useEffect, useMemo, useState } from "react";

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

  const integrationOk = useMemo(() => {
    if (!status) return false;
    return Boolean(status.env.NEON_API_KEY && status.health && !status.errors.length);
  }, [status]);

  async function refresh() {
    setState("loading");
    setMessage(null);
    try {
      const payload = await readJson<StatusPayload>("/api/admin/integrations/neon-auth/status");
      setStatus(payload);
      setState("success");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el estado.");
    }
  }

  async function syncWebhook() {
    setState("loading");
    setMessage(null);
    try {
      await readJson("/api/admin/integrations/neon-auth/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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

  useEffect(() => {
    void refresh();
  }, []);

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
