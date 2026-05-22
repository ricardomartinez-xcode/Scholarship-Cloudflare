"use client";

import Image from "next/image";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import SmartSelect from "@/components/SmartSelect";
import {
  readWebCampaignSelection,
  writeWebCampaignSelection,
  type WebCampaignSelectableContact,
} from "@/lib/web-campaign-selection";

type ContactCampaignMembership = {
  campaignId: string;
  campaignName: string;
  status: string;
  scheduleAt: string | null;
  recipientStatus: string;
};

type ContactRecord = WebCampaignSelectableContact & {
  tags: string[];
  personalData: string | null;
  notes: string | null;
  lastWhatsappMessageAt: string | null;
  lastWhatsappMessageText: string | null;
  campaignMessageCount: number;
  hasWhatsappHistory: boolean;
  campaignMemberships: ContactCampaignMembership[];
  activeCampaignCount: number;
  assignedQuoteSessionPublicId: string | null;
  assignedScenarioId: string | null;
  source: string;
  sheetSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type QuoteAssignment = {
  publicId: string;
  updatedAt: string;
  scenarios: Array<{
    id: string;
    label: string;
    updatedAt: string;
  }>;
};

type GoogleStatus = {
  mode: "hybrid";
  contactsSheetName: string;
  googleReady: { ready: boolean; missing: string[] };
  connectionStatus: string;
  connection: {
    connected: boolean;
    calendarConnected: boolean;
    tasksConnected: boolean;
    sheetsConnected: boolean;
    contactsConnected?: boolean;
    scopes: string[];
    lastSyncError: string | null;
    updatedAt: string;
  } | null;
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

type GooglePreviewContact = {
  resourceName: string;
  etag: string | null;
  displayName: string;
  primaryPhone: string | null;
  normalizedPhone: string | null;
  primaryEmail: string | null;
  organization: string | null;
  title: string | null;
  photoUrl: string | null;
  updatedAt: string | null;
};

type DraftState = {
  contactName: string;
  phone: string;
  email: string;
  tags: string;
  personalData: string;
  notes: string;
  assignedQuoteSessionPublicId: string;
  assignedScenarioId: string;
};

type ContactSortKey =
  | "contactName"
  | "tags"
  | "lastWhatsappMessageAt"
  | "campaignMessageCount"
  | "activeCampaignCount";
type SortDirection = "asc" | "desc";

const SORT_KEY_LABELS: Record<ContactSortKey, string> = {
  contactName: "contacto",
  tags: "etiquetas",
  lastWhatsappMessageAt: "ultimo whatsapp",
  campaignMessageCount: "mensajes",
  activeCampaignCount: "campanas activas",
};

const EMPTY_DRAFT: DraftState = {
  contactName: "",
  phone: "",
  email: "",
  tags: "",
  personalData: "",
  notes: "",
  assignedQuoteSessionPublicId: "",
  assignedScenarioId: "",
};

const CONTACTS_PAGE_SIZE = 20;

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildTagsInput(tags: string[]) {
  return tags.join(", ");
}

function normalizeVisibleErrorMessage(message: string) {
  const normalized = String(message ?? "").trim();
  if (!normalized) return "No fue posible completar la operacion.";

  const lowered = normalized.toLowerCase();
  if (
    lowered.includes("<!doctype html") ||
    lowered.includes("requested url /sheets/v4/spreadsheets") ||
    lowered.includes("google sheets")
  ) {
    return "No fue posible crear o actualizar la hoja de contactos en Google Sheets.";
  }

  if (lowered.includes("contacts.readonly")) {
    return "La conexion Google no tiene permisos suficientes para leer Google Contacts.";
  }

  return normalized;
}

function campaignTone(status: string) {
  switch (status) {
    case "completed":
    case "sent":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "partial":
      return "border-cyan-200 bg-cyan-50 text-cyan-800";
    case "failed":
    case "blocked":
      return "border-red-200 bg-red-50 text-red-800";
    case "running":
    case "processing":
    case "claimed":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "scheduled":
    case "waiting_runner":
    case "paused":
    case "queued":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "draft":
      return "border-indigo-200 bg-indigo-50 text-indigo-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function sourceLabel(source: string) {
  switch (source) {
    case "google_contacts":
      return "Google Contacts";
    case "csv_import":
      return "CSV";
    case "manual_import":
      return "Importacion manual";
    case "manual":
      return "Manual";
    case "campaign_sync":
      return "Campana";
    default:
      return source || "Sin origen";
  }
}

export default function ContactsPanel() {
  const router = useRouter();
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [quoteAssignments, setQuoteAssignments] = useState<QuoteAssignment[]>([]);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [googleContacts, setGoogleContacts] = useState<GooglePreviewContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [googleContactsLoading, setGoogleContactsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<ContactSortKey>("lastWhatsappMessageAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [importText, setImportText] = useState("");
  const [importCsvText, setImportCsvText] = useState("");
  const [importCsvName, setImportCsvName] = useState("");
  const [googleContactsQuery, setGoogleContactsQuery] = useState("");
  const [selectedGoogleContacts, setSelectedGoogleContacts] = useState<string[]>([]);
  const [selectedWebPhones, setSelectedWebPhones] = useState<string[]>([]);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);

  const googleConnected = Boolean(google?.connection?.connected);
  const googleContactsReady = Boolean(google?.connection?.contactsConnected);
  const googleSheetsReady = Boolean(google?.connection?.sheetsConnected);
  const googleConfigReady = Boolean(google?.googleReady.ready);

  function connectGoogle() {
    if (!googleConfigReady) {
      setError(
        `Faltan variables para Google: ${(google?.googleReady.missing ?? []).join(", ")}`,
      );
      return;
    }

    window.location.href = `/api/integrations/google/connect?next=${encodeURIComponent(
      "/unidep/contactos",
    )}&service=contacts&intent=contacts_sync`;
  }

  async function loadContacts({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/data/contacts", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        contacts?: ContactRecord[];
        quoteAssignments?: QuoteAssignment[];
        google?: GoogleStatus;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible cargar contactos.");
      }

      const nextContacts = data.contacts ?? [];
      const storedSelection = readWebCampaignSelection();
      const allowedPhones = new Set(nextContacts.map((contact) => contact.normalizedPhone));

      setContacts(nextContacts);
      setQuoteAssignments(data.quoteAssignments ?? []);
      setGoogle(data.google ?? null);
      setCreatingNew(false);
      setSelectedContactId((current) => {
        if (current && nextContacts.some((contact) => contact.id === current)) {
          return current;
        }
        return nextContacts[0]?.id ?? null;
      });
      setSelectedWebPhones((current) => {
        const filteredCurrent = current.filter((phone) => allowedPhones.has(phone));
        if (filteredCurrent.length) return filteredCurrent;
        return storedSelection
          .map((contact) => contact.normalizedPhone)
          .filter((phone) => allowedPhones.has(phone));
      });
      setError(null);
    } catch (loadError) {
      setError(
        normalizeVisibleErrorMessage(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar contactos.",
        ),
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadContacts();
  }, []);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? null,
    [contacts, selectedContactId],
  );

  useEffect(() => {
    if (!selectedContact) {
      setDraft(EMPTY_DRAFT);
      return;
    }

    setDraft({
      contactName: selectedContact.contactName,
      phone: selectedContact.phone,
      email: selectedContact.email ?? "",
      tags: buildTagsInput(selectedContact.tags),
      personalData: selectedContact.personalData ?? "",
      notes: selectedContact.notes ?? "",
      assignedQuoteSessionPublicId: selectedContact.assignedQuoteSessionPublicId ?? "",
      assignedScenarioId: selectedContact.assignedScenarioId ?? "",
    });
  }, [selectedContact]);

  const filteredContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return contacts;
    return contacts.filter((contact) =>
      [
        contact.contactName,
        contact.phone,
        contact.email,
        contact.tags.join(" "),
        contact.personalData,
        contact.notes,
        contact.source,
        contact.campaignMemberships.map((membership) => membership.campaignName).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [contacts, query]);

  const visibleContacts = useMemo(() => {
    const collator = new Intl.Collator("es-MX", { sensitivity: "base", numeric: true });
    const sorted = [...filteredContacts];
    const directionFactor = sortDirection === "asc" ? 1 : -1;

    const compareDates = (left: string | null, right: string | null) => {
      const leftTime = left ? new Date(left).getTime() : null;
      const rightTime = right ? new Date(right).getTime() : null;
      if (leftTime === rightTime) return 0;
      if (leftTime === null) return 1;
      if (rightTime === null) return -1;
      return leftTime - rightTime;
    };

    sorted.sort((left, right) => {
      let base = 0;
      switch (sortKey) {
        case "contactName":
          base = collator.compare(left.contactName, right.contactName);
          break;
        case "tags":
          base = collator.compare(left.tags.join(", "), right.tags.join(", "));
          break;
        case "campaignMessageCount":
          base = left.campaignMessageCount - right.campaignMessageCount;
          break;
        case "activeCampaignCount":
          base = left.activeCampaignCount - right.activeCampaignCount;
          break;
        case "lastWhatsappMessageAt":
          base = compareDates(left.lastWhatsappMessageAt, right.lastWhatsappMessageAt);
          break;
      }

      if (base !== 0) return base * directionFactor;
      return collator.compare(left.contactName, right.contactName);
    });

    return sorted;
  }, [filteredContacts, sortDirection, sortKey]);

  useEffect(() => {
    setPage(0);
  }, [query, sortDirection, sortKey]);

  useEffect(() => {
    if (!visibleContacts.length) {
      setPage(0);
      if (selectedContactId && !creatingNew) {
        setSelectedContactId(null);
      }
      return;
    }

    if (creatingNew) return;

    if (!selectedContactId || !visibleContacts.some((contact) => contact.id === selectedContactId)) {
      setSelectedContactId(visibleContacts[0]?.id ?? null);
    }
  }, [creatingNew, selectedContactId, visibleContacts]);

  const totalPages = Math.max(1, Math.ceil(visibleContacts.length / CONTACTS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedContacts = useMemo(() => {
    const start = currentPage * CONTACTS_PAGE_SIZE;
    return visibleContacts.slice(start, start + CONTACTS_PAGE_SIZE);
  }, [currentPage, visibleContacts]);
  const pageStart = visibleContacts.length === 0 ? 0 : currentPage * CONTACTS_PAGE_SIZE + 1;
  const pageEnd = Math.min((currentPage + 1) * CONTACTS_PAGE_SIZE, visibleContacts.length);

  const selectedAssignment = useMemo(
    () =>
      quoteAssignments.find(
        (assignment) => assignment.publicId === draft.assignedQuoteSessionPublicId,
      ) ?? null,
    [draft.assignedQuoteSessionPublicId, quoteAssignments],
  );

  const selectedWebContacts = useMemo(
    () => contacts.filter((contact) => selectedWebPhones.includes(contact.normalizedPhone)),
    [contacts, selectedWebPhones],
  );

  useEffect(() => {
    writeWebCampaignSelection(selectedWebContacts);
  }, [selectedWebContacts]);

  const contactsWithHistory = useMemo(
    () => contacts.filter((contact) => contact.hasWhatsappHistory).length,
    [contacts],
  );
  const contactsInActiveCampaigns = useMemo(
    () => contacts.filter((contact) => contact.activeCampaignCount > 0).length,
    [contacts],
  );
  const totalMessages = useMemo(
    () => contacts.reduce((accumulator, contact) => accumulator + contact.campaignMessageCount, 0),
    [contacts],
  );

  function toggleSort(nextKey: ContactSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(
      nextKey === "contactName" || nextKey === "tags" ? "asc" : "desc",
    );
  }

  function getSortLabel(column: ContactSortKey) {
    if (sortKey !== column) return "Ordenar";
    return sortDirection === "asc" ? "Asc" : "Desc";
  }

  function toggleWebSelection(contact: ContactRecord) {
    setSelectedWebPhones((current) =>
      current.includes(contact.normalizedPhone)
        ? current.filter((phone) => phone !== contact.normalizedPhone)
        : [...current, contact.normalizedPhone],
    );
  }

  function selectVisibleContactsForWeb() {
    setSelectedWebPhones((current) =>
      Array.from(
        new Set([...current, ...visibleContacts.map((contact) => contact.normalizedPhone)]),
      ),
    );
  }

  function clearWebSelection() {
    setSelectedWebPhones([]);
  }

  function openWebCampaigns() {
    writeWebCampaignSelection(selectedWebContacts);
    router.push("/unidep/web");
  }

  async function saveContact() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        contactName: draft.contactName,
        phone: draft.phone,
        email: draft.email || null,
        tags: draft.tags,
        personalData: draft.personalData || null,
        notes: draft.notes || null,
        assignedQuoteSessionPublicId: draft.assignedQuoteSessionPublicId || null,
        assignedScenarioId: draft.assignedScenarioId || null,
      };

      const isEditing = Boolean(selectedContact);
      const response = await fetch(
        isEditing ? `/api/data/contacts/${selectedContact!.id}` : "/api/data/contacts",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(isEditing ? payload : { contact: payload }),
        },
      );

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible guardar el contacto.");
      }

      setMessage(isEditing ? "Contacto actualizado." : "Contacto guardado.");
      await loadContacts({ silent: true });
    } catch (saveError) {
      setError(
        normalizeVisibleErrorMessage(
          saveError instanceof Error
            ? saveError.message
            : "No fue posible guardar el contacto.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function importContacts() {
    if (!importText.trim() && !importCsvText.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/data/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          importCsvText.trim()
            ? { contactsCsvText: importCsvText }
            : { contactsText: importText },
        ),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        importedCount?: number;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible importar contactos.");
      }

      setImportText("");
      setImportCsvText("");
      setImportCsvName("");
      setMessage(`Importacion completa: ${data.importedCount ?? 0} contacto(s).`);
      await loadContacts({ silent: true });
    } catch (importError) {
      setError(
        normalizeVisibleErrorMessage(
          importError instanceof Error
            ? importError.message
            : "No fue posible importar contactos.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCsvImportSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setImportCsvText(text);
      setImportCsvName(file.name);
      setMessage(`CSV listo para importar: ${file.name}`);
      setError(null);
    } catch {
      setImportCsvText("");
      setImportCsvName("");
      setError("No fue posible leer el archivo CSV seleccionado.");
    } finally {
      event.target.value = "";
    }
  }

  async function deleteCurrentContact() {
    if (!selectedContact) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/data/contacts/${selectedContact.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible eliminar el contacto.");
      }
      setSelectedContactId(null);
      setDraft(EMPTY_DRAFT);
      setMessage("Contacto eliminado.");
      await loadContacts({ silent: true });
    } catch (deleteError) {
      setError(
        normalizeVisibleErrorMessage(
          deleteError instanceof Error
            ? deleteError.message
            : "No fue posible eliminar el contacto.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function activateSheetsSync() {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      if (!googleConnected) {
        connectGoogle();
        return;
      }

      if (!google?.preference?.syncSheetsEnabled) {
        const response = await fetch("/api/data/agenda/integrations", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ syncSheetsEnabled: true }),
        });
        const data = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "No fue posible activar Google Sheets.");
        }
      }

      const syncResponse = await fetch("/api/data/contacts/sync", {
        method: "POST",
      });
      const syncData = (await syncResponse.json()) as { ok?: boolean; error?: string };
      if (!syncResponse.ok || !syncData.ok) {
        throw new Error(syncData.error || "No fue posible sincronizar contactos.");
      }

      setMessage("Sincronizacion hibrida activa con Google Sheets.");
      await loadContacts({ silent: true });
    } catch (syncError) {
      setError(
        normalizeVisibleErrorMessage(
          syncError instanceof Error
            ? syncError.message
            : "No fue posible activar Google Sheets.",
        ),
      );
    } finally {
      setSyncing(false);
    }
  }

  async function loadGoogleContacts() {
    if (!googleConnected) {
      connectGoogle();
      return;
    }

    setGoogleContactsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/data/contacts/google?q=${encodeURIComponent(googleContactsQuery.trim())}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        contacts?: GooglePreviewContact[];
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible cargar Google Contacts.");
      }

      setGoogleContacts(data.contacts ?? []);
      setSelectedGoogleContacts([]);
      setMessage(
        `Google Contacts cargado: ${(data.contacts ?? []).length} contacto(s) visibles.`,
      );
    } catch (loadError) {
      setError(
        normalizeVisibleErrorMessage(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar Google Contacts.",
        ),
      );
    } finally {
      setGoogleContactsLoading(false);
    }
  }

  function toggleGoogleSelection(resourceName: string) {
    setSelectedGoogleContacts((current) =>
      current.includes(resourceName)
        ? current.filter((value) => value !== resourceName)
        : [...current, resourceName],
    );
  }

  async function importSelectedGoogleContacts() {
    if (!selectedGoogleContacts.length) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const selectedRows = googleContacts.filter((contact) =>
        selectedGoogleContacts.includes(contact.resourceName),
      );

      const response = await fetch("/api/data/contacts/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contacts: selectedRows }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        importedCount?: number;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible importar los contactos Google.");
      }

      const importedPhones = selectedRows
        .map((contact) => contact.normalizedPhone)
        .filter((phone): phone is string => Boolean(phone));

      setSelectedWebPhones((current) => Array.from(new Set([...current, ...importedPhones])));
      setSelectedGoogleContacts([]);
      setMessage(
        `Google Contacts importado: ${data.importedCount ?? 0} contacto(s).`,
      );
      await loadContacts({ silent: true });
    } catch (importError) {
      setError(
        normalizeVisibleErrorMessage(
          importError instanceof Error
            ? importError.message
            : "No fue posible importar los contactos Google.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function disconnectGoogle() {
    setSyncing(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/data/agenda/integrations", {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible desconectar Google.");
      }

      setGoogleContacts([]);
      setSelectedGoogleContacts([]);
      setMessage(
        "Conexion Google eliminada. Vuelve a conectar la cuenta para autorizar desde cero.",
      );
      await loadContacts({ silent: true });
    } catch (disconnectError) {
      setError(
        normalizeVisibleErrorMessage(
          disconnectError instanceof Error
            ? disconnectError.message
            : "No fue posible desconectar Google.",
        ),
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="ui-card ui-card-pad min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="ui-kicker">Prospectos</div>
          <h2 className="mt-1 text-lg font-semibold">Directorio</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[color:var(--ui-text-secondary)]">
          <span className="ui-pill">{contacts.length} contactos</span>
          <span className="ui-pill">{contactsWithHistory} con historial WhatsApp</span>
          <span className="ui-pill">{contactsInActiveCampaigns} en campanas activas</span>
          <span className="ui-pill">{selectedWebContacts.length} listos para Web</span>
          <span className="ui-pill">{totalMessages} mensajes</span>
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <section className="grid content-start gap-4 rounded-3xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-2)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="ui-kicker">Google</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--ui-text-primary)]">
                Sincronización
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={connectGoogle}
                disabled={!googleConfigReady}
                className="ui-cta-secondary"
              >
                {googleConnected ? "Reconectar Google" : "Conectar Google"}
              </button>
              <button
                type="button"
                onClick={() => void activateSheetsSync()}
                disabled={syncing || !googleConfigReady}
                className="ui-cta-secondary"
              >
                {syncing ? "Procesando..." : googleSheetsReady ? "Sincronizar Sheets" : "Activar Sheets"}
              </button>
              <button
                type="button"
                onClick={() => void loadGoogleContacts()}
                disabled={googleContactsLoading || !googleConfigReady}
                className="ui-cta-secondary"
              >
                {googleContactsLoading ? "Cargando..." : "Cargar Google Contacts"}
              </button>
              {googleConnected ? (
                <button
                  type="button"
                  onClick={() => void disconnectGoogle()}
                  disabled={syncing}
                  className="ui-cta-secondary"
                >
                  {syncing ? "Procesando..." : "Desconectar Google"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] px-3 py-2.5 text-sm text-[color:var(--ui-text-primary)]">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ui-text-secondary)]">Cuenta</div>
              <div className="mt-1 font-semibold text-[color:var(--ui-text-primary)]">
                {googleConnected ? "Conectada" : "Sin conexion"}
              </div>
              <div className="text-xs text-[color:var(--ui-text-secondary)]">Estado: {google?.connectionStatus ?? "pending"}</div>
            </div>
            <div className="rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] px-3 py-2.5 text-sm text-[color:var(--ui-text-primary)]">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ui-text-secondary)]">Contacts</div>
              <div className="mt-1 font-semibold text-[color:var(--ui-text-primary)]">
                {googleContactsReady ? "Scope activo" : "Scope pendiente"}
              </div>
              <div className="text-xs text-[color:var(--ui-text-secondary)]">Google Contacts</div>
            </div>
            <div className="rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] px-3 py-2.5 text-sm text-[color:var(--ui-text-primary)]">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ui-text-secondary)]">Sheets</div>
              <div className="mt-1 font-semibold text-[color:var(--ui-text-primary)]">
                {google?.preference?.syncSheetsEnabled ? "Sync activo" : "Sync apagado"}
              </div>
              <div className="text-xs text-[color:var(--ui-text-secondary)]">Hoja: {google?.contactsSheetName ?? "Contactos"}</div>
            </div>
            <div className="rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] px-3 py-2.5 text-sm text-[color:var(--ui-text-primary)]">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ui-text-secondary)]">Ultimo sync</div>
              <div className="mt-1 font-semibold text-[color:var(--ui-text-primary)]">
                {formatDateTime(google?.preference?.lastSyncedAt ?? null)}
              </div>
              <div className="text-xs text-[color:var(--ui-text-secondary)]">Conexion: {formatDateTime(google?.connection?.updatedAt ?? null)}</div>
            </div>
          </div>

          {google?.connection?.lastSyncError ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/15 px-4 py-3 text-sm text-amber-800">
              Ultimo error de sync: {normalizeVisibleErrorMessage(google.connection.lastSyncError)}
            </div>
          ) : null}

          {!googleConfigReady ? (
            <div className="rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] px-4 py-3 text-sm text-[color:var(--ui-text-secondary)]">
              Variables faltantes: {(google?.googleReady.missing ?? []).join(", ")}
            </div>
          ) : null}
        </section>

        <section className="grid content-start gap-4 rounded-3xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-2)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="ui-kicker">Importación + campañas</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--ui-text-primary)]">
                Alta masiva
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void handleCsvImportSelection(event)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="ui-cta-secondary"
              >
                Cargar CSV
              </button>
              <button
                type="button"
                onClick={() => void importContacts()}
                disabled={saving || (!importText.trim() && !importCsvText.trim())}
                className="ui-cta-secondary"
              >
                Importar
              </button>
              <button
                type="button"
                onClick={openWebCampaigns}
                disabled={!selectedWebContacts.length}
                className="ui-cta-primary"
              >
                Abrir en Web
              </button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)]">
            <div className="rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] px-3 py-2.5 text-sm text-[color:var(--ui-text-primary)]">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ui-text-secondary)]">Seleccion Web</div>
              <div className="mt-1 font-semibold text-[color:var(--ui-text-primary)]">
                {selectedWebContacts.length} contacto(s)
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectVisibleContactsForWeb}
                  className="ui-button-secondary"
                >
                  Seleccionar filtrados
                </button>
                <button
                  type="button"
                  onClick={clearWebSelection}
                  disabled={!selectedWebContacts.length}
                  className="ui-button-secondary"
                >
                  Limpiar
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] px-3 py-2.5 text-sm text-[color:var(--ui-text-primary)]">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ui-text-secondary)]">CSV listo</div>
              <div className="mt-1 truncate font-semibold text-[color:var(--ui-text-primary)]">
                {importCsvName || "Sin archivo cargado"}
              </div>
              <div className="text-xs text-[color:var(--ui-text-secondary)]">Nombre, telefono, correo</div>
            </div>
          </div>

          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            className="ui-control min-h-[104px]"
            placeholder={"Ana Gomez, 5215512345678\nCarlos Ruiz, 525512345679, carlos@email.com"}
          />
        </section>
      </div>

      <section className="mt-4 grid gap-4 rounded-3xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-2)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="ui-kicker">Google Contacts</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--ui-text-primary)]">
                Vista previa para importar al directorio local
              </div>
            </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={googleContactsQuery}
              onChange={(event) => setGoogleContactsQuery(event.target.value)}
              className="ui-control min-w-[220px]"
              placeholder="Buscar en Google Contacts"
            />
            <button
              type="button"
              onClick={() => void loadGoogleContacts()}
              disabled={googleContactsLoading || !googleConfigReady}
              className="ui-button-secondary"
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={() => void importSelectedGoogleContacts()}
              disabled={saving || !selectedGoogleContacts.length}
              className="ui-button-info"
            >
              Importar seleccionados
            </button>
          </div>
        </div>

        {!googleConnected ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--ui-border)] px-4 py-5 text-sm text-[color:var(--ui-text-secondary)]">
            Conecta Google para consultar Google Contacts.
          </div>
        ) : !googleContactsReady ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--ui-border)] px-4 py-5 text-sm text-[color:var(--ui-text-secondary)]">
            La cuenta actual no tiene permiso para Google Contacts. Reconecta Google para solicitar
            el scope correcto.
          </div>
        ) : googleContactsLoading ? (
          <div className="rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] px-4 py-5 text-sm text-[color:var(--ui-text-secondary)]">
            Cargando contactos Google...
          </div>
        ) : googleContacts.length ? (
          <div className="ui-table-wrap ui-scrollbar">
            <table className="ui-table ui-table--compact min-w-[860px]">
              <thead>
                <tr>
                  <th className="ui-cell-nowrap text-left">Sel</th>
                  <th className="text-left">Contacto</th>
                  <th className="ui-cell-nowrap text-left">Telefono</th>
                  <th className="text-left">Empresa / cargo</th>
                  <th className="text-left">Correo</th>
                  <th className="ui-cell-nowrap text-left">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {googleContacts.map((contact) => {
                  const selected = selectedGoogleContacts.includes(contact.resourceName);
                  return (
                    <tr key={contact.resourceName} className={selected ? "bg-sky-500/8" : undefined}>
                      <td className="ui-cell-nowrap">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleGoogleSelection(contact.resourceName)}
                          disabled={!contact.primaryPhone}
                        />
                      </td>
                      <td className="text-[color:var(--ui-text-primary)]">
                        <div className="flex items-center gap-3">
                          {contact.photoUrl ? (
                            <Image
                              src={contact.photoUrl}
                              alt={contact.displayName}
                              width={40}
                              height={40}
                              unoptimized
                              className="h-10 w-10 rounded-full border border-[color:var(--ui-border)] object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] text-xs font-semibold text-[color:var(--ui-text-secondary)]">
                              {contact.displayName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold">{contact.displayName}</div>
                            <div className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                              {contact.primaryPhone ? "Listo para importar" : "Sin telefono compatible"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="ui-cell-nowrap text-[color:var(--ui-text-secondary)]">
                        {contact.primaryPhone || "Sin telefono"}
                      </td>
                      <td className="text-[color:var(--ui-text-secondary)]">
                        {[contact.organization, contact.title].filter(Boolean).join(" · ") || "Sin datos"}
                      </td>
                      <td className="text-[color:var(--ui-text-secondary)]">{contact.primaryEmail || "Sin correo"}</td>
                      <td className="ui-cell-nowrap text-[color:var(--ui-text-secondary)]">
                        {formatDateTime(contact.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--ui-border)] px-4 py-5 text-sm text-[color:var(--ui-text-secondary)]">
            Todavia no hay resultados cargados desde Google Contacts.
          </div>
        )}
      </section>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.92fr)]">
        <section className="grid content-start gap-3 rounded-3xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-2)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Contactos</div>
              <div className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
                Mostrando {pageStart}-{pageEnd} de {visibleContacts.length} contacto(s).
              </div>
            </div>
            <div className="grid gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="ui-control max-w-[320px]"
                placeholder="Buscar contacto, campana o etiqueta"
              />
              <div className="text-right text-[11px] uppercase tracking-[0.18em] text-[color:var(--ui-text-secondary)]">
                Orden: {getSortLabel(sortKey)} en {SORT_KEY_LABELS[sortKey]}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] px-4 py-5 text-sm text-[color:var(--ui-text-secondary)]">
              Cargando contactos...
            </div>
          ) : visibleContacts.length ? (
            <>
              <div className="ui-table-wrap ui-scrollbar">
                <table className="ui-table ui-table--compact min-w-[980px]">
                  <thead>
                    <tr>
                      <th className="ui-cell-nowrap text-left">Web</th>
                      <th className="text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort("contactName")}
                          className="inline-flex items-center gap-2 font-semibold text-inherit transition hover:text-[color:var(--ui-text-primary)]"
                        >
                          Contacto
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--ui-text-secondary)]">
                            {getSortLabel("contactName")}
                          </span>
                        </button>
                      </th>
                      <th className="text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort("tags")}
                          className="inline-flex items-center gap-2 font-semibold text-inherit transition hover:text-[color:var(--ui-text-primary)]"
                        >
                          Etiquetas
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--ui-text-secondary)]">
                            {getSortLabel("tags")}
                          </span>
                        </button>
                      </th>
                      <th className="ui-cell-nowrap text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort("lastWhatsappMessageAt")}
                          className="inline-flex items-center gap-2 font-semibold text-inherit transition hover:text-[color:var(--ui-text-primary)]"
                        >
                          WhatsApp
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--ui-text-secondary)]">
                            {getSortLabel("lastWhatsappMessageAt")}
                          </span>
                        </button>
                      </th>
                      <th className="ui-cell-nowrap text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort("activeCampaignCount")}
                          className="inline-flex items-center gap-2 font-semibold text-inherit transition hover:text-[color:var(--ui-text-primary)]"
                        >
                          Campanas
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--ui-text-secondary)]">
                            {getSortLabel("activeCampaignCount")}
                          </span>
                        </button>
                      </th>
                      <th className="ui-cell-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort("campaignMessageCount")}
                          className="ml-auto inline-flex items-center gap-2 font-semibold text-inherit transition hover:text-[color:var(--ui-text-primary)]"
                        >
                          Mensajes
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--ui-text-secondary)]">
                            {getSortLabel("campaignMessageCount")}
                          </span>
                        </button>
                      </th>
                      <th className="ui-cell-nowrap text-right">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContacts.map((contact) => {
                      const isSelected = contact.id === selectedContactId;
                      const isInWebSelection = selectedWebPhones.includes(contact.normalizedPhone);
                      return (
                        <tr
                          key={contact.id}
                          className={isSelected ? "bg-emerald-500/8" : undefined}
                        >
                          <td className="ui-cell-nowrap">
                            <input
                              type="checkbox"
                              checked={isInWebSelection}
                              onChange={() => toggleWebSelection(contact)}
                            />
                          </td>
                          <td className="text-[color:var(--ui-text-primary)]">
                            <div className="font-semibold">{contact.contactName}</div>
                            <div className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                              {contact.phone}
                              {contact.email ? ` · ${contact.email}` : ""}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="ui-pill border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] text-[color:var(--ui-text-primary)]">
                                {sourceLabel(contact.source)}
                              </span>
                              {isInWebSelection ? (
                                <span className="ui-pill border-sky-500/30 bg-sky-500/12 text-sky-800">
                                  Seleccion Web
                                </span>
                              ) : null}
                            </div>
                            {contact.lastWhatsappMessageText ? (
                              <div className="mt-2 max-w-[420px] truncate text-xs text-[color:var(--ui-text-secondary)]">
                                {contact.lastWhatsappMessageText}
                              </div>
                            ) : null}
                          </td>
                          <td className="text-[color:var(--ui-text-secondary)]">
                            {contact.tags.length ? (
                              <div className="flex flex-wrap gap-2">
                                {contact.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="ui-pill border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] text-[color:var(--ui-text-primary)]"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {contact.tags.length > 3 ? (
                                  <span className="text-xs text-[color:var(--ui-text-secondary)]">
                                    +{contact.tags.length - 3}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-[color:var(--ui-text-secondary)]">Sin etiquetas</span>
                            )}
                          </td>
                          <td className="ui-cell-nowrap text-[color:var(--ui-text-secondary)]">
                            <div className="font-medium text-[color:var(--ui-text-primary)]">
                              {contact.hasWhatsappHistory ? "Con historial" : "Sin historial"}
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                              {formatDateTime(contact.lastWhatsappMessageAt)}
                            </div>
                          </td>
                          <td className="text-[color:var(--ui-text-secondary)]">
                            <div className="font-medium text-[color:var(--ui-text-primary)]">
                              {contact.activeCampaignCount} activas / {contact.campaignMemberships.length} total
                            </div>
                            {contact.campaignMemberships.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {contact.campaignMemberships.slice(0, 2).map((membership) => (
                                  <span
                                    key={`${contact.id}-${membership.campaignId}`}
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${campaignTone(membership.status)}`}
                                  >
                                    {membership.campaignName}
                                  </span>
                                ))}
                                {contact.campaignMemberships.length > 2 ? (
                                  <span className="text-xs text-[color:var(--ui-text-secondary)]">
                                    +{contact.campaignMemberships.length - 2}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <div className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Sin campanas</div>
                            )}
                          </td>
                          <td className="ui-cell-nowrap text-right font-semibold text-[color:var(--ui-text-primary)]">
                            {contact.campaignMessageCount}
                          </td>
                          <td className="ui-cell-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setCreatingNew(false);
                                setSelectedContactId(contact.id);
                              }}
                              className={[
                                "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                                isSelected
                                  ? "border border-emerald-500/30 bg-emerald-500/16 text-emerald-800"
                                  : "border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] text-[color:var(--ui-text-primary)] hover:bg-[color:var(--ui-surface-2)]",
                              ].join(" ")}
                            >
                              {isSelected ? "Seleccionado" : "Editar"}
                            </button>
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
                  <span className="text-[color:var(--ui-text-secondary)]">
                    Pagina {currentPage + 1} de {totalPages}
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
            <div className="rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] px-4 py-5 text-sm text-[color:var(--ui-text-secondary)]">
              Sin contactos cargados.
            </div>
          )}
        </section>

        <section className="grid content-start gap-4 rounded-3xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-2)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="ui-kicker">Editor</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--ui-text-primary)]">
                {selectedContact ? "Editar contacto" : "Nuevo contacto"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreatingNew(true);
                  setSelectedContactId(null);
                  setDraft(EMPTY_DRAFT);
                }}
                className="ui-pill border-[color:var(--ui-border)] bg-white/[0.045] text-[color:var(--ui-text-primary)]"
              >
                Nuevo
              </button>
              {selectedContact ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWebPhones((current) =>
                      current.includes(selectedContact.normalizedPhone)
                        ? current
                        : [...current, selectedContact.normalizedPhone],
                    );
                    router.push("/unidep/web");
                  }}
                  className="ui-pill border-sky-500/30 bg-sky-500/12 text-sky-800"
                >
                  Enviar a Web
                </button>
              ) : null}
            </div>
          </div>

          {selectedContact ? (
            <>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-3 text-sm text-[color:var(--ui-text-primary)]">
                <div className="font-semibold">{selectedContact.contactName}</div>
                <div className="mt-2 grid gap-2 text-[11px] text-[color:var(--ui-text-secondary)] sm:grid-cols-2">
                  <span>Actualizado: {formatDateTime(selectedContact.updatedAt)}</span>
                  <span>Sheet sync: {formatDateTime(selectedContact.sheetSyncedAt)}</span>
                  <span>Ultimo WhatsApp: {formatDateTime(selectedContact.lastWhatsappMessageAt)}</span>
                  <span>Mensajes de campana: {selectedContact.campaignMessageCount}</span>
                </div>
              </div>

              {selectedContact.campaignMemberships.length ? (
                <div className="grid gap-2 rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-2)] p-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-[color:var(--ui-text-secondary)]">
                    Campanas vinculadas
                  </div>
                  {selectedContact.campaignMemberships.map((membership) => (
                    <div
                      key={`${selectedContact.id}-${membership.campaignId}`}
                      className="rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-3)] px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-[color:var(--ui-text-primary)]">{membership.campaignName}</div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${campaignTone(membership.status)}`}
                          >
                            {membership.status}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${campaignTone(membership.recipientStatus)}`}
                          >
                            {membership.recipientStatus}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-[color:var(--ui-text-secondary)]">
                        Programada: {formatDateTime(membership.scheduleAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--ui-border)] px-4 py-4 text-sm text-[color:var(--ui-text-secondary)]">
                  Este contacto todavia no esta relacionado con ninguna campana.
                </div>
              )}
            </>
          ) : null}

          <label className="grid gap-2 text-sm">
            Nombre
            <input
              value={draft.contactName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, contactName: event.target.value }))
              }
              className="ui-control"
              placeholder="Ej. Ana Gomez"
            />
          </label>
          <label className="grid gap-2 text-sm">
            Telefono
            <input
              value={draft.phone}
              onChange={(event) =>
                setDraft((current) => ({ ...current, phone: event.target.value }))
              }
              className="ui-control"
              placeholder="5215512345678"
            />
          </label>
          <label className="grid gap-2 text-sm">
            Correo
            <input
              value={draft.email}
              onChange={(event) =>
                setDraft((current) => ({ ...current, email: event.target.value }))
              }
              className="ui-control"
              placeholder="correo@ejemplo.com"
            />
          </label>
          <label className="grid gap-2 text-sm">
            Etiquetas
            <input
              value={draft.tags}
              onChange={(event) =>
                setDraft((current) => ({ ...current, tags: event.target.value }))
              }
              className="ui-control"
              placeholder="vip, seguimiento, lead caliente"
            />
          </label>
          <label className="grid gap-2 text-sm">
            Datos personales
            <textarea
              value={draft.personalData}
              onChange={(event) =>
                setDraft((current) => ({ ...current, personalData: event.target.value }))
              }
              className="ui-control min-h-[92px]"
              placeholder="Preferencias, contexto y datos utiles del contacto."
            />
          </label>
          <label className="grid gap-2 text-sm">
            Notas internas
            <textarea
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({ ...current, notes: event.target.value }))
              }
              className="ui-control min-h-[92px]"
              placeholder="Seguimiento operativo o siguiente paso."
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              Cotizacion vinculada
              <SmartSelect
                value={draft.assignedQuoteSessionPublicId}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    assignedQuoteSessionPublicId: value,
                    assignedScenarioId: "",
                  }))
                }
                placeholder="Sin vinculo"
                options={[
                  { value: "", label: "Sin vinculo" },
                  ...quoteAssignments.map((assignment) => ({
                    value: assignment.publicId,
                    label: `${assignment.publicId} · ${formatDateTime(assignment.updatedAt)}`,
                  })),
                ]}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Escenario
              <SmartSelect
                value={draft.assignedScenarioId}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, assignedScenarioId: value }))
                }
                placeholder="Escenario opcional"
                options={[
                  { value: "", label: "Sin escenario" },
                  ...(selectedAssignment?.scenarios ?? []).map((scenario) => ({
                    value: scenario.id,
                    label: scenario.label,
                  })),
                ]}
                disabled={!draft.assignedQuoteSessionPublicId}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !draft.phone.trim()}
              onClick={() => void saveContact()}
              className="ui-cta-primary"
            >
              {saving ? "Guardando..." : selectedContact ? "Actualizar" : "Guardar"}
            </button>
            {selectedContact ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void deleteCurrentContact()}
                className="ui-cta-secondary"
              >
                Eliminar
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
