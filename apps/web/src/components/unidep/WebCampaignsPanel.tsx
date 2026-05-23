"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import {
  buildRecipientsTextFromSelection,
  readWebCampaignSelection,
  writeWebCampaignSelection,
  type WebCampaignSelectableContact,
} from "@/lib/web-campaign-selection";

type ContactRecord = WebCampaignSelectableContact & {
  tags: string[];
  hasWhatsappHistory: boolean;
  campaignMessageCount: number;
  activeCampaignCount: number;
  lastWhatsappMessageAt: string | null;
};

type CampaignRecipient = {
  id: string;
  contactValue: string;
  contactName: string | null;
  status: string;
  resolvedMessage: string;
  scheduledFor?: string | null;
  attemptedAt?: string | null;
  sentAt?: string | null;
  lastError?: string | null;
};

type CampaignRecord = {
  id: string;
  campaignName: string;
  channel?: string;
  status: string;
  businessStatus?: string;
  businessStatusLabel?: string;
  scheduleAt: string | null;
  batchSize: number;
  messageTemplate: string | null;
  messageDelayMs: number;
  mediaUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  stats: {
    total: number;
    queued?: number;
    scheduled?: number;
    claimed?: number;
    sent?: number;
    failed?: number;
  };
  recipients: CampaignRecipient[];
};

type RunnerHealth = {
  available: boolean;
  isHealthy: boolean;
  status: "online" | "stale" | "offline";
  staleAfterMs: number;
  lastHeartbeatAt: string | null;
  lastHeartbeatAgeMs: number | null;
  lastEventType: string | null;
  lastRunId: string | null;
  message: string;
};

type CampaignTransport = "extension_runner" | "test_mode" | "manual_review";

type CampaignRepairAction = {
  key: string;
  actionId: string;
  name: string;
  severity: "safe_auto_fix" | "review_required";
  campaignId: string;
  campaignName: string;
  preview: Record<string, unknown>;
};

type CampaignRepairReport = {
  requestId: string;
  findings: Array<{
    code: string;
    message: string;
    severity: "critical" | "high" | "medium" | "info";
    campaignId: string;
    campaignName: string;
  }>;
  actions: CampaignRepairAction[];
  summary: {
    campaignsAnalyzed: number;
    findings: number;
    safeActions: number;
    reviewActions: number;
    appliedActions: number;
    releasedClaimedRecipients: number;
    reconciledCampaigns: number;
  };
  applied?: {
    appliedActions: number;
    releasedClaimedRecipients: number;
    reconciledCampaigns: number;
    updatedCampaignIds: string[];
  };
};

type UploadedAsset = {
  secureUrl: string;
  publicId: string;
  bytes: number | null;
  format: string | null;
  resourceType: string | null;
};

const DEFAULT_TEMPLATE = [
  "Hola {{nombre}}, te comparto la información que acordamos.",
  "",
  "Si gustas, te ayudo a continuar con el proceso.",
].join("\n");

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatSchedule(value: string | null) {
  return value ? formatDateTime(value) : "Inmediata";
}

function recipientStatusLabel(status: string) {
  const normalized = String(status ?? "").trim().toLowerCase();
  switch (normalized) {
    case "queued":
      return "En cola";
    case "scheduled":
      return "Programado";
    case "claimed":
      return "Tomado por runner";
    case "running":
    case "processing":
      return "Procesando";
    case "sent":
    case "completed":
      return "Enviado";
    case "failed":
      return "Fallido";
    case "blocked":
      return "Bloqueado";
    default:
      return normalized || "Sin estado";
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }

    if (!quoted && char === ",") {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function csvToRecipientsText(csvText: string) {
  const lines = csvText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return "";

  const rows = lines.map(parseCsvLine);
  const header = rows[0]?.map((value) => value.trim().toLowerCase()) ?? [];
  const looksLikeHeader = header.some((value) =>
    [
      "nombre",
      "name",
      "numero",
      "número",
      "number",
      "telefono",
      "teléfono",
      "phone",
    ].includes(value),
  );

  const dataRows = looksLikeHeader ? rows.slice(1) : rows;
  return dataRows
    .map((columns) => columns.map((value) => value.trim()).filter(Boolean))
    .filter((columns) => columns.length > 0)
    .map((columns) => {
      if (columns.length === 1) return columns[0];
      return `${columns[0]}, ${columns[columns.length - 1]}`;
    })
    .join("\n");
}

function mergeRecipientsText(...blocks: string[]) {
  return blocks.map((value) => value.trim()).filter(Boolean).join("\n");
}

type CampaignStatusSummary = Pick<
  CampaignRecord,
  "status" | "businessStatus" | "businessStatusLabel" | "stats" | "recipients"
>;

function statusTone(status: string) {
  switch (status) {
    case "completed":
    case "sent":
      return "border-emerald-300 bg-emerald-100 text-emerald-950";
    case "completed_with_issues":
    case "partial":
      return "border-cyan-300 bg-cyan-100 text-cyan-950";
    case "failed":
    case "blocked":
      return "border-red-300 bg-red-100 text-red-950";
    case "running":
    case "processing":
    case "claimed":
      return "border-sky-300 bg-sky-100 text-sky-950";
    case "scheduled":
    case "waiting_runner":
    case "paused":
    case "queued":
      return "border-amber-300 bg-amber-100 text-amber-950";
    case "draft":
      return "border-indigo-300 bg-indigo-100 text-indigo-950";
    default:
      return "border-slate-300 bg-slate-100 text-slate-900";
  }
}

function isTerminalCampaignStatus(status: string) {
  return ["completed", "sent", "failed", "partial", "blocked"].includes(
    String(status ?? "").trim().toLowerCase(),
  );
}

function isCampaignStatusActiveForRepair(status: string) {
  return ["queued", "scheduled", "running", "processing", "claimed", "waiting_runner"].includes(
    String(status ?? "").trim().toLowerCase(),
  );
}

function countCampaignFailures(campaign: CampaignStatusSummary) {
  const failedFromStats = Math.max(Number(campaign.stats?.failed ?? 0), 0);
  const failedFromRecipients = campaign.recipients.filter((recipient) => {
    return String(recipient.status ?? "").trim().toLowerCase() === "failed";
  }).length;
  return Math.max(failedFromStats, failedFromRecipients);
}

function resolveCampaignStatus(campaign: CampaignStatusSummary) {
  if (campaignHasCompletedIssues(campaign)) return "completed_with_issues";
  return String(campaign.businessStatus ?? campaign.status ?? "")
    .trim()
    .toLowerCase() || "queued";
}

export function campaignHasCompletedIssues(campaign: CampaignStatusSummary) {
  const failedCount = countCampaignFailures(campaign);
  const normalizedStatuses = [campaign.businessStatus, campaign.status]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
  const isTerminalState = normalizedStatuses.some((status) => isTerminalCampaignStatus(status));
  const isExplicitIssuesState = normalizedStatuses.some((status) =>
    ["partial", "completed_with_issues"].includes(status),
  );
  return isTerminalState && (isExplicitIssuesState || failedCount > 0);
}

export function campaignStatusTone(campaign: CampaignStatusSummary) {
  return statusTone(resolveCampaignStatus(campaign));
}

export function campaignStatusDisplayLabel(campaign: CampaignStatusSummary) {
  const failedCount = countCampaignFailures(campaign);
  if (campaignHasCompletedIssues(campaign)) {
    return failedCount > 0
      ? `Completada con incidencias (${failedCount} fallido(s))`
      : "Completada con incidencias";
  }
  const explicitLabel = String(campaign.businessStatusLabel ?? "").trim();
  if (explicitLabel) return explicitLabel;
  const normalized = resolveCampaignStatus(campaign);
  if (normalized === "sent" || normalized === "completed") return "Completada";
  return normalized || "queued";
}

function toCsvCell(value: string | null | undefined) {
  const normalized = String(value ?? "");
  const escaped = normalized.replace(/"/g, '""');
  return `"${escaped}"`;
}

export default function WebCampaignsPanel() {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [runner, setRunner] = useState<RunnerHealth | null>(null);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [repairingCampaignId, setRepairingCampaignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [notes, setNotes] = useState("");
  const [manualRecipientsText, setManualRecipientsText] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [batchSize, setBatchSize] = useState("25");
  const [delaySeconds, setDelaySeconds] = useState("4");
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);
  const [uploadedAsset, setUploadedAsset] = useState<UploadedAsset | null>(null);
  const [manualMediaUrl, setManualMediaUrl] = useState("");
  const [campaignTransport, setCampaignTransport] =
    useState<CampaignTransport>("extension_runner");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);

  async function loadContacts() {
    setContactsLoading(true);
    try {
      const response = await fetch("/api/data/contacts", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        contacts?: ContactRecord[];
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible cargar los contactos.");
      }

      const nextContacts = data.contacts ?? [];
      setContacts(nextContacts);

      const stored = readWebCampaignSelection();
      if (stored.length) {
        const availablePhones = new Set(
          nextContacts.map((contact) => contact.normalizedPhone),
        );
        setSelectedPhones((current) => {
          const seeded = stored
            .map((contact) => contact.normalizedPhone)
            .filter((phone) => availablePhones.has(phone));
          return current.length ? current : seeded;
        });
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar los contactos.",
      );
    } finally {
      setContactsLoading(false);
    }
  }

  async function loadCampaigns({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) setCampaignsLoading(true);
    try {
      const response = await fetch("/api/ext/campaigns", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        campaigns?: CampaignRecord[];
        runner?: RunnerHealth | null;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible cargar las campañas web.");
      }

      const nextCampaigns = data.campaigns ?? [];
      setCampaigns(nextCampaigns);
      setRunner(data.runner ?? null);
      setSelectedCampaignId((current) => {
        if (current && nextCampaigns.some((campaign) => campaign.id === current)) {
          return current;
        }
        return nextCampaigns[0]?.id ?? null;
      });
      setSelectedCampaignIds((current) =>
        current.filter((campaignId) =>
          nextCampaigns.some((campaign) => campaign.id === campaignId),
        ),
      );
      return nextCampaigns;
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar las campañas web.",
      );
      return [] as CampaignRecord[];
    } finally {
      if (!silent) setCampaignsLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([loadContacts(), loadCampaigns()]);
    const interval = window.setInterval(() => {
      void loadCampaigns({ silent: true });
    }, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredContacts = useMemo(() => {
    const normalizedQuery = contactQuery.trim().toLowerCase();
    if (!normalizedQuery) return contacts;
    return contacts.filter((contact) =>
      [
        contact.contactName,
        contact.phone,
        contact.email ?? "",
        contact.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [contactQuery, contacts]);

  const selectedContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        selectedPhones.includes(contact.normalizedPhone),
      ),
    [contacts, selectedPhones],
  );

  useEffect(() => {
    writeWebCampaignSelection(selectedContacts);
  }, [selectedContacts]);

  const contactRecipientsText = useMemo(
    () => buildRecipientsTextFromSelection(selectedContacts),
    [selectedContacts],
  );
  const composedRecipientsText = useMemo(
    () => mergeRecipientsText(contactRecipientsText, manualRecipientsText),
    [contactRecipientsText, manualRecipientsText],
  );
  const composedRecipientLines = useMemo(
    () =>
      composedRecipientsText
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [composedRecipientsText],
  );

  const selectedCampaign = useMemo(
    () =>
      campaigns.find((campaign) => campaign.id === selectedCampaignId) ??
      campaigns[0] ??
      null,
    [campaigns, selectedCampaignId],
  );
  const selectedCampaignsForExport = useMemo(
    () =>
      campaigns.filter((campaign) => selectedCampaignIds.includes(campaign.id)),
    [campaigns, selectedCampaignIds],
  );
  const exportScope = useMemo(() => {
    if (selectedCampaignsForExport.length) return selectedCampaignsForExport;
    return selectedCampaign ? [selectedCampaign] : [];
  }, [selectedCampaign, selectedCampaignsForExport]);

  const totals = useMemo(() => {
    return campaigns.reduce(
      (accumulator, campaign) => {
        accumulator.campaigns += 1;
        accumulator.contacts += campaign.stats.total;
        accumulator.sent += campaign.stats.sent ?? 0;
        accumulator.failed += campaign.stats.failed ?? 0;
        return accumulator;
      },
      { campaigns: 0, contacts: 0, sent: 0, failed: 0 },
    );
  }, [campaigns]);

  const extensionRunnerAvailable = Boolean(runner?.available);
  const runnerUnavailableForDispatch =
    campaignTransport === "extension_runner" && !extensionRunnerAvailable;
  const runnerStatusLabel =
    runner?.status === "online"
      ? "Runner activo"
      : runner?.status === "stale"
        ? "Runner sin heartbeat reciente"
        : "Runner no disponible";

  function toggleContact(contact: ContactRecord) {
    setSelectedPhones((current) =>
      current.includes(contact.normalizedPhone)
        ? current.filter((phone) => phone !== contact.normalizedPhone)
        : [...current, contact.normalizedPhone],
    );
  }

  function toggleCampaignSelection(campaignId: string) {
    setSelectedCampaignIds((current) =>
      current.includes(campaignId)
        ? current.filter((value) => value !== campaignId)
        : [...current, campaignId],
    );
  }

  async function handleCsvImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = csvToRecipientsText(text);
      if (!imported.trim()) {
        throw new Error("El CSV no contiene filas válidas para destinatarios.");
      }
      setManualRecipientsText((current) => mergeRecipientsText(current, imported));
      setSuccess(`CSV importado: ${file.name}`);
      setError(null);
    } catch (csvError) {
      setError(
        csvError instanceof Error
          ? csvError.message
          : "No fue posible leer el CSV.",
      );
      setSuccess(null);
    } finally {
      event.target.value = "";
    }
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/ext/campaigns/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        asset?: UploadedAsset;
      };

      if (!response.ok || !data.ok || !data.asset) {
        throw new Error(data.error || "No fue posible subir la imagen.");
      }

      setUploadedAsset(data.asset);
      setManualMediaUrl(data.asset.secureUrl);
      setSuccess(`Imagen cargada: ${file.name}`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "No fue posible subir la imagen.",
      );
      setUploadedAsset(null);
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/ext/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaignName,
          channel: campaignTransport,
          notes,
          recipientsText: composedRecipientsText,
          scheduleAt: scheduleAt || null,
          batchSize: Number(batchSize) || 25,
          messageTemplate,
          messageDelayMs: Math.max(0.25, Number(delaySeconds) || 4) * 1000,
          mediaUrl: manualMediaUrl || null,
          meta: {
            source: "workspace_web_panel",
            mediaPublicId: uploadedAsset?.publicId ?? null,
            mediaBytes: uploadedAsset?.bytes ?? null,
            selectedContactCount: selectedContacts.length,
          },
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        campaign?: CampaignRecord;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible crear la campaña.");
      }

      setCampaignName("");
      setNotes("");
      setManualRecipientsText("");
      setScheduleAt("");
      setBatchSize("25");
      setDelaySeconds("4");
      setMessageTemplate(DEFAULT_TEMPLATE);
      setUploadedAsset(null);
      setManualMediaUrl("");
      setCampaignTransport((current) =>
        current === "extension_runner" && !extensionRunnerAvailable
          ? "manual_review"
          : current,
      );
      setSuccess(
        data.campaign?.status === "waiting_runner"
          ? "Campaña creada en espera de runner. Cuando el canal esté activo, continuará automáticamente."
          : data.campaign?.status === "draft"
            ? "Campaña creada en modo prueba (draft). No se enviará hasta revisión manual."
            : data.campaign?.status === "blocked"
              ? "Campaña creada para revisión manual. No se enviará automáticamente."
              : "Campaña web creada y lista para ejecución operativa.",
      );
      await loadCampaigns();
      if (data.campaign?.id) setSelectedCampaignId(data.campaign.id);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible crear la campaña.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateCampaign(
    campaignId: string,
    action: "pause" | "resume" | "force_pause",
    options?: { silent?: boolean; successMessage?: string | null },
  ) {
    try {
      if (!options?.silent) setError(null);
      const response = await fetch(`/api/ext/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        campaign?: CampaignRecord;
      };

      if (!response.ok || !data.ok || !data.campaign) {
        throw new Error(data.error || "No fue posible actualizar la campaña.");
      }

      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === data.campaign?.id ? data.campaign : campaign,
        ),
      );
      setSelectedCampaignId((current) => current ?? data.campaign?.id ?? null);
      if (!options?.silent) {
        setSuccess(
          options?.successMessage ??
            (action === "resume"
              ? "Campaña reanudada."
              : action === "force_pause"
                ? "Campaña detenida con forzar pausa."
                : "Campaña pausada."),
        );
      }
      return data.campaign;
    } catch (campaignError) {
      if (!options?.silent) {
        setError(
          campaignError instanceof Error
            ? campaignError.message
            : "No fue posible actualizar la campaña.",
        );
      }
      throw campaignError;
    }
  }

  async function requestCampaignRepair(
    campaignId: string,
    mode: "preview" | "apply",
  ) {
    const response = await fetch("/api/ext/campaigns/repair", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode,
        campaignId,
      }),
    });
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      report?: CampaignRepairReport;
    };

    if (!response.ok || !data.ok || !data.report) {
      throw new Error(
        data.error || "No fue posible ejecutar diagnóstico/reparación de campaña.",
      );
    }
    return data.report;
  }


  async function waitForCampaignStatus(
    campaignId: string,
    acceptedStatuses: string[],
    timeoutMs = 12_000,
  ) {
    const accepted = new Set(acceptedStatuses.map((status) => status.trim().toLowerCase()));
    const startedAt = Date.now();
    let lastKnownCampaign: CampaignRecord | null = null;

    while (Date.now() - startedAt <= timeoutMs) {
      const nextCampaigns = await loadCampaigns({ silent: true });
      const current = nextCampaigns.find((item) => item.id === campaignId) ?? null;
      const currentStatus = String(current?.status ?? "").trim().toLowerCase();
      if (current) lastKnownCampaign = current;
      if (current && accepted.has(currentStatus)) return current;
      await delay(600);
    }

    return lastKnownCampaign;
  }

  async function autoDiagnoseAndRepairCampaign(campaign: CampaignRecord) {
    setRepairingCampaignId(campaign.id);
    setError(null);
    setSuccess(null);

    const wasActive = isCampaignStatusActiveForRepair(campaign.status);

    try {
      const preview = await requestCampaignRepair(campaign.id, "preview");
      const summary = [
        `Hallazgos: ${preview.summary.findings}`,
        `Acciones seguras: ${preview.summary.safeActions}`,
        `Campañas analizadas: ${preview.summary.campaignsAnalyzed}`,
      ].join("\n");

      const confirmationMessage = wasActive
        ? `Diagnóstico de "${campaign.campaignName}"

${summary}

La campaña se pondrá en pausa segura, se aplicará la auto-reparación disponible y luego se reanudará desde la web.

¿Continuar?`
        : `Diagnóstico de "${campaign.campaignName}"

${summary}

¿Aplicar auto-reparación segura ahora?`;

      const shouldProceed = window.confirm(confirmationMessage);
      if (!shouldProceed) return;

      if (wasActive) {
        await updateCampaign(campaign.id, "force_pause", { silent: true });
        await waitForCampaignStatus(campaign.id, [
          "paused",
          "completed",
          "sent",
          "failed",
          "partial",
          "blocked",
        ]);
      }

      if (!preview.actions.length) {
        if (wasActive) {
          await updateCampaign(campaign.id, "resume", { silent: true });
          await loadCampaigns({ silent: true });
          setSuccess(
            "Diagnóstico completado: no se detectaron reparaciones pendientes y la campaña se reanudó desde la web.",
          );
        } else {
          setSuccess(
            "Diagnóstico completado: no se detectaron reparaciones automáticas pendientes.",
          );
        }
        return;
      }

      const applied = await requestCampaignRepair(campaign.id, "apply");
      await loadCampaigns({ silent: true });

      if (wasActive) {
        await updateCampaign(campaign.id, "resume", { silent: true });
        await loadCampaigns({ silent: true });
      }

      const appliedActions = applied.applied?.appliedActions ?? 0;
      const releasedClaimed = applied.applied?.releasedClaimedRecipients ?? 0;
      setSuccess(
        appliedActions
          ? wasActive
            ? `Auto-reparación aplicada: ${appliedActions} acción(es), ${releasedClaimed} claimed liberados. La campaña quedó reanudada desde la web; si la extensión sigue abierta y con sesión activa, retomará el runner automáticamente.`
            : `Auto-reparación aplicada: ${appliedActions} acción(es), ${releasedClaimed} claimed liberados.`
          : wasActive
            ? "Auto-reparación ejecutada sin cambios adicionales. La campaña quedó reanudada desde la web."
            : "Auto-reparación ejecutada sin cambios adicionales.",
      );
    } catch (repairError) {
      setError(
        repairError instanceof Error
          ? repairError.message
          : "No fue posible auto-diagnosticar y reparar la campaña.",
      );
    } finally {
      setRepairingCampaignId(null);
    }
  }


  function downloadRecipientsCsv(
    scope: CampaignRecord[],
    recipientStatus: "sent" | "failed",
  ) {
    if (!scope.length) {
      setError("Selecciona al menos una campaña para exportar.");
      return;
    }

    const targetStatuses =
      recipientStatus === "sent" ? new Set(["sent", "completed"]) : new Set(["failed"]);
    const exportedRecipients = scope.flatMap((campaign) =>
      campaign.recipients
        .filter((recipient) =>
          targetStatuses.has(String(recipient.status ?? "").trim().toLowerCase()),
        )
        .map((recipient) => [
          campaign.campaignName,
          campaign.id,
          recipient.contactName ?? "",
          recipient.contactValue ?? "",
          recipient.status ?? "",
          recipient.lastError ?? "",
          recipient.scheduledFor ?? "",
          recipient.sentAt || recipient.attemptedAt || "",
        ]),
    );

    if (!exportedRecipients.length) {
      setError(
        recipientStatus === "sent"
          ? "No hay destinatarios enviados para exportar."
          : "No hay destinatarios fallidos para exportar.",
      );
      return;
    }

    const rows = [
      [
        "campana",
        "campaign_id",
        "nombre",
        "telefono",
        "estatus",
        "error",
        "programado",
        "intento_o_envio",
      ],
      ...exportedRecipients,
    ];
    const csv = rows
      .map((columns) => columns.map((column) => toCsvCell(column)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `campaign-${recipientStatus}-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setError(null);
    setSuccess(
      `CSV de ${recipientStatus === "sent" ? "enviados" : "fallidos"} descargado.`,
    );
  }

  async function deleteCampaign(campaignId: string) {
    try {
      setError(null);
      const response = await fetch(`/api/ext/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible eliminar la campaña.");
      }

      setCampaigns((current) =>
        current.filter((campaign) => campaign.id !== campaignId),
      );
      setSelectedCampaignId((current) => (current === campaignId ? null : current));
      setSelectedCampaignIds((current) =>
        current.filter((selectedId) => selectedId !== campaignId),
      );
      setSuccess("Campaña eliminada.");
    } catch (campaignError) {
      setError(
        campaignError instanceof Error
          ? campaignError.message
          : "No fue posible eliminar la campaña.",
      );
    }
  }

  return (
    <section className="ui-card ui-card-pad grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="ui-kicker">Campañas</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">
            Campañas web
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-300">
          <span className="ui-pill">{totals.campaigns} campañas</span>
          <span className="ui-pill">{totals.contacts} contactos</span>
          <span className="ui-pill">{totals.sent} enviados</span>
          <span className="ui-pill">{totals.failed} fallidos</span>
          <span className="ui-pill">{runnerStatusLabel}</span>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-100 px-3 py-2 text-sm font-medium text-red-950">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-950">
          {success}
        </div>
      ) : null}
      {runnerUnavailableForDispatch ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950">
          El canal <strong>Extension runner</strong> no está disponible ahora. Si creas la campaña
          quedará en <strong>waiting_runner</strong> hasta que el heartbeat vuelva a estar activo.
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 2xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]"
      >
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm text-slate-200">
            Nombre de la campaña
            <input
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              className="ui-control"
              placeholder="Ej. Becas abril campus norte"
            />
          </label>

          <div className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/35 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-100">
                  Contactos del workspace
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="ui-pill">{selectedContacts.length} seleccionados</span>
                <label className="rounded-full border border-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/5">
                  Importar CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(event) => void handleCsvImport(event)}
                  />
                </label>
              </div>
            </div>

            <input
              value={contactQuery}
              onChange={(event) => setContactQuery(event.target.value)}
              className="ui-control"
              placeholder="Buscar por nombre, teléfono o etiqueta"
            />

            <div className="ui-scrollbar max-h-[320px] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/40">
              {contactsLoading ? (
                <div className="px-4 py-5 text-sm text-slate-300">
                  Cargando contactos...
                </div>
              ) : filteredContacts.length ? (
                <div className="divide-y divide-white/6">
                  {filteredContacts.map((contact) => {
                    const isSelected = selectedPhones.includes(contact.normalizedPhone);
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => toggleContact(contact)}
                        className={[
                          "grid w-full gap-2 px-3 py-3 text-left transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
                          isSelected
                            ? "bg-emerald-500/10 text-slate-100"
                            : "text-slate-200 hover:bg-white/[0.04]",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold text-white">
                              {contact.contactName}
                            </div>
                            {contact.tags[0] ? (
                              <span className="ui-pill border-white/10 bg-white/[0.04] text-[11px] text-slate-200">
                                {contact.tags[0]}
                              </span>
                            ) : null}
                            {contact.hasWhatsappHistory ? (
                              <span className="ui-pill border-emerald-400/20 bg-emerald-500/10 text-[11px] text-emerald-100">
                                WhatsApp
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-400">
                            {contact.phone}
                            {contact.email ? ` · ${contact.email}` : ""}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <span className="text-[11px] text-slate-500">
                            {contact.activeCampaignCount} activas
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {contact.campaignMessageCount} envíos
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                              isSelected
                                ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-100"
                                : "border-white/10 bg-white/[0.04] text-slate-100"
                            }`}
                          >
                            {isSelected ? "En campaña" : "Agregar"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-5 text-sm text-slate-400">
                  No hay contactos disponibles para este filtro.
                </div>
              )}
            </div>

            <label className="grid gap-2 text-sm text-slate-200">
              Lista manual o importada
              <textarea
                value={manualRecipientsText}
                onChange={(event) => setManualRecipientsText(event.target.value)}
                className="ui-control min-h-[120px] font-mono text-sm"
                placeholder={["Ana Gómez, 5215512345678", "Carlos Ruiz, 525512345679"].join("\n")}
                spellCheck={false}
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
              <div className="font-semibold text-slate-100">Destinatarios compuestos</div>
              <div className="mt-1">
                {composedRecipientLines.length} registro(s) entre selección del
                workspace y carga manual.
              </div>
            </div>
          </div>

          <label className="grid gap-2 text-sm text-slate-200">
            Template del mensaje
            <textarea
              value={messageTemplate}
              onChange={(event) => setMessageTemplate(event.target.value)}
              className="ui-control min-h-[148px]"
              spellCheck={false}
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-200">
            Notas internas
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="ui-control min-h-[80px]"
              placeholder="Objetivo, segmento, criterio comercial o indicaciones operativas."
            />
          </label>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/35 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-200">
                Batch por reclamo
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={batchSize}
                  onChange={(event) => setBatchSize(event.target.value)}
                  className="ui-control"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                Delay por mensaje (seg)
                <input
                  type="number"
                  min={0.25}
                  max={60}
                  step={0.25}
                  value={delaySeconds}
                  onChange={(event) => setDelaySeconds(event.target.value)}
                  className="ui-control"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-slate-200">
              Canal de envío
              <select
                value={campaignTransport}
                onChange={(event) =>
                  setCampaignTransport(event.target.value as CampaignTransport)
                }
                className="ui-control"
              >
                <option value="extension_runner">
                  Extension runner (WhatsApp Web)
                </option>
                <option value="test_mode">Modo prueba (sin envío real)</option>
                <option value="manual_review">Revisión manual</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-200">
              Programar para
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
                className="ui-control"
              />
            </label>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-100">
                  Imagen de campaña
                </div>
                <label className="rounded-full border border-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/5">
                  {uploadingImage ? "Subiendo..." : "Subir imagen"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void handleImageUpload(event)}
                    disabled={uploadingImage}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm text-slate-200">
                URL de imagen
                <input
                  type="url"
                  value={manualMediaUrl}
                  onChange={(event) => setManualMediaUrl(event.target.value)}
                  className="ui-control"
                  placeholder="Opcional. Se llena automáticamente si subes un archivo."
                />
              </label>

              {uploadedAsset ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  Cloudinary: {uploadedAsset.publicId}
                </div>
              ) : null}

              {manualMediaUrl ? (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-2">
                  <Image
                    src={manualMediaUrl}
                    alt="Preview de campaña"
                    width={960}
                    height={352}
                    unoptimized
                    className="h-44 w-full rounded-2xl object-cover"
                  />
                </div>
              ) : null}
            </div>

            <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
              <div className="rounded-2xl border border-white/8 px-3 py-2">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Listos</div>
                <div className="mt-1 font-semibold text-white">{composedRecipientLines.length}</div>
              </div>
              <div className="rounded-2xl border border-white/8 px-3 py-2">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Desde Contactos</div>
                <div className="mt-1 font-semibold text-white">{selectedContacts.length}</div>
              </div>
              <div className="rounded-2xl border border-white/8 px-3 py-2">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Programación</div>
                <div className="mt-1 font-semibold text-white">{formatSchedule(scheduleAt || null)}</div>
              </div>
              <div className="rounded-2xl border border-white/8 px-3 py-2">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Canal</div>
                <div className="mt-1 font-semibold text-white">{campaignTransport}</div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || composedRecipientLines.length === 0}
              className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving
                ? "Creando campaña..."
                : campaignTransport === "extension_runner" && !extensionRunnerAvailable
                  ? "Crear en espera de runner"
                  : campaignTransport === "test_mode"
                    ? "Crear campaña en modo prueba"
                    : campaignTransport === "manual_review"
                      ? "Crear para revisión manual"
                      : "Crear campaña web"}
            </button>
          </div>
        </div>
      </form>

      <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="grid min-w-0 gap-3">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <h3 className="min-w-0 text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
              Campañas recientes
            </h3>
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
              <span className="rounded-full border border-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                {(() => {
                  const campaignCount = selectedCampaignIds.length || (selectedCampaign ? 1 : 0);
                  return `${campaignCount} ${campaignCount === 1 ? "campaña" : "campañas"}`;
                })()}
              </span>
              <button
                type="button"
                onClick={() => setSelectedCampaignIds(campaigns.map((campaign) => campaign.id))}
                disabled={!campaigns.length}
                className="rounded-full border border-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/5 disabled:opacity-50"
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setSelectedCampaignIds([])}
                disabled={!selectedCampaignIds.length}
                className="rounded-full border border-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/5 disabled:opacity-50"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => void loadCampaigns()}
                className="rounded-full border border-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/5"
              >
                Recargar
              </button>
            </div>
          </div>

          {campaignsLoading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-300">
              Cargando campañas...
            </div>
          ) : campaigns.length ? (
            campaigns.map((campaign) => (
              <article
                key={campaign.id}
                className={`grid min-w-0 gap-2 rounded-3xl border p-3.5 text-left transition hover:-translate-y-[1px] ${
                  selectedCampaign?.id === campaign.id
                    ? "border-emerald-400/35 bg-emerald-500/10"
                    : "border-white/10 bg-slate-950/35 hover:bg-slate-900/60"
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <label className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    <span className="sr-only">Seleccionar campaña {campaign.campaignName}</span>
                    <input
                      type="checkbox"
                      checked={selectedCampaignIds.includes(campaign.id)}
                      onChange={() => toggleCampaignSelection(campaign.id)}
                      className="h-4 w-4 rounded border-white/20 bg-slate-950/70 text-emerald-500 focus:ring-emerald-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className="grid min-w-0 flex-1 gap-2 text-left"
                  >
                    <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {campaign.campaignName}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                          <span>{campaign.stats.total} destinatarios</span>
                          <span>Batch {campaign.batchSize}</span>
                          <span>{campaign.channel ?? "extension_runner"}</span>
                          <span>{formatSchedule(campaign.scheduleAt)}</span>
                          <span>{campaign.stats.sent ?? 0} enviados</span>
                          <span>{campaign.stats.failed ?? 0} fallidos</span>
                        </div>
                      </div>
                      <span
                        className={`w-fit max-w-full rounded-full border px-2.5 py-1 text-left text-[11px] font-semibold uppercase leading-snug tracking-[0.12em] md:max-w-[18rem] ${campaignStatusTone(campaign)}`}
                      >
                        {campaignStatusDisplayLabel(campaign)}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-slate-500">
                      Delay {Math.round(campaign.messageDelayMs / 10) / 100}s
                    </div>
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/25 p-4 text-sm text-slate-300">
              Aún no hay campañas creadas desde la web.
            </div>
          )}
        </div>

        <div className="grid min-w-0 gap-4">
          <article className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">
                {selectedCampaignIds.length > 1
                  ? `${selectedCampaignIds.length} campañas`
                  : exportScope[0]?.campaignName ?? "Descargas"}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadRecipientsCsv(exportScope, "sent")}
                  disabled={!exportScope.length}
                  className="ui-button-info"
                >
                  CSV enviados
                </button>
                <button
                  type="button"
                  onClick={() => downloadRecipientsCsv(exportScope, "failed")}
                  disabled={!exportScope.length}
                  className="ui-button-danger"
                >
                  CSV fallidos
                </button>
              </div>
            </div>
          </article>

          {selectedCampaign ? (
            <>
              <article className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Detalle activo
                    </div>
                    <h3 className="mt-1 truncate text-lg font-semibold text-white">
                      {selectedCampaign.campaignName}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Creada {formatDateTime(selectedCampaign.createdAt)} ·
                      actualizada {formatDateTime(selectedCampaign.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <span
                      className={`w-fit max-w-full rounded-full border px-3 py-1 text-xs font-semibold uppercase leading-snug tracking-[0.12em] ${campaignStatusTone(selectedCampaign)}`}
                    >
                      {campaignStatusDisplayLabel(selectedCampaign)}
                    </span>
                    {[
                      "queued",
                      "scheduled",
                      "running",
                      "processing",
                      "waiting_runner",
                    ].includes(selectedCampaign.status) ? (
                      <button
                        type="button"
                        onClick={() => void updateCampaign(selectedCampaign.id, "force_pause")}
                        className="ui-button-secondary"
                        disabled={repairingCampaignId === selectedCampaign.id}
                      >
                        Forzar pausa
                      </button>
                    ) : null}
                    {selectedCampaign.status === "paused" ? (
                      <button
                        type="button"
                        onClick={() => void updateCampaign(selectedCampaign.id, "resume")}
                        className="ui-button-info"
                        disabled={repairingCampaignId === selectedCampaign.id}
                      >
                        Reanudar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void autoDiagnoseAndRepairCampaign(selectedCampaign)}
                      className="ui-button-secondary"
                      disabled={repairingCampaignId === selectedCampaign.id}
                    >
                      {repairingCampaignId === selectedCampaign.id
                        ? "Diagnosticando..."
                        : isCampaignStatusActiveForRepair(selectedCampaign.status)
                          ? "Diagnosticar, reparar y continuar"
                          : "Diagnosticar y reparar"}
                    </button>
                    {[
                      "paused",
                      "completed",
                      "sent",
                      "failed",
                      "partial",
                      "blocked",
                      "draft",
                    ].includes(selectedCampaign.status) ? (
                      <button
                        type="button"
                        onClick={() => void deleteCampaign(selectedCampaign.id)}
                        className="ui-button-danger"
                        disabled={repairingCampaignId === selectedCampaign.id}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Template guardado
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-100">
                      {selectedCampaign.messageTemplate || "Sin template guardado."}
                    </pre>
                  </div>

                  <div className="grid gap-3">
                    <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Programación
                        </div>
                        <div className="mt-1">
                          {formatSchedule(selectedCampaign.scheduleAt)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Cierre
                        </div>
                        <div className="mt-1">
                          {formatDateTime(selectedCampaign.completedAt)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Batch
                        </div>
                        <div className="mt-1">{selectedCampaign.batchSize}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Delay
                        </div>
                        <div className="mt-1">
                          {Math.round(selectedCampaign.messageDelayMs / 10) / 100}s
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Canal
                        </div>
                        <div className="mt-1">{selectedCampaign.channel ?? "extension_runner"}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Runner health
                        </div>
                        <div className="mt-1">{runnerStatusLabel}</div>
                      </div>
                    </div>

                    <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                      <div className="rounded-2xl border border-white/10 px-3 py-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          En cola
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {selectedCampaign.stats.queued ?? 0}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 px-3 py-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Programados
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {selectedCampaign.stats.scheduled ?? 0}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 px-3 py-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Reclamados
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {selectedCampaign.stats.claimed ?? 0}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 px-3 py-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Enviados
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {selectedCampaign.stats.sent ?? 0}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 px-3 py-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Fallidos
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {selectedCampaign.stats.failed ?? 0}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 px-3 py-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Total
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {selectedCampaign.stats.total}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedCampaign.mediaUrl ? (
                  <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 p-2">
                    <Image
                      src={selectedCampaign.mediaUrl}
                      alt="Imagen de campaña"
                      width={1280}
                      height={720}
                      unoptimized
                      className="max-h-72 w-full rounded-[20px] object-cover"
                    />
                  </div>
                ) : null}

                {selectedCampaign.notes ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Notas
                    </div>
                    <p className="mt-2 whitespace-pre-wrap">
                      {selectedCampaign.notes}
                    </p>
                  </div>
                ) : null}

                {(() => {
                  const failedRecipients = selectedCampaign.recipients.filter(
                    (recipient) => String(recipient.status ?? "").toLowerCase() === "failed",
                  );
                  if (
                    !failedRecipients.length ||
                    !isTerminalCampaignStatus(selectedCampaign.status)
                  ) {
                    return null;
                  }

                  return (
                    <details className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-50">
                      <summary className="cursor-pointer text-sm font-semibold">
                        Completada con incidencias: {failedRecipients.length} número(s) fallido(s)
                      </summary>
                      <div className="mt-3 grid gap-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-cyan-200/60 px-3 py-1 font-semibold uppercase tracking-[0.16em] text-cyan-50 transition hover:bg-cyan-200/10"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              downloadRecipientsCsv([selectedCampaign], "failed");
                            }}
                          >
                            CSV fallidos
                          </button>
                        </div>
                        <div className="ui-scrollbar grid max-h-56 gap-2 overflow-y-auto pr-1">
                          {failedRecipients.slice(0, 80).map((recipient) => (
                            <div
                              key={recipient.id}
                              className="rounded-xl border border-cyan-100/25 bg-slate-950/35 px-3 py-2 text-xs text-cyan-50/90"
                            >
                              <div className="font-semibold text-cyan-50">
                                {recipient.contactName || "Sin nombre"}
                              </div>
                              <div className="mt-0.5">
                                {recipient.contactValue} ·{" "}
                                {formatDateTime(recipient.sentAt || recipient.attemptedAt)}
                              </div>
                              <div className="mt-1 text-cyan-100/85">
                                {recipient.lastError || "Sin detalle de error."}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  );
                })()}
              </article>

              <article className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Reporte operativo
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-white">
                      Destinatarios
                    </h3>
                  </div>
                  <div className="text-xs text-slate-400">
                    {selectedCampaign.recipients.length} registro(s)
                  </div>
                </div>

                <div className="mt-4 ui-campaign-table-shell">
                  <table className="ui-campaign-table">
                    <thead>
                      <tr>
                        <th>Contacto</th>
                        <th>Estado del envío</th>
                        <th>Programado para</th>
                        <th>Último intento</th>
                        <th>Detalle operativo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCampaign.recipients.slice(0, 60).map((recipient) => (
                        <tr key={recipient.id}>
                          <td className="ui-campaign-table__contact">
                            <div className="ui-campaign-table__title">
                              {recipient.contactName || "Sin nombre"}
                            </div>
                            <div className="ui-campaign-table__meta">
                              {recipient.contactValue}
                            </div>
                            <div className="ui-campaign-table__meta">
                              {recipient.resolvedMessage
                                ? `Mensaje: ${recipient.resolvedMessage.slice(0, 84)}${recipient.resolvedMessage.length > 84 ? "…" : ""}`
                                : "Sin preview del mensaje"}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(recipient.status)}`}
                            >
                              {recipientStatusLabel(recipient.status)}
                            </span>
                          </td>
                          <td className="ui-campaign-table__time">
                            {formatDateTime(recipient.scheduledFor)}
                          </td>
                          <td className="ui-campaign-table__time">
                            {formatDateTime(recipient.sentAt || recipient.attemptedAt)}
                          </td>
                          <td className="ui-campaign-table__error">
                            {recipient.lastError ||
                              (String(recipient.status ?? "").trim().toLowerCase() === "failed"
                                ? "Sin detalle de error devuelto por el runner."
                                : "Sin incidencias registradas.")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/25 p-6 text-sm text-slate-300">
              Selecciona una campaña para ver su detalle operativo.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
