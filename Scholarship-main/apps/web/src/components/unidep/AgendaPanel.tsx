"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AgendaType = "recordatorio" | "pago" | "pendiente";
type AgendaStatus = "abierto" | "hecho" | "cancelado";

type AgendaItem = {
  id: string;
  type: AgendaType;
  status: AgendaStatus;
  title: string;
  notes: string | null;
  dueAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type GoogleConnectionState = {
  connected: boolean;
  calendarConnected: boolean;
  tasksConnected: boolean;
  sheetsConnected: boolean;
  contactsConnected: boolean;
  scopes: string[];
  lastSyncError: string | null;
  updatedAt: string;
};

type GoogleServiceState = {
  key: "identity" | "calendar" | "tasks" | "sheets" | "contacts";
  label: string;
  connected: boolean;
  missingScopes: string[];
};

type AgendaIntegrationState = {
  provider: string;
  connectionStatus: string;
  googleReady: {
    ready: boolean;
    missing: string[];
  };
  serviceStates: GoogleServiceState[];
  identityOnlyLogin: boolean;
  integrationSummary: string;
  connection: GoogleConnectionState | null;
  preference: {
    syncCalendarEnabled: boolean;
    syncTasksEnabled: boolean;
    syncSheetsEnabled: boolean;
    calendarId: string | null;
    tasklistId: string | null;
    spreadsheetId: string | null;
    worksheetName: string | null;
    lastSyncedAt: string | null;
  } | null;
};

type GoogleTasklistSummary = {
  id: string;
  title: string;
  updated: string | null;
};

type GoogleTaskSummary = {
  id: string;
  title: string;
  notes: string | null;
  due: string | null;
  status: string;
  updated: string | null;
  tasklistId: string;
  tasklistTitle: string;
  webViewLink: string | null;
};

type GoogleCalendarSummary = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string | null;
};

type GoogleCalendarEventSummary = {
  id: string;
  summary: string;
  description: string | null;
  start: string | null;
  end: string | null;
  status: string | null;
  htmlLink: string | null;
  calendarId: string;
  calendarSummary: string;
};

type GooglePreviewState = {
  tasklists: GoogleTasklistSummary[];
  tasks: GoogleTaskSummary[];
  calendars: GoogleCalendarSummary[];
  events: GoogleCalendarEventSummary[];
  selectedTasklistId: string;
  selectedCalendarId: string;
  visibleMonth: string;
  windowStart: string;
  windowEnd: string;
  capabilities: {
    tasksEnabled: boolean;
    calendarsEnabled: boolean;
    calendarListsEnabled: boolean;
  };
};

const TYPE_META: Record<
  AgendaType,
  { label: string; helper: string; target: "Google Tasks" | "Google Calendar" }
> = {
  recordatorio: {
    label: "Seguimiento",
    helper: "Seguimiento comercial o recordatorio operativo.",
    target: "Google Tasks",
  },
  pago: {
    label: "Evento",
    helper: "Cita, reunión o compromiso visible en calendario.",
    target: "Google Calendar",
  },
  pendiente: {
    label: "Tarea",
    helper: "Pendiente operativo, trámite o ejecución interna.",
    target: "Google Tasks",
  },
};

const STATUS_LABELS: Record<AgendaStatus, string> = {
  abierto: "Abierto",
  hecho: "Hecho",
  cancelado: "Cancelado",
};

const AGENDA_PAGE_SIZE = 12;
const DAYS_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMonthLabel(value: string) {
  const base = /^\d{4}-\d{2}$/.test(value) ? `${value}-01T00:00:00` : value;
  return new Date(base).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(value: string, delta: number) {
  const [yearRaw, monthRaw] = value.split("-").map((item) => Number(item));
  const base = new Date(Date.UTC(yearRaw, (monthRaw || 1) - 1 + delta, 1));
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`;
}

function resolveDateKey(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function buildMonthGrid(visibleMonth: string) {
  const [yearRaw, monthRaw] = visibleMonth.split("-").map((item) => Number(item));
  const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
  const month = Number.isFinite(monthRaw) ? monthRaw - 1 : new Date().getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const cell = new Date(start);
    cell.setDate(start.getDate() + index);
    return {
      key: resolveDateKey(cell.toISOString())!,
      dayOfMonth: cell.getDate(),
      inMonth: cell.getMonth() === month,
      isToday: resolveDateKey(cell.toISOString()) === resolveDateKey(new Date().toISOString()),
    };
  });
}

function getInitialVisibleMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AgendaPanel({
  collapsible = false,
  defaultOpen = true,
  integrationNextPath = "/unidep/agenda",
}: {
  collapsible?: boolean;
  defaultOpen?: boolean;
  integrationNextPath?: string;
}) {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [integration, setIntegration] = useState<AgendaIntegrationState | null>(null);
  const [googlePreview, setGooglePreview] = useState<GooglePreviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [integrationLoading, setIntegrationLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "danger"; message: string } | null>(
    null,
  );
  const [typeFilter, setTypeFilter] = useState<AgendaType | "">("");
  const [statusFilter, setStatusFilter] = useState<AgendaStatus | "">("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(defaultOpen);
  const [visibleMonth, setVisibleMonth] = useState(getInitialVisibleMonth());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    type: "pendiente" as AgendaType,
    title: "",
    notes: "",
    dueAt: "",
  });
  const [editDraft, setEditDraft] = useState({
    type: "pendiente" as AgendaType,
    status: "abierto" as AgendaStatus,
    title: "",
    notes: "",
    dueAt: "",
  });

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/data/agenda", { cache: "no-store" });
      const data = (await res.json()) as { items?: AgendaItem[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar la agenda.");
      }
      setItems(data.items ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la agenda.");
    } finally {
      setLoading(false);
    }
  }

  async function loadIntegration() {
    setIntegrationLoading(true);
    try {
      const res = await fetch("/api/data/agenda/integrations", { cache: "no-store" });
      const data = (await res.json()) as
        | ({ ok?: boolean; error?: string } & Partial<AgendaIntegrationState>)
        | null;

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo cargar la conexión Google.");
      }

        setIntegration({
          provider: String(data.provider ?? "google"),
          connectionStatus: String(data.connectionStatus ?? "pending"),
          googleReady: {
            ready: Boolean(data.googleReady?.ready),
            missing: Array.isArray(data.googleReady?.missing) ? data.googleReady.missing : [],
          },
          serviceStates: Array.isArray(data.serviceStates)
            ? data.serviceStates.map((service) => ({
                key: String(service.key ?? "identity") as GoogleServiceState["key"],
                label: String(service.label ?? service.key ?? "Google"),
                connected: Boolean(service.connected),
                missingScopes: Array.isArray(service.missingScopes)
                  ? service.missingScopes.map((scope) => String(scope))
                  : [],
              }))
            : [],
          identityOnlyLogin: Boolean(data.identityOnlyLogin),
          integrationSummary: String(data.integrationSummary ?? ""),
          connection: data.connection
            ? {
              connected: Boolean(data.connection.connected),
              calendarConnected: Boolean(data.connection.calendarConnected),
              tasksConnected: Boolean(data.connection.tasksConnected),
              sheetsConnected: Boolean(data.connection.sheetsConnected),
              contactsConnected: Boolean(
                (data.connection as Partial<GoogleConnectionState>).contactsConnected,
              ),
              scopes: Array.isArray(data.connection.scopes) ? data.connection.scopes : [],
              lastSyncError:
                typeof data.connection.lastSyncError === "string"
                  ? data.connection.lastSyncError
                  : null,
              updatedAt: String(data.connection.updatedAt ?? ""),
            }
          : null,
        preference: data.preference
          ? {
              syncCalendarEnabled: Boolean(data.preference.syncCalendarEnabled),
              syncTasksEnabled: Boolean(data.preference.syncTasksEnabled),
              syncSheetsEnabled: Boolean(data.preference.syncSheetsEnabled),
              calendarId:
                typeof data.preference.calendarId === "string"
                  ? data.preference.calendarId
                  : null,
              tasklistId:
                typeof data.preference.tasklistId === "string"
                  ? data.preference.tasklistId
                  : null,
              spreadsheetId:
                typeof data.preference.spreadsheetId === "string"
                  ? data.preference.spreadsheetId
                  : null,
              worksheetName:
                typeof data.preference.worksheetName === "string"
                  ? data.preference.worksheetName
                  : null,
              lastSyncedAt:
                typeof data.preference.lastSyncedAt === "string"
                  ? data.preference.lastSyncedAt
                  : null,
            }
          : null,
      });
    } catch (err: unknown) {
      setNotice({
        kind: "danger",
        message:
          err instanceof Error ? err.message : "No se pudo cargar la conexión Google.",
      });
    } finally {
      setIntegrationLoading(false);
    }
  }

  const loadGooglePreview = useCallback(async (options?: {
    calendarId?: string | null;
    tasklistId?: string | null;
    month?: string | null;
  }) => {
    setPreviewLoading(true);
    try {
      const params = new URLSearchParams();
      const calendarId =
        options?.calendarId ?? integration?.preference?.calendarId ?? googlePreview?.selectedCalendarId ?? null;
      const tasklistId =
        options?.tasklistId ?? integration?.preference?.tasklistId ?? googlePreview?.selectedTasklistId ?? null;
      const month = options?.month ?? visibleMonth;

      if (calendarId) params.set("calendarId", calendarId);
      if (tasklistId) params.set("tasklistId", tasklistId);
      if (month) params.set("month", month);

      const res = await fetch(`/api/data/agenda/google-preview?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as
        | ({ ok?: boolean; error?: string } & Partial<GooglePreviewState>)
        | null;

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo cargar la vista previa de Google.");
      }

      setGooglePreview({
        tasklists: Array.isArray(data.tasklists) ? data.tasklists : [],
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        calendars: Array.isArray(data.calendars) ? data.calendars : [],
        events: Array.isArray(data.events) ? data.events : [],
        selectedTasklistId: String(data.selectedTasklistId ?? ""),
        selectedCalendarId: String(data.selectedCalendarId ?? ""),
        visibleMonth: String(data.visibleMonth ?? visibleMonth),
        windowStart: String(data.windowStart ?? ""),
        windowEnd: String(data.windowEnd ?? ""),
        capabilities: {
          tasksEnabled: Boolean(data.capabilities?.tasksEnabled),
          calendarsEnabled: Boolean(data.capabilities?.calendarsEnabled),
          calendarListsEnabled: Boolean(data.capabilities?.calendarListsEnabled),
        },
      });
    } catch (previewError) {
      setNotice({
        kind: "danger",
        message:
          previewError instanceof Error
            ? previewError.message
            : "No se pudo cargar la vista previa de Google.",
      });
    } finally {
      setPreviewLoading(false);
    }
  }, [
    googlePreview?.selectedCalendarId,
    googlePreview?.selectedTasklistId,
    integration?.preference?.calendarId,
    integration?.preference?.tasklistId,
    visibleMonth,
  ]);

  const isGoogleConnected = Boolean(integration?.connection?.connected);
  const syncTargetsEnabled = Boolean(
    integration?.preference?.syncCalendarEnabled ||
      integration?.preference?.syncTasksEnabled ||
      integration?.preference?.syncSheetsEnabled,
  );

  async function syncAgenda(options?: { silent?: boolean }) {
    if (!integration?.googleReady?.ready) {
      throw new Error(
        `Configura primero Google: ${(integration?.googleReady?.missing ?? []).join(", ")}`,
      );
    }

    if (!isGoogleConnected) {
      window.location.href = `/api/integrations/google/connect?next=${encodeURIComponent(
        integrationNextPath,
      )}&service=agenda&intent=agenda_sync`;
      return;
    }

    if (!syncTargetsEnabled) {
      throw new Error("Activa al menos un destino: Calendar, Tasks o Sheets.");
    }

    setSyncing(true);
    try {
      const res = await fetch("/api/data/agenda/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo sincronizar la agenda.");
      }
      await Promise.all([
        loadIntegration(),
        loadGooglePreview({
          calendarId: googlePreview?.selectedCalendarId ?? null,
          tasklistId: googlePreview?.selectedTasklistId ?? null,
          month: visibleMonth,
        }),
      ]);
      if (!options?.silent) {
        setNotice({ kind: "success", message: "Agenda sincronizada con Google." });
      }
    } finally {
      setSyncing(false);
    }
  }

  async function syncAgendaAfterMutation() {
    if (!isGoogleConnected || !syncTargetsEnabled) return;
    try {
      await syncAgenda({ silent: true });
    } catch (err: unknown) {
      setNotice({
        kind: "danger",
        message:
          err instanceof Error ? err.message : "No se pudo sincronizar la agenda.",
      });
    }
  }

  async function updateIntegrationPreference(
    payload: Partial<NonNullable<AgendaIntegrationState["preference"]>>,
  ) {
    setIntegrationSaving(true);
    try {
      const res = await fetch("/api/data/agenda/integrations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo actualizar la sincronización.");
      }
      await Promise.all([
        loadIntegration(),
        loadGooglePreview({
          calendarId:
            typeof payload.calendarId === "string"
              ? payload.calendarId
              : googlePreview?.selectedCalendarId ?? null,
          tasklistId:
            typeof payload.tasklistId === "string"
              ? payload.tasklistId
              : googlePreview?.selectedTasklistId ?? null,
          month: visibleMonth,
        }),
      ]);
      setNotice({ kind: "success", message: "Preferencias Google actualizadas." });
      const enablesSync =
        payload.syncCalendarEnabled === true ||
        payload.syncTasksEnabled === true ||
        payload.syncSheetsEnabled === true;
      if (enablesSync) {
        await syncAgenda({ silent: true });
      }
    } finally {
      setIntegrationSaving(false);
    }
  }

  useEffect(() => {
    void loadItems();
    void loadIntegration();
  }, []);

  useEffect(() => {
    if (!integration?.connection?.connected) return;
    void loadGooglePreview({
      month: visibleMonth,
    });
  }, [integration?.connection?.connected, loadGooglePreview, visibleMonth]);

  async function createItem() {
    if (!draft.title.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/data/agenda", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          title: draft.title.trim(),
          notes: draft.notes.trim(),
          dueAt: draft.dueAt || null,
        }),
      });
      const data = (await res.json()) as { item?: AgendaItem; error?: string };
      if (!res.ok || !data.item) {
        throw new Error(data.error || "No se pudo crear el registro.");
      }
      setItems((current) => [data.item!, ...current]);
      setDraft({ type: "pendiente", title: "", notes: "", dueAt: "" });
      await syncAgendaAfterMutation();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo crear el registro.");
    } finally {
      setSaving(false);
    }
  }

  async function patchItem(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/data/agenda/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { item?: AgendaItem; error?: string };
    if (!res.ok || !data.item) {
      throw new Error(data.error || "No se pudo actualizar el registro.");
    }
    setItems((current) => current.map((item) => (item.id === id ? data.item! : item)));
    await syncAgendaAfterMutation();
  }

  function startEditingItem(item: AgendaItem) {
    setEditingId(item.id);
    setEditDraft({
      type: item.type,
      status: item.status,
      title: item.title,
      notes: item.notes ?? "",
      dueAt: toDateTimeLocal(item.dueAt),
    });
  }

  function resetEditing() {
    setEditingId(null);
    setEditDraft({
      type: "pendiente",
      status: "abierto",
      title: "",
      notes: "",
      dueAt: "",
    });
  }

  async function saveEditedItem() {
    if (!editingId || !editDraft.title.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await patchItem(editingId, {
        type: editDraft.type,
        status: editDraft.status,
        title: editDraft.title.trim(),
        notes: editDraft.notes.trim(),
        dueAt: editDraft.dueAt || null,
      });
      setNotice({ kind: "success", message: "Registro actualizado." });
      resetEditing();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el registro.");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/data/agenda/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo eliminar el registro.");
      }
      setItems((current) => current.filter((item) => item.id !== id));
      if (editingId === id) {
        resetEditing();
      }
      await loadGooglePreview({
        month: visibleMonth,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el registro.");
    }
  }

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (typeFilter && item.type !== typeFilter) return false;
        if (statusFilter && item.status !== statusFilter) return false;
        return true;
      }),
    [items, statusFilter, typeFilter],
  );

  useEffect(() => {
    setPage(0);
  }, [statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / AGENDA_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = useMemo(() => {
    const start = currentPage * AGENDA_PAGE_SIZE;
    return filteredItems.slice(start, start + AGENDA_PAGE_SIZE);
  }, [currentPage, filteredItems]);
  const pageStart = filteredItems.length === 0 ? 0 : currentPage * AGENDA_PAGE_SIZE + 1;
  const pageEnd = Math.min((currentPage + 1) * AGENDA_PAGE_SIZE, filteredItems.length);
  const editingItem = useMemo(
    () => items.find((item) => item.id === editingId) ?? null,
    [editingId, items],
  );

  const compactSummary = loading
    ? "Cargando agenda..."
    : filteredItems.length
      ? `${filteredItems.length} registro(s) visibles de ${items.length}.`
      : items.length
        ? "No hay registros para los filtros actuales."
        : "Sin registros guardados.";

  const eventsByDay = useMemo(() => {
    const bucket = new Map<string, GoogleCalendarEventSummary[]>();
    for (const event of googlePreview?.events ?? []) {
      const key = resolveDateKey(event.start);
      if (!key) continue;
      const current = bucket.get(key) ?? [];
      current.push(event);
      bucket.set(key, current);
    }
    return bucket;
  }, [googlePreview?.events]);

  const monthGrid = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const selectedDayEvents = selectedDayKey ? eventsByDay.get(selectedDayKey) ?? [] : [];

  useEffect(() => {
    if (!googlePreview?.events.length) {
      setSelectedDayKey(resolveDateKey(new Date().toISOString()));
      return;
    }

    const nextDay =
      googlePreview.events
        .map((event) => resolveDateKey(event.start))
        .find(Boolean) ?? resolveDateKey(new Date().toISOString());
    setSelectedDayKey((current) => current ?? nextDay);
  }, [googlePreview?.events]);

  return (
    <section className="ui-card ui-card-pad min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="ui-kicker">Seguimiento</div>
          <h2 className="mt-1 text-lg font-semibold">Agenda</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-slate-200">
          <span className="ui-pill">{items.length} registros</span>
          <span className="ui-pill">{filteredItems.length} visibles</span>
          {collapsible ? (
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10"
            >
              {open ? "Ocultar" : "Expandir"}
            </button>
          ) : null}
        </div>
      </div>

      {collapsible && !open ? (
        <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/25 px-4 py-4 text-sm text-slate-300">
          {compactSummary}
        </div>
      ) : null}

      {!collapsible || open ? (
        <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
            <section className="grid content-start gap-4 rounded-3xl border border-white/10 bg-slate-950/25 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="ui-kicker">Google</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">
                    Estado e integración
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void syncAgenda().catch((err: unknown) => {
                      setNotice({
                        kind: "danger",
                        message:
                          err instanceof Error
                            ? err.message
                            : "No se pudo sincronizar la agenda.",
                      });
                    })
                  }
                  disabled={syncing || integrationLoading}
                  className="ui-button-info"
                >
                  {isGoogleConnected
                    ? syncing
                      ? "Sincronizando..."
                      : "Sincronizar"
                    : "Conectar Google"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="ui-pill">
                  {integration?.connection?.tasksConnected ? "Tasks listo" : "Tasks pendiente"}
                </span>
                <span className="ui-pill">
                  {integration?.connection?.calendarConnected
                    ? "Calendar listo"
                    : "Calendar pendiente"}
                </span>
                <span className="ui-pill">
                  {integration?.connection?.contactsConnected
                    ? "Contacts listo"
                    : "Contacts pendiente"}
                </span>
                <span className="ui-pill">
                  {integration?.connection?.sheetsConnected ? "Sheets listo" : "Sheets pendiente"}
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-200">
                <div className="font-semibold text-slate-100">
                  Login Google ≠ Integración operativa
                </div>
                {integration?.identityOnlyLogin ? (
                  <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-amber-100">
                    La cuenta actual solo tiene scopes de identidad. Reconecta para autorizar la
                    integración.
                  </div>
                ) : null}
              </div>

              {integration?.serviceStates?.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {integration.serviceStates.map((service) => (
                    <div
                      key={service.key}
                      className="rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2 text-sm text-slate-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{service.label}</span>
                        <span className="ui-pill">
                          {service.connected ? "Conectado" : "Pendiente"}
                        </span>
                      </div>
                      {!service.connected && service.missingScopes.length ? (
                        <div className="mt-1 text-[13px] text-slate-300">
                          Faltan scopes: {service.missingScopes.slice(0, 2).join(", ")}
                          {service.missingScopes.length > 2 ? "…" : ""}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-3 text-sm text-slate-100">
                  <input
                    type="checkbox"
                    checked={Boolean(integration?.preference?.syncTasksEnabled)}
                    disabled={integrationSaving || integrationLoading}
                    onChange={(event) =>
                      void updateIntegrationPreference({
                        syncTasksEnabled: event.target.checked,
                      }).catch((err: unknown) => {
                        setNotice({
                          kind: "danger",
                          message:
                            err instanceof Error
                              ? err.message
                              : "No se pudo actualizar Tasks.",
                        });
                      })
                    }
                  />
                  <span>Sincronizar Tasks</span>
                </label>
                <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-3 text-sm text-slate-100">
                  <input
                    type="checkbox"
                    checked={Boolean(integration?.preference?.syncCalendarEnabled)}
                    disabled={integrationSaving || integrationLoading}
                    onChange={(event) =>
                      void updateIntegrationPreference({
                        syncCalendarEnabled: event.target.checked,
                      }).catch((err: unknown) => {
                        setNotice({
                          kind: "danger",
                          message:
                            err instanceof Error
                              ? err.message
                              : "No se pudo actualizar Calendar.",
                        });
                      })
                    }
                  />
                  <span>Sincronizar Calendar</span>
                </label>
                <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-3 text-sm text-slate-100">
                  <input
                    type="checkbox"
                    checked={Boolean(integration?.preference?.syncSheetsEnabled)}
                    disabled={integrationSaving || integrationLoading}
                    onChange={(event) =>
                      void updateIntegrationPreference({
                        syncSheetsEnabled: event.target.checked,
                      }).catch((err: unknown) => {
                        setNotice({
                          kind: "danger",
                          message:
                            err instanceof Error
                              ? err.message
                              : "No se pudo actualizar Sheets.",
                        });
                      })
                    }
                  />
                  <span>Sincronizar Sheets</span>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  Tasklist de Google
                  <select
                    value={googlePreview?.selectedTasklistId ?? ""}
                    onChange={(event) =>
                      void updateIntegrationPreference({
                        tasklistId: event.target.value || null,
                      }).catch((err: unknown) => {
                        setNotice({
                          kind: "danger",
                          message:
                            err instanceof Error
                              ? err.message
                              : "No se pudo cambiar la tasklist.",
                        });
                      })
                    }
                    className="ui-control"
                    disabled={previewLoading || !googlePreview?.tasklists.length}
                  >
                    <option value="">Seleccionar</option>
                    {googlePreview?.tasklists.map((tasklist) => (
                      <option key={tasklist.id} value={tasklist.id}>
                        {tasklist.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  Calendario de Google
                  <select
                    value={googlePreview?.selectedCalendarId ?? ""}
                    onChange={(event) =>
                      void updateIntegrationPreference({
                        calendarId: event.target.value || null,
                      }).catch((err: unknown) => {
                        setNotice({
                          kind: "danger",
                          message:
                            err instanceof Error
                              ? err.message
                              : "No se pudo cambiar el calendario.",
                        });
                      })
                    }
                    className="ui-control"
                    disabled={previewLoading || !googlePreview?.calendars.length}
                  >
                    <option value="">Seleccionar</option>
                    {googlePreview?.calendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.summary}
                        {calendar.primary ? " · principal" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {integration?.preference?.lastSyncedAt ? (
                <div className="text-sm text-slate-300">
                  Última sync: {formatDate(integration.preference.lastSyncedAt)}
                </div>
              ) : null}
              {integration?.connection?.lastSyncError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {integration.connection.lastSyncError}
                </div>
              ) : null}
            </section>

            <section className="grid content-start gap-4 rounded-3xl border border-white/10 bg-slate-950/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="ui-kicker">Editor</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">
                    {editingItem ? "Editar registro" : "Nuevo registro"}
                  </div>
                </div>
                {editingItem ? (
                  <button type="button" onClick={resetEditing} className="ui-button-secondary">
                    Nuevo
                  </button>
                ) : null}
              </div>

              {editingItem ? (
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/6 px-4 py-3 text-sm text-slate-100">
                  <div className="font-semibold">{editingItem.title}</div>
                  <div className="mt-1 text-sm text-slate-200">
                    Última actualización: {formatDate(editingItem.updatedAt)}
                  </div>
                </div>
              ) : null}

              <label className="grid gap-2 text-sm">
                Tipo operativo
                <select
                  value={editingItem ? editDraft.type : draft.type}
                  onChange={(event) => {
                    const nextType = event.target.value as AgendaType;
                    if (editingItem) {
                      setEditDraft((current) => ({ ...current, type: nextType }));
                    } else {
                      setDraft((current) => ({ ...current, type: nextType }));
                    }
                  }}
                  className="ui-control"
                >
                  {Object.entries(TYPE_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label} · {meta.target}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-200">
                {TYPE_META[editingItem ? editDraft.type : draft.type].helper}
              </div>

              {editingItem ? (
                <label className="grid gap-2 text-sm">
                  Estado
                  <select
                    value={editDraft.status}
                    onChange={(event) =>
                      setEditDraft((current) => ({
                        ...current,
                        status: event.target.value as AgendaStatus,
                      }))
                    }
                    className="ui-control"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="grid gap-2 text-sm">
                Título
                <input
                  value={editingItem ? editDraft.title : draft.title}
                  onChange={(event) =>
                    editingItem
                      ? setEditDraft((current) => ({ ...current, title: event.target.value }))
                      : setDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  className="ui-control"
                  placeholder="Ej. Seguimiento con Ana Gómez"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Fecha objetivo
                <input
                  type="datetime-local"
                  value={editingItem ? editDraft.dueAt : draft.dueAt}
                  onChange={(event) =>
                    editingItem
                      ? setEditDraft((current) => ({ ...current, dueAt: event.target.value }))
                      : setDraft((current) => ({ ...current, dueAt: event.target.value }))
                  }
                  className="ui-control"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Notas
                <textarea
                  value={editingItem ? editDraft.notes : draft.notes}
                  onChange={(event) =>
                    editingItem
                      ? setEditDraft((current) => ({ ...current, notes: event.target.value }))
                      : setDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                  className="ui-control min-h-[112px]"
                  placeholder="Responsable, contexto o siguiente paso."
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || !(editingItem ? editDraft.title.trim() : draft.title.trim())}
                  onClick={() => void (editingItem ? saveEditedItem() : createItem())}
                  className={editingItem ? "ui-button-info" : "ui-button-primary"}
                >
                  {saving ? "Guardando..." : editingItem ? "Guardar cambios" : "Guardar registro"}
                </button>
                {editingItem ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        void patchItem(editingItem.id, {
                          status: editingItem.status === "hecho" ? "abierto" : "hecho",
                        }).catch((err: unknown) => {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "No se pudo actualizar el registro.",
                          );
                        })
                      }
                      className="ui-button-secondary"
                    >
                      {editingItem.status === "hecho" ? "Reabrir" : "Marcar hecho"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeItem(editingItem.id)}
                      className="ui-button-danger"
                    >
                      Eliminar
                    </button>
                  </>
                ) : null}
              </div>
            </section>
          </div>

          <div className="grid content-start gap-4">
            <section className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="ui-kicker">Google Tasks</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">
                    Tareas activas del usuario
                  </div>
                </div>
                <span className="ui-pill">{googlePreview?.tasks.length ?? 0} tareas</span>
              </div>
              <div className="grid gap-2">
                {previewLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-300">
                    Cargando tareas de Google...
                  </div>
                ) : googlePreview?.tasks.length ? (
                  googlePreview.tasks.slice(0, 8).map((task) => (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-slate-100">{task.title}</div>
                        <span className="ui-pill">
                          {task.status === "completed" ? "Hecha" : "Pendiente"}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {task.tasklistTitle} · {formatDate(task.due)}
                      </div>
                      {task.notes ? (
                        <div className="mt-2 text-sm text-slate-200">{task.notes}</div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-300">
                    Sin tareas visibles en la tasklist seleccionada.
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="ui-kicker">Google Calendar</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">
                    Mini calendario operativo
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}
                    className="ui-button-secondary px-3"
                  >
                    ←
                  </button>
                  <span className="ui-pill">{formatMonthLabel(visibleMonth)}</span>
                  <button
                    type="button"
                    onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}
                    className="ui-button-secondary px-3"
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-[13px] uppercase tracking-[0.14em] text-slate-300">
                {DAYS_SHORT.map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {monthGrid.map((cell) => {
                  const total = eventsByDay.get(cell.key)?.length ?? 0;
                  const isSelected = selectedDayKey === cell.key;
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => setSelectedDayKey(cell.key)}
                      className={[
                        "min-h-[74px] rounded-2xl border px-2 py-2 text-left transition",
                        cell.inMonth
                          ? "border-white/10 bg-slate-950/45 text-slate-100"
                          : "border-white/6 bg-slate-950/25 text-slate-400",
                        total ? "ring-1 ring-emerald-500/20" : "",
                        isSelected ? "border-emerald-400/35 bg-emerald-500/10" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cell.isToday ? "font-semibold text-emerald-200" : ""}>
                          {cell.dayOfMonth}
                        </span>
                        {total ? <span className="ui-pill">{total}</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="text-sm font-semibold text-slate-100">
                  {selectedDayKey
                    ? `Eventos del ${formatDate(`${selectedDayKey}T09:00:00`)}`.split(",")[0]
                    : "Eventos del día"}
                </div>
                <div className="mt-3 grid gap-2">
                  {selectedDayEvents.length ? (
                    selectedDayEvents.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3"
                      >
                        <div className="font-semibold text-slate-100">{event.summary}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {formatDate(event.start)} · {event.calendarSummary}
                        </div>
                        {event.description ? (
                          <div className="mt-2 text-sm text-slate-300">
                            {event.description}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-300">
                      No hay eventos para el día seleccionado.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="grid content-start gap-4 rounded-3xl border border-white/10 bg-slate-950/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="ui-kicker">Vista local</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">
                    Registros operativos
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    Mostrando {pageStart}-{pageEnd} de {filteredItems.length} registro(s).
                  </div>
                </div>
                {(typeFilter || statusFilter) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter("");
                      setStatusFilter("");
                    }}
                    className="ui-button-secondary"
                  >
                    Limpiar filtros
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  Tipo
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as AgendaType | "")}
                    className="ui-control"
                  >
                    <option value="">Todos</option>
                    {Object.entries(TYPE_META).map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  Estado
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as AgendaStatus | "")}
                    className="ui-control"
                  >
                    <option value="">Todos</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {notice ? (
                <div
                  className={[
                    "rounded-2xl px-4 py-3 text-sm",
                    notice.kind === "danger"
                      ? "border border-red-500/30 bg-red-500/10 text-red-100"
                      : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
                  ].join(" ")}
                >
                  {notice.message}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-slate-300">
                  Cargando agenda...
                </div>
              ) : filteredItems.length ? (
                <>
                  <div className="ui-table-wrap ui-scrollbar">
                    <table className="ui-table ui-table--compact min-w-[860px]">
                      <thead>
                        <tr>
                          <th className="ui-cell-nowrap text-left">Tipo</th>
                          <th className="ui-cell-nowrap text-left">Destino</th>
                          <th className="ui-cell-nowrap text-left">Estado</th>
                          <th className="text-left">Título</th>
                          <th className="ui-cell-nowrap text-left">Fecha objetivo</th>
                          <th className="text-left">Notas</th>
                          <th className="ui-cell-nowrap text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((item) => {
                          const isEditing = item.id === editingId;
                          return (
                            <tr key={item.id} className={isEditing ? "bg-cyan-500/8" : undefined}>
                              <td className="ui-cell-nowrap text-slate-100">
                                {TYPE_META[item.type].label}
                              </td>
                              <td className="ui-cell-nowrap text-slate-300">
                                {TYPE_META[item.type].target}
                              </td>
                              <td className="ui-cell-nowrap text-slate-300">
                                {STATUS_LABELS[item.status]}
                              </td>
                              <td className="text-slate-100">
                                <div className="font-semibold">{item.title}</div>
                                <div className="mt-1 text-sm text-slate-300">
                                  Actualizado: {formatDate(item.updatedAt)}
                                </div>
                              </td>
                              <td className="ui-cell-nowrap text-slate-300">
                                {formatDate(item.dueAt)}
                              </td>
                              <td className="max-w-[320px] text-slate-300">
                                <div className="ui-cell-truncate">{item.notes?.trim() || "Sin notas"}</div>
                              </td>
                              <td className="ui-cell-nowrap text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEditingItem(item)}
                                    className={[
                                      "ui-button-secondary min-h-[34px] px-3 text-xs",
                                      isEditing
                                        ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-100"
                                        : "",
                                    ].join(" ")}
                                  >
                                    {isEditing ? "Editando" : "Editar"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void patchItem(item.id, {
                                        status: item.status === "hecho" ? "abierto" : "hecho",
                                      }).catch((err: unknown) => {
                                        setError(
                                          err instanceof Error
                                            ? err.message
                                            : "No se pudo actualizar el registro.",
                                        );
                                      })
                                    }
                                    className="ui-button-info min-h-[34px] px-3 text-xs"
                                  >
                                    {item.status === "hecho" ? "Reabrir" : "Hecho"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <button
                        type="button"
                        disabled={currentPage === 0}
                        onClick={() => setPage((value) => Math.max(0, value - 1))}
                        className="ui-button-secondary disabled:opacity-40"
                      >
                        ← Anterior
                      </button>
                      <span className="text-slate-200">
                        Página {currentPage + 1} de {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
                        className="ui-button-secondary disabled:opacity-40"
                      >
                        Siguiente →
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">
                  No hay registros para los filtros actuales.
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}
