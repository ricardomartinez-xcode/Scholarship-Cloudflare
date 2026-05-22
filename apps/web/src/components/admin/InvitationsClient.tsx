"use client";

import { useEffect, useMemo, useState } from "react";

import {
  downloadCsv,
  type AdminTableDensity,
} from "@/components/admin/admin-table-utils";
import { useAdminUiPreferences } from "@/components/admin/useAdminUiPreferences";
import type { InviteStatus } from "@/lib/invites";

type InviteRow = {
  id: string;
  email: string;
  role: string;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  cancelledAt: string | null;
  createdByEmail: string;
  organizationId: string | null;
  organizationName: string | null;
};

type ApiResult = {
  ok: boolean;
  error?: string;
  code?: string;
  requestId?: string;
  mailSent?: boolean;
  warning?: string;
  acceptUrl?: string;
  deliveryMethod?: DeliveryMethod;
  missing?: string[];
  invites?: InviteRow[];
  smtp?: SmtpStatus;
};

type FetchFailure = {
  message: string;
  status?: number;
  code?: string;
  requestId?: string;
  kind: "network" | "http";
};

type VisibleColumns = {
  email: boolean;
  organization: boolean;
  role: boolean;
  status: boolean;
  createdAt: boolean;
  expiresAt: boolean;
  createdBy: boolean;
};

type InvitationsPreferenceState = {
  query: string;
  page: number;
  tableExpanded: boolean;
  density: AdminTableDensity;
  visibleColumns: VisibleColumns;
};

const PAGE_SIZE = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITATION_COLUMNS = [
  "email",
  "organization",
  "role",
  "status",
  "createdAt",
  "expiresAt",
  "createdBy",
] as const;

const INVITATIONS_DEFAULTS: InvitationsPreferenceState = {
  query: "",
  page: 1,
  tableExpanded: true,
  density: "comfortable",
  visibleColumns: {
    email: true,
    organization: true,
    role: true,
    status: true,
    createdAt: true,
    expiresAt: true,
    createdBy: true,
  },
};

const statusLabel: Record<InviteStatus, string> = {
  pending: "Pendiente",
  used: "Usada",
  expired: "Expirada",
  cancelled: "Cancelada",
};

const statusTone: Record<InviteStatus, string> = {
  pending: "border-blue-900/40 bg-blue-950/20 text-emerald-200",
  used: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  expired: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  cancelled: "border-red-500/30 bg-red-500/10 text-red-200",
};

const columnLabels: Record<keyof VisibleColumns, string> = {
  email: "Correo",
  organization: "Organización",
  role: "Rol",
  status: "Estado",
  createdAt: "Creada",
  expiresAt: "Expira",
  createdBy: "Creada por",
};

type SmtpStatus = { ok: true } | { ok: false; missing: string[] };
type DeliveryMethod = "email" | "link";

const isJsonResponse = (contentType: string | null) =>
  contentType?.toLowerCase().includes("application/json") ?? false;

function getMessageByError(error: FetchFailure, fallback: string) {
  if (error.kind === "network") {
    return "Error de red. Verifica tu conexión e intenta de nuevo.";
  }

  if (error.status === 401 || error.code === "UNAUTHORIZED") {
    return "Sesión expirada. Inicia sesión nuevamente.";
  }

  if (error.status === 429 || error.code === "RATE_LIMITED") {
    return "Demasiadas solicitudes. Espera un momento e intenta de nuevo.";
  }

  if ((error.status ?? 0) >= 500) {
    return `Error interno del backend (${error.status}).`;
  }

  return error.message || fallback;
}

async function safeJsonFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(input, init);
  } catch {
    throw {
      message: "No fue posible conectar con el servidor.",
      kind: "network",
    } as FetchFailure;
  }

  const contentType = res.headers.get("content-type");

  if (!isJsonResponse(contentType)) {
    const text = await res.text();
    throw {
      message: `Respuesta no JSON (HTTP ${res.status}). ${text.slice(0, 180)}`,
      status: res.status,
      kind: "http",
    } as FetchFailure;
  }

  const data = (await res.json()) as ApiResult;

  if (!res.ok || !data.ok) {
    throw {
      message: data.error ?? `Error HTTP ${res.status}`,
      status: res.status,
      code: data.code,
      requestId: data.requestId,
      kind: "http",
    } as FetchFailure;
  }

  return data as T;
}

type OrgOption = { id: string; display_name: string };

export default function InvitationsClient({
  currentAdmin,
  initialInvites,
  initialSmtp,
  teams = [],
  roleOptions,
}: {
  currentAdmin: {
    canManageInvites: boolean;
  };
  initialInvites: InviteRow[];
  initialSmtp?: SmtpStatus;
  teams?: OrgOption[];
  roleOptions: Array<{ value: string; label: string }>;
}) {
  const prefs = useAdminUiPreferences("INVITATIONS", INVITATIONS_DEFAULTS);
  const [invites, setInvites] = useState<InviteRow[]>(initialInvites);
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(initialSmtp ?? null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(roleOptions[0]?.value ?? "user");
  const [orgId, setOrgId] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    initialSmtp && !initialSmtp.ok ? "link" : "email",
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [lastInviteRecipient, setLastInviteRecipient] = useState<string | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (smtpStatus && !smtpStatus.ok && deliveryMethod === "email") {
      setDeliveryMethod("link");
    }
  }, [deliveryMethod, smtpStatus]);

  const filtered = useMemo(() => {
    const q = prefs.state.query.trim().toLowerCase();
    if (!q) return invites;
    return invites.filter((row) =>
      [
        row.email,
        row.organizationName,
        row.createdByEmail,
        row.role,
        statusLabel[row.status],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [invites, prefs.state.query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(prefs.state.page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  const selectedRows = filtered.filter((row) => selectedIds.includes(row.id));
  const allVisibleSelected =
    pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id));
  const bulkMutableRows = selectedRows.filter((row) => row.status !== "used");
  const bulkHasUsedRows = selectedRows.some((row) => row.status === "used");
  const compact = prefs.state.density === "compact";
  const cellClassName = compact ? "p-2" : "p-3";
  const visibleColumns = prefs.state.visibleColumns;

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString("es-MX") : "n/a";

  function toggleSelectOne(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  }

  function toggleSelectVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !pageRows.some((row) => row.id === id));
      }
      const next = new Set(current);
      pageRows.forEach((row) => next.add(row.id));
      return Array.from(next);
    });
  }

  async function reloadInvites() {
    setLoading(true);
    try {
      const data = await safeJsonFetch<{
        ok: true;
        requestId?: string;
        smtp?: SmtpStatus;
        invites?: InviteRow[];
      }>("/api/admin/invites", { cache: "no-store" });
      const nextInvites = data.invites ?? [];
      const nextIds = new Set(nextInvites.map((invite) => invite.id));
      setLastRequestId(data.requestId ?? null);
      setSmtpStatus(data.smtp ?? null);
      setInvites(nextInvites);
      setSelectedIds((current) => current.filter((id) => nextIds.has(id)));
    } catch (err) {
      const fetchError = err as FetchFailure;
      setLastRequestId(fetchError.requestId ?? null);
      setMessage(getMessageByError(fetchError, "No fue posible cargar invitaciones."));
    } finally {
      setLoading(false);
    }
  }

  async function createInvitation() {
    setMessage("");
    setLastInviteUrl(null);
    setLastInviteRecipient(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_RE.test(normalizedEmail)) {
      setMessage("Captura un correo válido antes de crear la invitación.");
      return;
    }

    setSaving(true);
    try {
      if (deliveryMethod === "email" && smtpStatus && !smtpStatus.ok) {
        throw {
          message: "Falta configurar SMTP para enviar invitaciones por correo.",
          kind: "http",
        } as FetchFailure;
      }
      const data = await safeJsonFetch<ApiResult>("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          role,
          organizationId: orgId || undefined,
          deliveryMethod,
        }),
      });
      setLastRequestId(data.requestId ?? null);
      setEmail("");
      setRole(roleOptions[0]?.value ?? "user");
      setOrgId("");
      setLastInviteUrl(data.acceptUrl ?? null);
      setLastInviteRecipient(data.acceptUrl ? normalizedEmail : null);
      setMessage(
        deliveryMethod === "link"
          ? "Enlace generado. Compártelo manualmente."
          : data.mailSent
            ? "Invitación enviada."
            : data.warning
              ? `Invitación creada. ${data.warning}`
              : "Invitación creada. Copia el enlace para compartir."
      );
      await reloadInvites();
    } catch (err) {
      const fetchError = err as FetchFailure;
      setLastRequestId(fetchError.requestId ?? null);
      setMessage(getMessageByError(fetchError, "No fue posible crear la invitación."));
    } finally {
      setSaving(false);
    }
  }

  async function patchInvitation(action: "resend" | "cancel", id: string) {
    setMessage("");
    setLastInviteUrl(null);
    setLastInviteRecipient(null);
    setSaving(true);
    try {
      const data = await safeJsonFetch<ApiResult>("/api/admin/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      setLastRequestId(data.requestId ?? null);
      if (action === "resend") {
        setLastInviteUrl(data.acceptUrl ?? null);
        setMessage(
          data.mailSent
            ? "Invitación reenviada."
            : data.warning
              ? `Invitación regenerada. ${data.warning}`
              : "Invitación regenerada."
        );
      } else {
        setMessage("Invitación cancelada.");
      }
      await reloadInvites();
    } catch (err) {
      const fetchError = err as FetchFailure;
      setLastRequestId(fetchError.requestId ?? null);
      setMessage(getMessageByError(fetchError, "No fue posible actualizar la invitación."));
    } finally {
      setSaving(false);
    }
  }

  async function runBulkAction(action: "cancel" | "delete") {
    if (!bulkMutableRows.length) return;

    if (bulkHasUsedRows) {
      setMessage("Quita las invitaciones usadas de la selección antes de aplicar acciones en lote.");
      return;
    }

    const confirmed = window.confirm(
      action === "cancel"
        ? `¿Cancelar ${bulkMutableRows.length} invitación(es) seleccionadas?`
        : `¿Eliminar ${bulkMutableRows.length} invitación(es) seleccionadas?`,
    );
    if (!confirmed) return;

    setMessage("");
    setLastInviteUrl(null);
    setLastInviteRecipient(null);
    setSaving(true);
    try {
      const data = await safeJsonFetch<ApiResult>("/api/admin/invites", {
        method: action === "cancel" ? "PATCH" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body:
          action === "cancel"
            ? JSON.stringify({
                action,
                ids: bulkMutableRows.map((row) => row.id),
              })
            : JSON.stringify({ ids: bulkMutableRows.map((row) => row.id) }),
      });
      setLastRequestId(data.requestId ?? null);
      setMessage(
        action === "cancel"
          ? "Invitaciones canceladas."
          : "Invitaciones eliminadas.",
      );
      setSelectedIds([]);
      await reloadInvites();
    } catch (err) {
      const fetchError = err as FetchFailure;
      setLastRequestId(fetchError.requestId ?? null);
      setMessage(
        getMessageByError(
          fetchError,
          action === "cancel"
            ? "No fue posible cancelar las invitaciones."
            : "No fue posible eliminar las invitaciones.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeInvitation(id: string) {
    const ok = window.confirm("¿Eliminar esta invitación? Se perderá el enlace actual.");
    if (!ok) return;
    setMessage("");
    setLastInviteUrl(null);
    setLastInviteRecipient(null);
    setSaving(true);
    try {
      const data = await safeJsonFetch<ApiResult>("/api/admin/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setLastRequestId(data.requestId ?? null);
      setMessage("Invitación eliminada.");
      setSelectedIds((current) => current.filter((currentId) => currentId !== id));
      await reloadInvites();
    } catch (err) {
      const fetchError = err as FetchFailure;
      setLastRequestId(fetchError.requestId ?? null);
      setMessage(getMessageByError(fetchError, "No fue posible eliminar la invitación."));
    } finally {
      setSaving(false);
    }
  }

  function exportRows(rows: InviteRow[]) {
    downloadCsv(
      "admin-invitations.csv",
      rows.map((row) => ({
        email: row.email,
        organization: row.organizationName ?? "",
        role: row.role,
        status: statusLabel[row.status],
        createdAt: formatDate(row.createdAt),
        expiresAt: formatDate(row.expiresAt),
        createdBy: row.createdByEmail,
      })),
    );
  }

  const smtpBlocked = Boolean(smtpStatus && !smtpStatus.ok);
  const missingVars = smtpStatus && !smtpStatus.ok ? smtpStatus.missing : [];

  return (
    <div className="grid gap-6">
      <section className="ui-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mt-1 text-lg font-semibold">Invitaciones</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">
              Crea invitaciones, asígnalas a una organización y administra su ciclo de vida:
              pendiente, usada, expirada o cancelada.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void reloadInvites()}
              disabled={loading}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-60"
            >
              {loading ? "Actualizando..." : "Recargar"}
            </button>
            <button
              type="button"
              onClick={() =>
                prefs.patchState({
                  density:
                    prefs.state.density === "compact" ? "comfortable" : "compact",
                })
              }
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:bg-white/10"
            >
              Densidad: {prefs.state.density === "compact" ? "compacta" : "cómoda"}
            </button>
            <button
              type="button"
              onClick={() =>
                prefs.patchState({ tableExpanded: !prefs.state.tableExpanded })
              }
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:bg-white/10"
            >
              {prefs.state.tableExpanded ? "Contraer tabla" : "Expandir tabla"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/25 p-4 xl:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Ayuda operativa
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Reenviar genera un enlace nuevo. Cancelar inhabilita el enlace sin
              borrar historial. Eliminar sólo conviene para limpiar invitaciones no usadas.
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Organización
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Si asignas una organización, el usuario quedará ligado a ella al aceptar
              la invitación. El rol define el acceso global del sistema y no debe usarse
              para “simular” membresías de organización.
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Estado persistente
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Búsqueda, densidad, columnas y expansión de tabla se guardan por usuario y módulo.
            </p>
          </div>
        </div>

        {smtpBlocked ? (
          <div className="mt-6 rounded-2xl border border-red-300 bg-red-100 px-4 py-3 text-sm font-medium text-red-950">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-red-800">
              Envío por correo no disponible
            </div>
            <p className="mt-2">
              Falta configurar SMTP para enviar invitaciones por correo. Mientras tanto,
              puedes generar enlaces directos personalizados y compartirlos manualmente.
            </p>
            {missingVars.length ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-white/55 px-3 py-2 text-xs text-red-900">
                Faltan: <span className="font-semibold">{missingVars.join(", ")}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="ui-card grid gap-4 p-4 sm:p-5">
        <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-slate-100">Método de entrega</legend>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <input
                  type="radio"
                  name="deliveryMethod"
                  value="email"
                  checked={deliveryMethod === "email"}
                  onChange={() => setDeliveryMethod("email")}
                  disabled={!currentAdmin.canManageInvites || smtpBlocked}
                  className="mt-1"
                />
                <span className="grid gap-1">
                  <span className="font-semibold text-slate-100">Enviar por correo</span>
                  <span className="text-xs text-slate-400">
                    {smtpBlocked
                      ? "Requiere SMTP configurado para habilitarse."
                      : "ReCalc envía la invitación directamente al correo capturado."}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <input
                  type="radio"
                  name="deliveryMethod"
                  value="link"
                  checked={deliveryMethod === "link"}
                  onChange={() => setDeliveryMethod("link")}
                  disabled={!currentAdmin.canManageInvites}
                  className="mt-1"
                />
                <span className="grid gap-1">
                  <span className="font-semibold text-slate-100">Generar enlace directo</span>
                  <span className="text-xs text-slate-400">
                    Crea un enlace personalizado ligado al correo capturado para compartirlo
                    manualmente.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_220px_auto]">
            <label className="grid gap-2 text-sm">
              Correo
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="ui-control"
                placeholder="usuario@dominio.com"
                disabled={!currentAdmin.canManageInvites}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Rol
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="ui-control"
                disabled={!currentAdmin.canManageInvites}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              Organización
              <select
                value={orgId}
                onChange={(event) => setOrgId(event.target.value)}
                className="ui-control"
                disabled={!currentAdmin.canManageInvites}
              >
                <option value="">Sin asignar</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.display_name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void createInvitation()}
              disabled={
                saving ||
                !email.trim() ||
                !currentAdmin.canManageInvites ||
                (deliveryMethod === "email" && smtpBlocked)
              }
              className="self-end rounded-2xl bg-blue-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100"
            >
              {saving
                ? "Procesando..."
                : deliveryMethod === "link"
                  ? "Generar enlace"
                  : "Enviar invitación"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-xs text-slate-400">
          El enlace queda ligado al correo capturado y sólo funcionará cuando la persona
          invitada use ese mismo correo. Reenvía cuando quieras regenerar el enlace actual.
          Cancela para inhabilitar una invitación sin perder trazabilidad. Eliminar sólo se
          permite para invitaciones no usadas.
        </div>

        {!currentAdmin.canManageInvites ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Tu acceso actual es de solo consulta para este módulo.
          </div>
        ) : null}

        {message ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100">
            {message}
            {lastRequestId ? (
              <div className="mt-1 text-xs text-slate-400">ID de soporte: {lastRequestId}</div>
            ) : null}
          </div>
        ) : null}

        {lastInviteUrl ? (
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Enlace de invitación
            </div>
            {lastInviteRecipient ? (
              <div className="text-sm text-slate-300">
                Vinculado a <span className="font-mono">{lastInviteRecipient}</span>
              </div>
            ) : null}
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <input
                aria-label="Enlace de invitación"
                className="ui-control min-w-0"
                value={lastInviteUrl}
                readOnly
              />
              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(lastInviteUrl);
                    setMessage("Enlace copiado.");
                  } catch {
                    setMessage("No fue posible copiar. Selecciona el enlace y copia manualmente.");
                  }
                }}
              >
                Copiar
              </button>
            </div>
            <a
              href={lastInviteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-emerald-300 underline"
            >
              Abrir enlace
            </a>
          </div>
        ) : null}
      </section>

      <section className="ui-card grid gap-4 p-4 sm:p-5">
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <label className="grid gap-1 text-xs text-slate-400">
            Buscar correo, organización, rol o creador
            <input
              value={prefs.state.query}
              onChange={(event) =>
                prefs.patchState({ query: event.target.value, page: 1 })
              }
              className="ui-control w-full sm:min-w-[240px]"
              placeholder="usuario@dominio.com"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportRows(selectedRows.length ? selectedRows : filtered)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:bg-white/10"
            >
              Exportar CSV
            </button>
            {currentAdmin.canManageInvites ? (
              <>
                <button
                  type="button"
                  disabled={!selectedIds.length || bulkHasUsedRows || saving}
                  onClick={() => void runBulkAction("cancel")}
                  className="rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-950 transition hover:bg-amber-200 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100"
                >
                  Cancelar lote
                </button>
                <button
                  type="button"
                  disabled={!selectedIds.length || bulkHasUsedRows || saving}
                  onClick={() => void runBulkAction("delete")}
                  className="rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-950 transition hover:bg-red-200 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100"
                >
                  Eliminar lote
                </button>
              </>
            ) : null}
            <div className="text-xs text-slate-400">{filtered.length} invitaciones</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4 text-sm text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Columnas visibles
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Exporta la selección actual o todo el resultado filtrado.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {INVITATION_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[column]}
                    onChange={(event) =>
                      prefs.patchState({
                        visibleColumns: {
                          ...visibleColumns,
                          [column]: event.target.checked,
                        },
                      })
                    }
                  />
                  {columnLabels[column]}
                </label>
              ))}
            </div>
          </div>
        </div>

        {prefs.state.tableExpanded ? (
          <div className="ui-scrollbar overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-950/95 text-slate-300 backdrop-blur">
                <tr>
                  <th className={`${cellClassName} w-[56px] text-center font-semibold`}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectVisible}
                    />
                  </th>
                  {visibleColumns.email ? (
                    <th className={`${cellClassName} w-[250px] text-left font-semibold`}>
                      Correo
                    </th>
                  ) : null}
                  {visibleColumns.organization ? (
                    <th className={`${cellClassName} w-[180px] text-left font-semibold`}>
                      Organización
                    </th>
                  ) : null}
                  {visibleColumns.role ? (
                    <th className={`${cellClassName} w-[90px] text-left font-semibold`}>
                      Rol
                    </th>
                  ) : null}
                  {visibleColumns.status ? (
                    <th className={`${cellClassName} w-[120px] text-left font-semibold`}>
                      Estado
                    </th>
                  ) : null}
                  {visibleColumns.createdAt ? (
                    <th className={`${cellClassName} w-[170px] text-left font-semibold`}>
                      Creada
                    </th>
                  ) : null}
                  {visibleColumns.expiresAt ? (
                    <th className={`${cellClassName} w-[170px] text-left font-semibold`}>
                      Expira
                    </th>
                  ) : null}
                  {visibleColumns.createdBy ? (
                    <th className={`${cellClassName} w-[220px] text-left font-semibold`}>
                      Creada por
                    </th>
                  ) : null}
                  <th className={`${cellClassName} w-[220px] text-right font-semibold`}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className="border-t border-white/10 align-top">
                    <td className={`${cellClassName} text-center`}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelectOne(row.id)}
                      />
                    </td>
                    {visibleColumns.email ? (
                      <td className={`${cellClassName} max-w-[250px] text-slate-100`}>
                        <span className="block truncate" title={row.email}>
                          {row.email}
                        </span>
                      </td>
                    ) : null}
                    {visibleColumns.organization ? (
                      <td className={`${cellClassName} text-slate-300`}>
                        {row.organizationName ?? "Sin asignar"}
                      </td>
                    ) : null}
                    {visibleColumns.role ? (
                      <td className={`${cellClassName} whitespace-nowrap text-slate-100`}>
                        {row.role}
                      </td>
                    ) : null}
                    {visibleColumns.status ? (
                      <td className={`${cellClassName} whitespace-nowrap`}>
                        <span className={`rounded-full border px-2 py-1 text-xs ${statusTone[row.status]}`}>
                          {statusLabel[row.status]}
                        </span>
                      </td>
                    ) : null}
                    {visibleColumns.createdAt ? (
                      <td className={`${cellClassName} text-slate-200`}>
                        {formatDate(row.createdAt)}
                      </td>
                    ) : null}
                    {visibleColumns.expiresAt ? (
                      <td className={`${cellClassName} text-slate-200`}>
                        {formatDate(row.expiresAt)}
                      </td>
                    ) : null}
                    {visibleColumns.createdBy ? (
                      <td className={`${cellClassName} max-w-[220px] text-slate-200`}>
                        <span className="block truncate" title={row.createdByEmail}>
                          {row.createdByEmail}
                        </span>
                      </td>
                    ) : null}
                    <td className={cellClassName}>
                      <div className="flex justify-end gap-2">
                        {row.status !== "used" ? (
                          <button
                            type="button"
                            disabled={saving || !currentAdmin.canManageInvites}
                            onClick={() => void patchInvitation("resend", row.id)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:opacity-60"
                          >
                            Reenviar
                          </button>
                        ) : null}
                        {row.status === "pending" ? (
                          <button
                            type="button"
                            disabled={saving || !currentAdmin.canManageInvites}
                            onClick={() => void patchInvitation("cancel", row.id)}
                            className="rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-950 transition hover:bg-amber-200 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100"
                          >
                            Cancelar
                          </button>
                        ) : null}
                        {row.status !== "used" ? (
                          <button
                            type="button"
                            disabled={saving || !currentAdmin.canManageInvites}
                            onClick={() => void removeInvitation(row.id)}
                            className="rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-950 transition hover:bg-red-200 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100"
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!pageRows.length ? (
                  <tr>
                    <td className="p-4 text-slate-300" colSpan={9}>
                      Sin resultados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-sm text-slate-400">
            La tabla está contraída. Puedes expandirla desde el encabezado del módulo.
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <div>
            Página {currentPage} de {totalPages} ({filtered.length} invitaciones)
            {selectedIds.length ? ` · ${selectedIds.length} seleccionadas` : ""}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                prefs.patchState({ page: Math.max(1, currentPage - 1) })
              }
              disabled={currentPage <= 1}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() =>
                prefs.patchState({ page: Math.min(totalPages, currentPage + 1) })
              }
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
