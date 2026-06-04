"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AdminSegmentedTabs from "@/components/admin/AdminSegmentedTabs";

type TokenStatus = "active" | "expired" | "revoked";
type TokenTarget = "gpt-actions" | "intranet-api";
type TokenDurationOption = "1h" | "8h" | "24h" | "7d" | "30d" | "365d" | "never";
type RequestState = "idle" | "loading" | "success" | "error";

type RecalcApiToken = {
  id: string;
  scope: string;
  client: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  status: TokenStatus;
};

type RecalcApiTokenPayload = {
  integration: {
    scope: string;
    tokenType: "Bearer";
    authHeader: string;
    openApiUrl: string;
    openApiSchemas?: OpenApiSchemaLink[];
    serverUrl: string;
    maxTtlHours: number;
    clients: string[];
    actionsReady: boolean;
  };
  tokens: RecalcApiToken[];
};

type OpenApiSchemaLink = {
  id: string;
  label: string;
  url: string;
  actionCount: number;
  maxActions: number;
};

type CreatedToken = {
  token: string;
  expiresAt: string;
  ttlPreset?: string | null;
};

const TARGET_COPY: Record<TokenTarget, { label: string; description: string; client: string }> = {
  "gpt-actions": {
    label: "GPT Actions",
    description: "Token personal para configurar la acción con OpenAPI y Bearer Auth.",
    client: "gpt-actions",
  },
  "intranet-api": {
    label: "Intranet",
    description: "Token personal para sincronización desde intranet u otro backend controlado.",
    client: "intranet-api",
  },
};

const PANEL_CLASS = "rounded-2xl border border-[color:var(--admin-shell-border)] bg-white p-4 shadow-sm";
const EYEBROW_CLASS = "text-xs font-black uppercase tracking-[0.14em] text-[color:var(--admin-shell-muted)]";
const TITLE_CLASS = "mt-1 text-2xl font-black text-[color:var(--admin-shell-ink)]";
const SECTION_TITLE_CLASS = "text-base font-black text-[color:var(--admin-shell-ink)]";
const COPY_CLASS = "mt-1 max-w-3xl text-sm leading-6 text-[color:var(--admin-shell-muted)]";
const LABEL_CLASS = "grid min-w-0 gap-2 text-sm font-semibold text-[color:var(--admin-shell-ink)]";
const INPUT_CLASS =
  "min-w-0 w-full flex-1 rounded-xl border border-[color:var(--admin-shell-border)] bg-white px-3 py-2 text-sm text-[color:var(--admin-shell-ink)] shadow-sm";
const SUCCESS_MESSAGE_CLASS = "mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800";
const ERROR_MESSAGE_CLASS = "mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800";

const TOKEN_DURATION_OPTIONS: Array<{ value: TokenDurationOption; label: string }> = [
  { value: "1h", label: "1 hora" },
  { value: "8h", label: "8 horas" },
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "365d", label: "1 año" },
  { value: "never", label: "Nunca expira" },
];

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error ?? "La operación falló.");
  return payload as T;
}

function formatDate(value: string | null) {
  if (!value) return "Sin uso";
  if (value.startsWith("9999-12-31")) return "Nunca";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function tokenDurationPayload(value: TokenDurationOption) {
  if (value === "1h") return { ttlHours: 1 };
  if (value === "8h") return { ttlHours: 8 };
  return { ttlPreset: value };
}

function statusChip(status: TokenStatus) {
  if (status === "active") return "ui-admin-chip ui-admin-chip--success";
  if (status === "revoked") return "ui-admin-chip ui-admin-chip--danger";
  return "ui-admin-chip ui-admin-chip--warn";
}

function statusLabel(status: TokenStatus) {
  if (status === "active") return "Activo";
  if (status === "revoked") return "Revocado";
  return "Expirado";
}

export default function RecalcApiTokensPanel() {
  const [payload, setPayload] = useState<RecalcApiTokenPayload | null>(null);
  const [target, setTarget] = useState<TokenTarget>("gpt-actions");
  const [client, setClient] = useState(TARGET_COPY["gpt-actions"].client);
  const [tokenDuration, setTokenDuration] = useState<TokenDurationOption>("24h");
  const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null);
  const [state, setState] = useState<RequestState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const activeTokenCount = useMemo(
    () => payload?.tokens.filter((token) => token.status === "active").length ?? 0,
    [payload?.tokens],
  );

  const selectedTarget = TARGET_COPY[target];
  const schemaLinks = useMemo<OpenApiSchemaLink[]>(() => {
    if (payload?.integration.openApiSchemas?.length) return payload.integration.openApiSchemas;
    if (!payload?.integration.openApiUrl) return [];
    return [
      {
        id: "full",
        label: "OpenAPI completo",
        url: payload.integration.openApiUrl,
        actionCount: 0,
        maxActions: 0,
      },
    ];
  }, [payload]);
  const primarySchemaUrl =
    schemaLinks[0]?.url ?? payload?.integration.openApiUrl ?? "/api/public/recalc/openapi/gpt-core.json";

  const refresh = useCallback(async () => {
    setState("loading");
    setMessage(null);
    try {
      const next = await readJson<RecalcApiTokenPayload>("/api/admin/recalc-api/tokens");
      setPayload(next);
      setState("success");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo sincronizar el estado.");
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  function selectTarget(nextTarget: TokenTarget) {
    setTarget(nextTarget);
    setClient(TARGET_COPY[nextTarget].client);
    setCreatedToken(null);
  }

  async function copyText(value: string, successMessage: string) {
    await navigator.clipboard.writeText(value);
    setMessage(successMessage);
    setState("success");
  }

  async function createToken() {
    setState("loading");
    setMessage(null);
    setCreatedToken(null);
    try {
      const next = await readJson<RecalcApiTokenPayload & CreatedToken>(
        "/api/admin/recalc-api/tokens",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client, ...tokenDurationPayload(tokenDuration) }),
        },
      );
      setPayload({ integration: next.integration, tokens: next.tokens });
      setCreatedToken({ token: next.token, expiresAt: next.expiresAt, ttlPreset: next.ttlPreset });
      setState("success");
      setMessage(`Token ${selectedTarget.label} creado. Copia el valor antes de salir.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo crear el token.");
    }
  }

  async function revokeToken(tokenId: string) {
    setState("loading");
    setMessage(null);
    try {
      await readJson(`/api/admin/recalc-api/tokens/${tokenId}`, { method: "DELETE" });
      await refresh();
      setMessage("Token revocado.");
      setState("success");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo revocar el token.");
    }
  }

  return (
    <div className="grid gap-4">
      <section className={PANEL_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={EYEBROW_CLASS}>Integraciones</div>
            <h1 className={TITLE_CLASS}>Tokens API Recalc</h1>
            <p className={COPY_CLASS}>
              Emite tokens personales para la API pública de Recalc y sincroniza el contrato OpenAPI usado por GPT Actions o intranet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="ui-admin-action ui-admin-action--secondary" type="button" onClick={() => void refresh()} disabled={state === "loading"}>
              Sincronizar
            </button>
            <a className="ui-admin-action" href={primarySchemaUrl} target="_blank" rel="noreferrer">
              Abrir schema
            </a>
          </div>
        </div>
        {message ? <p className={state === "error" ? ERROR_MESSAGE_CLASS : SUCCESS_MESSAGE_CLASS}>{message}</p> : null}
      </section>

      <section className={PANEL_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className={SECTION_TITLE_CLASS}>Conexión lista</h2>
            <p className={COPY_CLASS}>
              Usa el schema OpenAPI y Bearer Auth. La API hereda los permisos de la cuenta que emite el token.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="ui-admin-chip ui-admin-chip--success">Scope: {payload?.integration.scope ?? "public-api:recalc"}</span>
            <span className="ui-admin-chip">Activos: {activeTokenCount}</span>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className={LABEL_CLASS}>
            <span>Schema OpenAI / GPT Actions</span>
            <div className="grid gap-2">
              {schemaLinks.length ? schemaLinks.map((schema) => (
                <div className="grid gap-2" key={schema.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{schema.label}</strong>
                    {schema.maxActions ? (
                      <span className="ui-admin-chip">
                        {schema.actionCount}/{schema.maxActions} actions
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input className={`${INPUT_CLASS} font-mono`} readOnly value={schema.url} />
                    <button
                      className="ui-admin-action ui-admin-action--secondary"
                      type="button"
                      onClick={() => void copyText(schema.url, "URL de schema copiada.")}
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )) : (
                <input className={`${INPUT_CLASS} font-mono`} readOnly value="" />
              )}
            </div>
          </div>
          <label className={LABEL_CLASS}>
            <span>Encabezado de autenticación</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className={`${INPUT_CLASS} font-mono`} readOnly value={payload?.integration.authHeader ?? "Authorization: Bearer <token>"} />
              <button
                className="ui-admin-action ui-admin-action--secondary"
                type="button"
                onClick={() => void copyText(payload?.integration.authHeader ?? "Authorization: Bearer <token>", "Header copiado.")}
              >
                Copiar
              </button>
            </div>
          </label>
        </div>
      </section>

      <section className={PANEL_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className={SECTION_TITLE_CLASS}>Crear token</h2>
            <p className={COPY_CLASS}>{selectedTarget.description}</p>
          </div>
          <AdminSegmentedTabs
            ariaLabel="Destino del token API"
            items={[
              { id: "gpt-actions", label: TARGET_COPY["gpt-actions"].label },
              { id: "intranet-api", label: TARGET_COPY["intranet-api"].label },
            ]}
            activeId={target}
            onChange={(id) => selectTarget(id as TokenTarget)}
            tone="light"
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
          <label className={LABEL_CLASS}>
            <span>Cliente</span>
            <input className={INPUT_CLASS} value={client} maxLength={80} onChange={(event) => setClient(event.target.value)} />
          </label>
          <label className={LABEL_CLASS}>
            <span>Vigencia</span>
            <select
              className={INPUT_CLASS}
              value={tokenDuration}
              onChange={(event) => setTokenDuration(event.target.value as TokenDurationOption)}
            >
              {TOKEN_DURATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="ui-admin-action" type="button" style={{ marginTop: 12 }} onClick={() => void createToken()} disabled={state === "loading" || !client.trim()}>
          Crear token {selectedTarget.label}
        </button>

        {createdToken ? (
          <div className="ui-note ui-note--warning mt-4 text-sm">
            <strong>Token visible una sola vez.</strong>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input className={`${INPUT_CLASS} font-mono`} readOnly value={createdToken.token} />
              <button className="ui-admin-action" type="button" onClick={() => void copyText(createdToken.token, "Token copiado.")}>
                Copiar token
              </button>
            </div>
            <p className="mt-2">Expira: {formatDate(createdToken.expiresAt)}.</p>
          </div>
        ) : null}
      </section>

      <section className={PANEL_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className={SECTION_TITLE_CLASS}>Tokens emitidos</h2>
            <p className={COPY_CLASS}>Listado de tokens personales para Recalc API. No se muestran secretos ni hashes.</p>
          </div>
          <span className="ui-admin-chip">TTL: hasta 1 año o nunca</span>
        </div>
        {payload?.tokens.length ? (
          <div className="ui-admin-table-shell">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Expira</th>
                  <th>Último uso</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {payload.tokens.map((token) => (
                  <tr key={token.id}>
                    <td>
                      <strong>{token.client ?? "Sin cliente"}</strong>
                      <div className="text-xs text-[color:var(--ui-text-secondary)]">{token.id}</div>
                    </td>
                    <td><span className={statusChip(token.status)}>{statusLabel(token.status)}</span></td>
                    <td>{formatDate(token.createdAt)}</td>
                    <td>{formatDate(token.expiresAt)}</td>
                    <td>{formatDate(token.lastUsedAt)}</td>
                    <td>
                      <button
                        className="ui-admin-action ui-admin-action--danger"
                        type="button"
                        disabled={state === "loading" || token.status !== "active"}
                        onClick={() => void revokeToken(token.id)}
                      >
                        Revocar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={COPY_CLASS}>{state === "loading" ? "Sincronizando tokens..." : "Todavía no hay tokens API para esta cuenta."}</p>
        )}
      </section>
    </div>
  );
}
