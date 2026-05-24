document.addEventListener("DOMContentLoaded", () => {
  const APP_BASE_URL = "https://recalc.relead.com.mx";
  const EXTENSION_SESSION_TOKEN_HEADER = "x-extension-session-token";
  const EXTENSION_SESSION_TOKEN_KEY = "recalc.extensionSessionToken";
  const ACTIVE_TAB_KEY = "recalc.extensionActiveTab";
  const RUNNER_POLL_MS = 3000;
  const CAMPAIGN_POLL_MS = 15000;
  const TEMPLATE_LIBRARY_KEY = "recalc.campaignTemplateLibrary";
  const RESULTS_URL = "https://recalc.relead.com.mx/unidep/web";
  const PHONE_HEADER_ALIASES = [
    "numero",
    "numero_telefono",
    "numero_de_telefono",
    "nro",
    "nro_telefono",
    "cel",
    "celular",
    "movil",
    "telefono",
    "phone",
    "phone_number",
    "whatsapp",
    "wa",
  ];
  const NAME_HEADER_ALIASES = [
    "nombre",
    "nombre_completo",
    "full_name",
    "contacto",
    "contact_name",
    "name",
  ];

  const refs = {
    appView: document.getElementById("app-view"),
    tabButtons: Array.from(document.querySelectorAll("[data-tab-target]")),
    tabPanels: Array.from(document.querySelectorAll(".tab-panel")),
    campaignApiPill: document.getElementById("campaign-api-pill"),
    campaignForm: document.getElementById("campaign-form"),
    campaignFeedback: document.getElementById("campaign-feedback"),
    campaignName: document.getElementById("campaign-name"),
    campaignSchedule: document.getElementById("campaign-schedule"),
    campaignBatchSize: document.getElementById("campaign-batch-size"),
    campaignDelaySeconds: document.getElementById("campaign-delay-seconds"),
    campaignBatchDelaySeconds: document.getElementById("campaign-batch-delay-seconds"),
    campaignJitterSeconds: document.getElementById("campaign-jitter-seconds"),
    campaignCurrentTime: document.getElementById("campaign-current-time"),
    campaignStartNow: document.getElementById("campaign-start-now"),
    campaignCsv: document.getElementById("campaign-csv"),
    campaignRecipients: document.getElementById("campaign-recipients"),
    campaignRecipientCount: document.getElementById("campaign-recipient-count"),
    campaignRecipientSummary: document.getElementById("campaign-recipient-summary"),
    campaignTemplate: document.getElementById("campaign-template"),
    campaignTemplateLibrary: document.getElementById("campaign-template-library"),
    campaignTemplateSave: document.getElementById("campaign-template-save"),
    campaignTemplateDelete: document.getElementById("campaign-template-delete"),
    campaignImage: document.getElementById("campaign-image"),
    campaignImageClear: document.getElementById("campaign-image-clear"),
    campaignImageFeedback: document.getElementById("campaign-image-feedback"),
    campaignImageEmpty: document.getElementById("campaign-image-empty"),
    campaignImagePreviewWrap: document.getElementById("campaign-image-preview-wrap"),
    campaignImagePreview: document.getElementById("campaign-image-preview"),
    campaignImageMeta: document.getElementById("campaign-image-meta"),
    campaignNotes: document.getElementById("campaign-notes"),
    campaignReset: document.getElementById("campaign-reset"),
    campaignSubmit: document.getElementById("campaign-submit"),
    campaignRefreshList: document.getElementById("campaign-refresh-list"),
    campaignToggleList: document.getElementById("campaign-toggle-list"),
    campaignStartSelected: document.getElementById("campaign-start-selected"),
    campaignStopRunner: document.getElementById("campaign-stop-runner"),
    campaignRunSelected: document.getElementById("campaign-run-selected"),
    campaignPauseSelected: document.getElementById("campaign-pause-selected"),
    campaignDeleteSelected: document.getElementById("campaign-delete-selected"),
    campaignToggleDetail: document.getElementById("campaign-toggle-detail"),
    campaignDownloadResults: document.getElementById("campaign-download-results"),
    runnerStatusTitle: document.getElementById("runner-status-title"),
    runnerStatusCopy: document.getElementById("runner-status-copy"),
    summaryCampaigns: document.getElementById("summary-campaigns"),
    summaryRecipients: document.getElementById("summary-recipients"),
    summarySent: document.getElementById("summary-sent"),
    summaryFailed: document.getElementById("summary-failed"),
    campaignList: document.getElementById("campaign-list"),
    campaignListEmpty: document.getElementById("campaign-list-empty"),
    campaignDetail: document.getElementById("campaign-detail"),
    campaignDetailEmpty: document.getElementById("campaign-detail-empty"),
    campaignDetailTitle: document.getElementById("campaign-detail-title"),
    campaignDetailStatus: document.getElementById("campaign-detail-status"),
    detailTotal: document.getElementById("detail-total"),
    detailQueued: document.getElementById("detail-queued"),
    detailScheduled: document.getElementById("detail-scheduled"),
    detailClaimed: document.getElementById("detail-claimed"),
    detailSent: document.getElementById("detail-sent"),
    detailFailed: document.getElementById("detail-failed"),
    campaignDetailTemplate: document.getElementById("campaign-detail-template"),
    campaignDetailSchedule: document.getElementById("campaign-detail-schedule"),
    campaignDetailDelay: document.getElementById("campaign-detail-delay"),
    campaignDetailUpdated: document.getElementById("campaign-detail-updated"),
    campaignDetailMediaWrap: document.getElementById("campaign-detail-media-wrap"),
    campaignDetailMedia: document.getElementById("campaign-detail-media"),
    campaignDetailRecipients: document.getElementById("campaign-detail-recipients"),
  };

  const state = {
    token: "",
    bootstrap: null,
    campaigns: [],
    selectedCampaignId: null,
    runner: null,
    loadingCampaigns: false,
    templateLibrary: [],
    uploadedAsset: null,
    recipientDraft: createEmptyRecipientDraft(),
    autoStartInFlight: false,
    listExpanded: false,
    detailExpanded: false,
    timeTickerId: null,
  };

  const DEFAULT_TEMPLATE = [
    "Hola {{nombre}}, te comparto la información que acordamos.",
    "",
    "Si gustas, te ayudo a seguir con el proceso.",
  ].join("\n");

  function createEmptyRecipientDraft() {
    return {
      recipients: [],
      totalRows: 0,
      validCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
    };
  }

  function canUseChromeStorage() {
    return Boolean(chrome?.storage?.local);
  }

  function canUseLocalStorage() {
    try {
      return typeof window !== "undefined" && Boolean(window.localStorage);
    } catch {
      return false;
    }
  }


  function normalizeCampaignStatus(status) {
    return String(status ?? "").trim().toLowerCase();
  }

  function hasActiveRunner() {
    return Boolean(
      state.runner?.enabled &&
      !["paused", "stopped", "completed"].includes(normalizeCampaignStatus(state.runner?.status)),
    );
  }


  function campaignScheduledAtMs(campaign) {
    const ts = campaign?.scheduleAt ? new Date(campaign.scheduleAt).getTime() : NaN;
    return Number.isFinite(ts) ? ts : 0;
  }

  function isCampaignReadyForAutoStart(campaign, now = Date.now()) {
    const status = normalizeCampaignStatus(campaign?.status);
    if (!["queued", "scheduled", "waiting_runner", "processing"].includes(status)) return false;
    const scheduledAt = campaignScheduledAtMs(campaign);
    return !scheduledAt || scheduledAt <= now + 5000;
  }

  function toDatetimeLocalValue(date = new Date()) {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  function updateCampaignClock() {
    const now = new Date();
    if (refs.campaignCurrentTime) {
      refs.campaignCurrentTime.textContent = `Hora actual: ${now.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}`;
    }
    if (refs.campaignSchedule) {
      refs.campaignSchedule.min = toDatetimeLocalValue(now);
    }
  }

  function normalizeDelaySeconds(input, fallback, { min = 0, max = 1800 } = {}) {
    const parsed = Number(input);
    const value = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(max, Math.max(min, value));
  }

  function getCampaignAutomationSettings() {
    const messageDelaySeconds = normalizeDelaySeconds(refs.campaignDelaySeconds?.value, 4, { min: 1, max: 120 });
    const batchDelaySeconds = normalizeDelaySeconds(refs.campaignBatchDelaySeconds?.value, 30, { min: 0, max: 1800 });
    const jitterSeconds = normalizeDelaySeconds(refs.campaignJitterSeconds?.value, 3, { min: 0, max: 60 });
    return {
      messageDelayMs: Math.round(messageDelaySeconds * 1000),
      batchDelayMs: Math.round(batchDelaySeconds * 1000),
      jitterMs: Math.round(jitterSeconds * 1000),
    };
  }

  function pickAutoResumeCandidate(previousCampaigns, nextCampaigns) {
    if (state.autoStartInFlight) return null;
    if (hasActiveRunner()) return null;

    const previousStatusById = new Map(
      (previousCampaigns || []).map((campaign) => [campaign.id, normalizeCampaignStatus(campaign.status)]),
    );
    const preferredCampaignId = state.runner?.campaignId ?? state.selectedCampaignId ?? null;
    const previousTriggerStatuses = new Set(["paused", "waiting_runner", "scheduled", "queued", "processing"]);
    const now = Date.now();

    const candidates = (nextCampaigns || []).filter((campaign) => {
      const previousStatus = previousStatusById.get(campaign?.id) ?? "";
      if (!campaign?.id || !isCampaignReadyForAutoStart(campaign, now)) return false;
      if (previousStatus && !previousTriggerStatuses.has(previousStatus)) return false;
      if (normalizeCampaignStatus(campaign?.channel) === "manual_review") return false;
      if (normalizeCampaignStatus(campaign?.channel) === "test_mode") return false;
      return true;
    });

    if (!candidates.length) return null;
    return (
      candidates.find((campaign) => campaign.id === preferredCampaignId) ??
      candidates[0]
    );
  }

  async function maybeAutoResumeCampaign(previousCampaigns, nextCampaigns) {
    const candidate = pickAutoResumeCandidate(previousCampaigns, nextCampaigns);
    if (!candidate?.id) return;

    state.autoStartInFlight = true;
    try {
      await startRunner(candidate.id);
      await loadCampaigns({ silent: true });
      setFeedback(
        "success",
        `La campaña "${candidate.campaignName || "seleccionada"}" retomó la ejecución automáticamente desde la extensión.`,
      );
    } catch (error) {
      setFeedback(
        "danger",
        error instanceof Error
          ? error.message
          : "La campaña se reanudó desde la web, pero no fue posible retomar el runner en la extensión.",
      );
    } finally {
      state.autoStartInFlight = false;
    }
  }

  function activateTab(targetId) {
    const nextTarget = String(targetId ?? "").trim();
    if (!nextTarget) return;

    refs.tabButtons.forEach((button) => {
      const active = button.dataset.tabTarget === nextTarget;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    refs.tabPanels.forEach((panel) => {
      const active = panel.id === nextTarget;
      panel.classList.toggle("hidden", !active);
      panel.classList.toggle("is-active", active);
    });

    if (canUseLocalStorage()) {
      window.localStorage.setItem(ACTIVE_TAB_KEY, nextTarget);
    }
  }

  function normalizeSessionToken(value) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return "";
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }

  async function getStoredSessionToken() {
    if (canUseChromeStorage()) {
      const data = await chrome.storage.local.get([EXTENSION_SESSION_TOKEN_KEY]);
      return normalizeSessionToken(data?.[EXTENSION_SESSION_TOKEN_KEY] ?? "");
    }
    return normalizeSessionToken(window.localStorage.getItem(EXTENSION_SESSION_TOKEN_KEY) ?? "");
  }

  async function getStoredTemplateLibrary() {
    if (canUseChromeStorage()) {
      const data = await chrome.storage.local.get([TEMPLATE_LIBRARY_KEY]);
      return Array.isArray(data?.[TEMPLATE_LIBRARY_KEY]) ? data[TEMPLATE_LIBRARY_KEY] : [];
    }
    try {
      return JSON.parse(window.localStorage.getItem(TEMPLATE_LIBRARY_KEY) || "[]");
    } catch {
      return [];
    }
  }

  async function setStoredTemplateLibrary(nextValue) {
    state.templateLibrary = Array.isArray(nextValue) ? nextValue : [];
    if (canUseChromeStorage()) {
      await chrome.storage.local.set({ [TEMPLATE_LIBRARY_KEY]: state.templateLibrary });
      return;
    }
    window.localStorage.setItem(TEMPLATE_LIBRARY_KEY, JSON.stringify(state.templateLibrary));
  }

  function renderTemplateLibrary() {
    if (!refs.campaignTemplateLibrary) return;
    const currentValue = refs.campaignTemplateLibrary.value;
    refs.campaignTemplateLibrary.innerHTML = '<option value="">Templates guardados</option>';
    state.templateLibrary.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.name;
      refs.campaignTemplateLibrary.appendChild(option);
    });
    if (currentValue && state.templateLibrary.some((entry) => entry.id === currentValue)) {
      refs.campaignTemplateLibrary.value = currentValue;
    }
  }

  async function initializeTemplateLibrary() {
    state.templateLibrary = await getStoredTemplateLibrary();
    renderTemplateLibrary();
  }

  async function saveCurrentTemplate() {
    const body = normalizeMultilineText(refs.campaignTemplate?.value);
    if (!body) {
      throw new Error("Escribe un template antes de guardarlo.");
    }
    const name = window.prompt("Nombre del template", `Template ${state.templateLibrary.length + 1}`);
    if (!name) return;
    const next = [
      { id: `tpl_${Date.now()}`, name: normalizeText(name), body },
      ...state.templateLibrary.filter((entry) => entry.body !== body),
    ].slice(0, 25);
    await setStoredTemplateLibrary(next);
    renderTemplateLibrary();
    refs.campaignTemplateLibrary.value = next[0]?.id || "";
  }

  async function deleteSelectedTemplate() {
    const selectedId = String(refs.campaignTemplateLibrary?.value || "").trim();
    if (!selectedId) {
      throw new Error("Selecciona un template guardado para borrarlo.");
    }
    const next = state.templateLibrary.filter((entry) => entry.id !== selectedId);
    await setStoredTemplateLibrary(next);
    renderTemplateLibrary();
  }

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function normalizeMultilineText(value) {
    return String(value ?? "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n")
      .trim();
  }

  function normalizeHeaderKey(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  function countDelimiterOccurrences(line, delimiter) {
    let quoted = false;
    let total = 0;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"') {
        if (quoted && next === '"') {
          index += 1;
          continue;
        }
        quoted = !quoted;
        continue;
      }
      if (!quoted && char === delimiter) total += 1;
    }

    return total;
  }

  function detectDelimiter(lines) {
    const sample = lines
      .map((line) => String(line ?? "").trim())
      .filter(Boolean)
      .slice(0, 8);

    if (!sample.length) return ",";

    let winner = ",";
    let winnerScore = Number.NEGATIVE_INFINITY;

    ["\t", ";", "|", ","].forEach((delimiter) => {
      const counts = sample.map((line) => countDelimiterOccurrences(line, delimiter));
      const rowsWithDelimiter = counts.filter((count) => count > 0).length;
      const totalColumns = counts.reduce((sum, count) => sum + count, 0);
      const score = rowsWithDelimiter * 100 + totalColumns;
      if (score > winnerScore) {
        winner = delimiter;
        winnerScore = score;
      }
    });

    return winner;
  }

  function splitDelimitedLine(line, delimiter) {
    const values = [];
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

      if (!quoted && char === delimiter) {
        values.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }

    values.push(current.trim());
    return values;
  }

  function readColumnByAliases(headerKeys, columns, aliases) {
    const columnIndex = headerKeys.findIndex((key) => aliases.includes(key));
    if (columnIndex < 0) return "";
    return String(columns[columnIndex] ?? "").trim();
  }

  function normalizePhoneValue(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (!/^[+\d\s().-]+$/.test(raw)) return "";
    const hasPlus = raw.startsWith("+");
    const digits = raw.replace(/\D+/g, "");
    if (!digits) return "";
    return hasPlus ? `+${digits}` : digits;
  }

  function isValidWhatsAppNumber(value) {
    const digits = String(value ?? "").replace(/\D+/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }

  function resolveRecipientFromColumns(columns, headerKeys) {
    if (!columns.length) return null;

    if (headerKeys?.length) {
      const contactName =
        readColumnByAliases(headerKeys, columns, NAME_HEADER_ALIASES) || columns[0] || null;
      const contactValue =
        readColumnByAliases(headerKeys, columns, PHONE_HEADER_ALIASES) ||
        columns[columns.length - 1] ||
        "";

      return {
        contactName: normalizeText(contactName) || null,
        contactValue,
      };
    }

    if (columns.length === 1) {
      return {
        contactName: null,
        contactValue: columns[0],
      };
    }

    return {
      contactName: normalizeText(columns[0]) || null,
      contactValue: columns[columns.length - 1],
    };
  }

  function parseRecipientDraft(value) {
    const lines = String(value ?? "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return createEmptyRecipientDraft();
    }

    const delimiter = detectDelimiter(lines);
    const rows = lines
      .map((line) => splitDelimitedLine(line, delimiter))
      .filter((columns) => columns.some((column) => normalizeText(column)));

    if (!rows.length) {
      return createEmptyRecipientDraft();
    }

    const headerKeys = rows[0]?.map((column) => normalizeHeaderKey(column)) ?? [];
    const looksLikeHeader = headerKeys.some(
      (key) =>
        PHONE_HEADER_ALIASES.includes(key) || NAME_HEADER_ALIASES.includes(key),
    );
    const dataRows = looksLikeHeader ? rows.slice(1) : rows;

    const seen = new Set();
    const recipients = [];
    let duplicateCount = 0;
    let invalidCount = 0;

    dataRows.forEach((columns) => {
      const resolved = resolveRecipientFromColumns(columns, looksLikeHeader ? headerKeys : null);
      const contactValue = normalizePhoneValue(resolved?.contactValue);
      if (!contactValue || !isValidWhatsAppNumber(contactValue)) {
        invalidCount += 1;
        return;
      }
      if (seen.has(contactValue)) {
        duplicateCount += 1;
        return;
      }
      seen.add(contactValue);
      recipients.push({
        contactName: normalizeText(resolved?.contactName) || null,
        contactValue,
      });
    });

    return {
      recipients,
      totalRows: dataRows.length,
      validCount: recipients.length,
      duplicateCount,
      invalidCount,
    };
  }

  function serializeRecipientLine(recipient) {
    if (!recipient?.contactValue) return "";
    return recipient.contactName
      ? `${normalizeText(recipient.contactName)}, ${recipient.contactValue}`
      : recipient.contactValue;
  }

  function formatRecipientSummary(stats) {
    if (!stats.totalRows) {
      return "Formato por linea: Nombre, numero o solo numero.";
    }

    const parts = [`${stats.validCount} validos`];
    if (stats.duplicateCount) parts.push(`${stats.duplicateCount} repetidos`);
    if (stats.invalidCount) parts.push(`${stats.invalidCount} invalidos`);
    return parts.join(" · ");
  }

  function refreshRecipientDraft() {
    state.recipientDraft = parseRecipientDraft(refs.campaignRecipients?.value ?? "");
    const validCount = state.recipientDraft.validCount;
    refs.campaignRecipientCount.textContent = `${validCount} contacto${validCount === 1 ? "" : "s"} valido${validCount === 1 ? "" : "s"}`;
    refs.campaignRecipientSummary.textContent = formatRecipientSummary(state.recipientDraft);
  }

  function mergeImportedRecipients(currentText, importedRecipients) {
    const currentParsed = parseRecipientDraft(currentText);
    const existingKeys = new Set(
      currentParsed.recipients.map((recipient) => String(recipient.contactValue)),
    );
    const accepted = [];
    let duplicateCount = 0;

    importedRecipients.forEach((recipient) => {
      const contactValue = String(recipient.contactValue ?? "");
      if (!contactValue) return;
      if (existingKeys.has(contactValue)) {
        duplicateCount += 1;
        return;
      }
      existingKeys.add(contactValue);
      accepted.push(recipient);
    });

    const importedText = accepted
      .map(serializeRecipientLine)
      .filter(Boolean)
      .join("\n");

    return {
      nextText: [String(currentText ?? "").trim(), importedText].filter(Boolean).join("\n"),
      addedCount: accepted.length,
      duplicateCount,
    };
  }

  function formatDateTime(value) {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString("es-MX");
    } catch {
      return "—";
    }
  }

  function formatSchedule(value) {
    return value ? formatDateTime(value) : "Inmediata";
  }

  function formatBytes(size) {
    const value = Number(size || 0);
    if (!Number.isFinite(value) || value <= 0) return "0 B";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setFeedback(kind, message) {
    if (!refs.campaignFeedback) return;
    if (!message) {
      refs.campaignFeedback.className = "feedback hidden";
      refs.campaignFeedback.textContent = "";
      return;
    }
    refs.campaignFeedback.className = `feedback ${kind}`;
    refs.campaignFeedback.textContent = message;
  }

  function setImageFeedback(kind, message) {
    if (!refs.campaignImageFeedback) return;
    if (!message) {
      refs.campaignImageFeedback.className = "feedback hidden";
      refs.campaignImageFeedback.textContent = "";
      return;
    }
    refs.campaignImageFeedback.className = `feedback ${kind}`;
    refs.campaignImageFeedback.textContent = message;
  }

  function setApiPill(kind, label) {
    if (!refs.campaignApiPill) return;
    refs.campaignApiPill.className = "pill";
    if (kind) refs.campaignApiPill.classList.add(kind);
    refs.campaignApiPill.textContent = label;
  }

  function renderUploadedAsset() {
    const asset = state.uploadedAsset;
    const hasAsset = Boolean(asset?.secureUrl);
    refs.campaignImageEmpty.classList.toggle("hidden", hasAsset);
    refs.campaignImagePreviewWrap.classList.toggle("hidden", !hasAsset);
    refs.campaignImageClear.disabled = !hasAsset;

    if (!hasAsset) {
      refs.campaignImagePreview.removeAttribute("src");
      refs.campaignImageMeta.textContent = "";
      return;
    }

    refs.campaignImagePreview.src = asset.secureUrl;
    refs.campaignImageMeta.textContent = [
      asset.originalName || "Imagen cargada",
      asset.format ? String(asset.format).toUpperCase() : "",
      asset.bytes ? formatBytes(asset.bytes) : "",
    ].filter(Boolean).join(" · ");
  }

  function clearUploadedAsset({ clearFeedback = true } = {}) {
    state.uploadedAsset = null;
    refs.campaignImage.value = "";
    renderUploadedAsset();
    if (clearFeedback) setImageFeedback("", "");
  }

  async function fetchJson(path, options = {}) {
    const headers = new Headers(options.headers ?? {});
    const token = state.token || (await getStoredSessionToken());
    state.token = token;
    if (token) {
      headers.set(EXTENSION_SESSION_TOKEN_HEADER, token);
      headers.set("Authorization", `Bearer ${token}`);
    }
    headers.set("x-extension-client", "chrome-sidepanel");
    headers.set("x-extension-version", chrome?.runtime?.getManifest?.().version || "unknown");
    const response = await fetch(`${APP_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    return { response, data };
  }

  async function fetchFormData(path, formData) {
    const headers = new Headers();
    const token = state.token || (await getStoredSessionToken());
    state.token = token;
    if (token) {
      headers.set(EXTENSION_SESSION_TOKEN_HEADER, token);
      headers.set("Authorization", `Bearer ${token}`);
    }
    headers.set("x-extension-client", "chrome-sidepanel");
    headers.set("x-extension-version", chrome?.runtime?.getManifest?.().version || "unknown");
    const response = await fetch(`${APP_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    return { response, data };
  }

  async function loadBootstrap() {
    const { response, data } = await fetchJson("/api/ext/bootstrap");
    if (!response.ok || !data?.ok) {
      state.bootstrap = null;
      throw new Error(data?.error || "No fue posible cargar el bootstrap de la extension.");
    }
    state.bootstrap = data;
    setApiPill("success", "Conectado con Scholarship");
    return data;
  }

  function summarizeCampaigns() {
    const summary = state.campaigns.reduce(
      (acc, campaign) => {
        acc.campaigns += 1;
        acc.recipients += campaign.stats?.total ?? 0;
        acc.sent += campaign.stats?.sent ?? 0;
        acc.failed += campaign.stats?.failed ?? 0;
        return acc;
      },
      { campaigns: 0, recipients: 0, sent: 0, failed: 0 },
    );

    refs.summaryCampaigns.textContent = String(summary.campaigns);
    refs.summaryRecipients.textContent = String(summary.recipients);
    refs.summarySent.textContent = String(summary.sent);
    refs.summaryFailed.textContent = String(summary.failed);
  }

  function campaignStatusClass(status) {
    const normalized = String(status ?? "queued").toLowerCase();
    return `status-chip ${normalized}`;
  }

  function getSelectedCampaign() {
    return state.campaigns.find((campaign) => campaign.id === state.selectedCampaignId) ?? null;
  }

  function ensureSelectedCampaign() {
    if (!state.selectedCampaignId && state.campaigns[0]?.id) {
      state.selectedCampaignId = state.campaigns[0].id;
      return;
    }
    if (
      state.selectedCampaignId &&
      !state.campaigns.some((campaign) => campaign.id === state.selectedCampaignId)
    ) {
      state.selectedCampaignId = state.campaigns[0]?.id ?? null;
    }
  }

  function canExecuteCampaign(campaign) {
    if (!campaign?.id) return false;
    return ["queued", "scheduled", "paused", "waiting_runner"].includes(normalizeCampaignStatus(campaign.status));
  }

  function canPauseCampaign(campaign) {
    if (!campaign?.id) return false;
    return ["queued", "scheduled", "waiting_runner", "processing", "running", "claimed"].includes(normalizeCampaignStatus(campaign.status));
  }

  function canDeleteCampaign(campaign) {
    if (!campaign?.id) return false;
    return ["paused", "completed", "sent", "failed", "cancelled", "canceled"].includes(normalizeCampaignStatus(campaign.status));
  }

  function renderCampaignActions(campaign) {
    const status = normalizeCampaignStatus(campaign?.status);
    const runLabel =
      status === "paused"
        ? "Reanudar y ejecutar"
        : "Ejecutar";
    const canRun = canExecuteCampaign(campaign);
    const canPause = canPauseCampaign(campaign);
    const canDelete = canDeleteCampaign(campaign);

    refs.campaignRunSelected.textContent = runLabel;
    refs.campaignRunSelected.disabled = !canRun;
    refs.campaignPauseSelected.disabled = !canPause;
    refs.campaignDeleteSelected.disabled = !canDelete;
    refs.campaignRunSelected.classList.toggle("hidden", !canRun);
    refs.campaignPauseSelected.classList.toggle("hidden", !canPause);
    refs.campaignDeleteSelected.classList.toggle("hidden", !canDelete);
    refs.campaignStartSelected.disabled = !campaign?.id;
    refs.campaignStartSelected.classList.add("hidden");
    refs.campaignStopRunner.disabled = !campaign?.id && !state.runner?.campaignId;
  }

  function getCampaignMetaNumber(campaign, key, fallback = 0) {
    const parsed = Number(campaign?.meta?.[key]);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatCampaignDelaySummary(campaign) {
    const messageDelay = Math.round((campaign?.messageDelayMs ?? 0) / 10) / 100;
    const batchDelay = Math.round(getCampaignMetaNumber(campaign, "batchDelayMs", 0) / 10) / 100;
    const jitter = Math.round(getCampaignMetaNumber(campaign, "jitterMs", 0) / 10) / 100;
    return [`Delay msg: ${messageDelay}s`, batchDelay ? `Delay reclamo: ${batchDelay}s` : "", jitter ? `Variación: ±${jitter}s` : ""].filter(Boolean).join(" · ");
  }

  function renderCampaignList() {
    const hasCampaigns = state.campaigns.length > 0;
    refs.campaignList.classList.toggle("hidden", !hasCampaigns);
    refs.campaignListEmpty.classList.toggle("hidden", hasCampaigns);

    if (!hasCampaigns) {
      refs.campaignList.replaceChildren();
      renderCampaignDetail(null);
      summarizeCampaigns();
      return;
    }

    ensureSelectedCampaign();

    const listCard = refs.campaignList?.closest(".report-list-card");
    listCard?.classList.toggle("is-collapsed", !state.listExpanded);
    if (refs.campaignToggleList) {
      refs.campaignToggleList.textContent = state.listExpanded ? "Ocultar historial" : "Mostrar historial";
    }

    const fragment = document.createDocumentFragment();
    state.campaigns.forEach((campaign, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `campaign-item${campaign.id === state.selectedCampaignId ? " is-selected" : ""}`;
      button.innerHTML = `
        <div class="campaign-item__head">
          <div>
            ${index === 0 ? '<div class="campaign-item__latest">Última campaña</div>' : ""}
            <strong>${escapeHtml(campaign.campaignName)}</strong>
            <div class="campaign-item__meta">${campaign.stats?.total ?? 0} destinatarios · batch ${campaign.batchSize}</div>
          </div>
          <span class="${campaignStatusClass(campaign.status)}">${escapeHtml(campaign.status)}</span>
        </div>
        <div class="campaign-item__summary">
          <div>Programacion: ${escapeHtml(formatSchedule(campaign.scheduleAt))}</div>
          <div>${formatCampaignDelaySummary(campaign)} · Imagen: ${campaign.mediaUrl ? "Si" : "No"} · Enviados: ${campaign.stats?.sent ?? 0} · Fallidos: ${campaign.stats?.failed ?? 0}</div>
        </div>
      `;
      button.addEventListener("click", () => {
        state.selectedCampaignId = campaign.id;
        renderCampaignList();
      });
      fragment.appendChild(button);
    });

    refs.campaignList.replaceChildren(fragment);
    renderCampaignDetail(getSelectedCampaign());
    summarizeCampaigns();
  }

  function renderCampaignDetail(campaign) {
    const hasCampaign = Boolean(campaign);
    refs.campaignDetail.classList.toggle("hidden", !hasCampaign);
    refs.campaignDetailEmpty.classList.toggle("hidden", hasCampaign);
    refs.campaignDetail?.closest(".report-detail-card")?.classList.toggle("is-collapsed", !state.detailExpanded);
    if (refs.campaignToggleDetail) refs.campaignToggleDetail.textContent = state.detailExpanded ? "Ocultar detalle completo" : "Mostrar detalle completo";
    renderCampaignActions(campaign);

    if (!campaign) {
      refs.campaignDetailRecipients.replaceChildren();
      return;
    }

    refs.campaignDetailTitle.textContent = campaign.campaignName;
    refs.campaignDetailStatus.className = campaignStatusClass(campaign.status);
    refs.campaignDetailStatus.textContent = campaign.status;
    refs.detailTotal.textContent = String(campaign.stats?.total ?? 0);
    refs.detailQueued.textContent = String(campaign.stats?.queued ?? 0);
    refs.detailScheduled.textContent = String(campaign.stats?.scheduled ?? 0);
    refs.detailClaimed.textContent = String(campaign.stats?.claimed ?? 0);
    refs.detailSent.textContent = String(campaign.stats?.sent ?? 0);
    refs.detailFailed.textContent = String(campaign.stats?.failed ?? 0);
    refs.campaignDetailTemplate.textContent = campaign.messageTemplate || "Sin template.";
    refs.campaignDetail?.querySelectorAll(".stats-grid--detail, .detail-grid--report, .media-detail, .recipients-panel").forEach((node) => node.classList.add("detail-collapsible"));
    refs.campaignDetailSchedule.textContent = formatSchedule(campaign.scheduleAt);
    refs.campaignDetailDelay.textContent = `${formatCampaignDelaySummary(campaign)} · Imagen: ${campaign.mediaUrl ? "cargada" : "sin imagen"}`;
    refs.campaignDetailUpdated.textContent = `Actualizada: ${formatDateTime(campaign.updatedAt)}`;

    if (campaign.mediaUrl) {
      refs.campaignDetailMediaWrap.classList.remove("hidden");
      refs.campaignDetailMedia.src = campaign.mediaUrl;
    } else {
      refs.campaignDetailMediaWrap.classList.add("hidden");
      refs.campaignDetailMedia.removeAttribute("src");
    }

    const fragment = document.createDocumentFragment();
    (campaign.recipients ?? []).slice(0, 120).forEach((recipient) => {
      const row = document.createElement("div");
      row.className = "recipient-row";
      row.innerHTML = `
        <div class="recipient-row__meta">
          <strong>${escapeHtml(recipient.contactName || "Sin nombre")}</strong>
          <div class="recipient-row__sub">${escapeHtml(recipient.contactValue || "—")}${recipient.lastError ? ` · ${escapeHtml(recipient.lastError)}` : ""}</div>
        </div>
        <span class="${campaignStatusClass(recipient.status)}">${escapeHtml(recipient.status || "queued")}</span>
        <div class="recipient-row__time">${escapeHtml(formatDateTime(recipient.sentAt || recipient.attemptedAt || recipient.scheduledFor || recipient.updatedAt))}</div>
      `;
      fragment.appendChild(row);
    });
    refs.campaignDetailRecipients.replaceChildren(fragment);
  }

  function renderRunnerStatus() {
    const runner = state.runner;
    if (!runner || !runner.enabled) {
      refs.runnerStatusTitle.textContent = "Sin ejecucion activa";
      refs.runnerStatusCopy.textContent = "Crea una campaña y ejecutala desde esta pestaña.";
      return;
    }

    const label = runner.status === "running"
      ? "Ejecutando campaña"
      : runner.status === "completed"
        ? "Campaña completada"
        : runner.status === "paused"
          ? "Campaña en pausa"
          : runner.status === "stopped"
            ? "Runner detenido"
            : "Runner en espera";

    refs.runnerStatusTitle.textContent = `${label}: ${runner.campaignName || runner.campaignId || "campaña"}`;
    refs.runnerStatusCopy.textContent = runner.lastMessage || "La automatizacion esta operando.";
  }

  async function loadCampaigns({ silent = false } = {}) {
    if (state.loadingCampaigns) return;
    state.loadingCampaigns = true;
    const previousCampaigns = Array.isArray(state.campaigns) ? [...state.campaigns] : [];
    try {
      const { response, data } = await fetchJson("/api/ext/campaigns");
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "No fue posible cargar campañas.");
      }
      state.campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
      renderCampaignList();
      if (!silent) setFeedback("", "");
      void maybeAutoResumeCampaign(previousCampaigns, state.campaigns);
    } catch (error) {
      if (!silent) {
        setFeedback("danger", error instanceof Error ? error.message : "No fue posible cargar campañas.");
      }
    } finally {
      state.loadingCampaigns = false;
    }
  }

  async function updateCampaignAction(campaignId, action) {
    const { response, data } = await fetchJson(`/api/ext/campaigns/${encodeURIComponent(campaignId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok || !data?.ok || !data?.campaign) {
      throw new Error(data?.error || "No fue posible actualizar la campaña.");
    }
    return data.campaign;
  }

  async function deleteCampaignRecord(campaignId) {
    const { response, data } = await fetchJson(`/api/ext/campaigns/${encodeURIComponent(campaignId)}`, {
      method: "DELETE",
    });
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "No fue posible eliminar la campaña.");
    }
    return data;
  }

  async function sendRuntimeMessage(payload, fallbackMessage) {
    if (!chrome?.runtime?.sendMessage) {
      throw new Error("La ejecucion automatica solo esta disponible dentro de la extension instalada.");
    }
    const response = await chrome.runtime.sendMessage(payload);
    if (!response?.ok) {
      throw new Error(response?.error || fallbackMessage);
    }
    return response;
  }

  async function loadRunnerStatus() {
    if (!chrome?.runtime?.sendMessage) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_CAMPAIGN_STATUS",
        campaignId: state.selectedCampaignId ?? null,
      });
      if (response?.ok) {
        state.runner = response.runner ?? null;
        renderRunnerStatus();
        renderCampaignActions(getSelectedCampaign());
      }
    } catch {
      // Ignore runtime polling failures.
    }
  }

  async function startRunner(campaignId) {
    await sendRuntimeMessage(
      {
        type: "START_CAMPAIGN",
        campaignId,
        appBaseUrl: APP_BASE_URL,
        extensionSessionToken: state.token,
        selectorPack: state.bootstrap?.selectorPack ?? null,
      },
      "No fue posible iniciar el runner.",
    );
    await loadRunnerStatus();
  }

  async function stopLocalRunner() {
    await sendRuntimeMessage(
      {
        type: "STOP_CAMPAIGN",
        campaignId: state.runner?.campaignId ?? state.selectedCampaignId ?? null,
        runId: state.runner?.runId ?? null,
      },
      "No fue posible detener el runner.",
    );
    await loadRunnerStatus();
  }

  async function pauseLocalRunner() {
    await sendRuntimeMessage(
      {
        type: "PAUSE_CAMPAIGN",
        campaignId: state.runner?.campaignId ?? state.selectedCampaignId ?? null,
        runId: state.runner?.runId ?? null,
      },
      "No fue posible pausar el runner.",
    );
    await loadRunnerStatus();
  }

  async function startSelectedCampaign(campaignId = state.selectedCampaignId) {
    const campaign = state.campaigns.find((item) => item.id === campaignId) ?? null;
    if (!campaign?.id) {
      throw new Error("Selecciona una campaña para ejecutarla.");
    }

    if (!canExecuteCampaign(campaign)) {
      throw new Error("La campaña seleccionada no se puede ejecutar en su estado actual.");
    }

    if (String(campaign.status).toLowerCase() === "paused") {
      await updateCampaignAction(campaign.id, "resume");
      await loadCampaigns({ silent: true });
    }

    await startRunner(campaign.id);
    await loadCampaigns({ silent: true });
  }

  async function forcePauseCampaign(campaignId = state.runner?.campaignId ?? state.selectedCampaignId) {
    const targetCampaignId = String(campaignId ?? "").trim();
    if (!targetCampaignId) {
      throw new Error("Selecciona una campaña para pausarla.");
    }

    let localRunnerError = null;
    if (state.runner?.enabled && state.runner?.campaignId === targetCampaignId) {
      try {
        await stopLocalRunner();
      } catch (error) {
        localRunnerError = error instanceof Error ? error.message : "No fue posible detener el runner local.";
      }
    }

    await updateCampaignAction(targetCampaignId, "force_pause");
    await loadCampaigns({ silent: true });
    await loadRunnerStatus();
    return { localRunnerError };
  }

  async function deleteSelectedCampaign(campaignId = state.selectedCampaignId) {
    const campaign = state.campaigns.find((item) => item.id === campaignId) ?? null;
    if (!campaign?.id) {
      throw new Error("Selecciona una campaña para eliminarla.");
    }

    if (!canDeleteCampaign(campaign)) {
      throw new Error("Solo puedes eliminar campañas pausadas o completadas.");
    }

    if (!window.confirm(`Se eliminara la campaña "${campaign.campaignName}".`)) {
      return;
    }

    await deleteCampaignRecord(campaign.id);
    state.selectedCampaignId = null;
    await loadCampaigns({ silent: true });
    await loadRunnerStatus();
  }

  function ensureCampaignPayloadAllowed() {
    const message = normalizeMultilineText(refs.campaignTemplate?.value);
    const hasMessage = Boolean(message);
    const hasImage = Boolean(state.uploadedAsset?.secureUrl);

    if (!state.recipientDraft.validCount) {
      throw new Error("Agrega al menos un destinatario valido antes de crear la campaña.");
    }

    if (!hasMessage && !hasImage) {
      throw new Error("Debes escribir un mensaje o subir una imagen antes de crear la campaña.");
    }
  }

  async function handleCsvImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedDraft = parseRecipientDraft(text);
      if (!importedDraft.validCount) {
        throw new Error("El archivo importado no contiene numeros validos para WhatsApp.");
      }

      const merge = mergeImportedRecipients(refs.campaignRecipients.value, importedDraft.recipients);
      refs.campaignRecipients.value = merge.nextText;
      refreshRecipientDraft();

      const notes = [
        `CSV importado: ${file.name}.`,
        `${merge.addedCount} destinatario${merge.addedCount === 1 ? "" : "s"} agregado${merge.addedCount === 1 ? "" : "s"}.`,
      ];
      const skipped = merge.duplicateCount + importedDraft.duplicateCount;
      if (skipped) {
        notes.push(`${skipped} repetido${skipped === 1 ? "" : "s"} omitido${skipped === 1 ? "" : "s"}.`);
      }
      if (importedDraft.invalidCount) {
        notes.push(`${importedDraft.invalidCount} fila${importedDraft.invalidCount === 1 ? "" : "s"} invalida${importedDraft.invalidCount === 1 ? "" : "s"}.`);
      }
      setFeedback(importedDraft.invalidCount ? "warning" : "success", notes.join(" "));
    } catch (error) {
      setFeedback("danger", error instanceof Error ? error.message : "No fue posible leer el CSV.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleImageSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!String(file.type || "").toLowerCase().startsWith("image/")) {
      setImageFeedback("danger", "Solo puedes subir imagenes para campañas de WhatsApp.");
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    try {
      const { response, data } = await fetchFormData("/api/ext/campaigns/upload", formData);
      if (!response.ok || !data?.ok || !data?.asset?.secureUrl) {
        throw new Error(data?.error || "No fue posible subir la imagen.");
      }

      state.uploadedAsset = {
        secureUrl: data.asset.secureUrl,
        publicId: data.asset.publicId ?? null,
        bytes: data.asset.bytes ?? null,
        format: data.asset.format ?? null,
        resourceType: data.asset.resourceType ?? null,
        originalName: file.name,
      };
      renderUploadedAsset();
      setImageFeedback("success", `Imagen cargada: ${file.name}`);
    } catch (error) {
      clearUploadedAsset({ clearFeedback: false });
      setImageFeedback("danger", error instanceof Error ? error.message : "No fue posible subir la imagen.");
    } finally {
      event.target.value = "";
    }
  }

  function resetCampaignForm() {
    refs.campaignName.value = "";
    refs.campaignSchedule.value = "";
    refs.campaignBatchSize.value = "25";
    refs.campaignDelaySeconds.value = "4";
    if (refs.campaignBatchDelaySeconds) refs.campaignBatchDelaySeconds.value = "30";
    if (refs.campaignJitterSeconds) refs.campaignJitterSeconds.value = "3";
    refs.campaignStartNow.checked = true;
    updateCampaignClock();
    refs.campaignRecipients.value = "";
    refs.campaignTemplate.value = DEFAULT_TEMPLATE;
    refs.campaignNotes.value = "";
    if (refs.campaignTemplateLibrary) refs.campaignTemplateLibrary.value = "";
    clearUploadedAsset();
    refreshRecipientDraft();
    setFeedback("", "");
  }

  async function handleCampaignSubmit(event) {
    event.preventDefault();
    refs.campaignSubmit.disabled = true;
    setFeedback("", "");

    try {
      state.token = await getStoredSessionToken();
      if (!state.token) {
        throw new Error("Inicia sesion en la extension antes de crear campañas.");
      }
      if (!state.bootstrap) {
        await loadBootstrap();
      }

      refreshRecipientDraft();
      ensureCampaignPayloadAllowed();

      const automationSettings = getCampaignAutomationSettings();

      const payload = {
        campaignName: normalizeText(refs.campaignName.value) || "Campaña extensión",
        notes: normalizeMultilineText(refs.campaignNotes.value) || null,
        recipients: state.recipientDraft.recipients.map((recipient) => ({
          contactName: recipient.contactName,
          contactValue: recipient.contactValue,
        })),
        recipientsText: "",
        scheduleAt: refs.campaignSchedule.value || null,
        batchSize: Math.min(200, Math.max(1, Number(refs.campaignBatchSize.value) || 25)),
        messageTemplate: normalizeMultilineText(refs.campaignTemplate.value) || "",
        messageDelayMs: automationSettings.messageDelayMs,
        mediaUrl: state.uploadedAsset?.secureUrl || null,
        meta: {
          source: "chrome_side_panel_campaigns",
          extensionVersion: chrome?.runtime?.getManifest?.().version || "unknown",
          batchDelayMs: automationSettings.batchDelayMs,
          jitterMs: automationSettings.jitterMs,
          scheduleTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City",
          mediaPublicId: state.uploadedAsset?.publicId ?? null,
          mediaBytes: state.uploadedAsset?.bytes ?? null,
          mediaFormat: state.uploadedAsset?.format ?? null,
          importSummary: {
            totalRows: state.recipientDraft.totalRows,
            validCount: state.recipientDraft.validCount,
            duplicateCount: state.recipientDraft.duplicateCount,
            invalidCount: state.recipientDraft.invalidCount,
          },
        },
      };

      const { response, data } = await fetchJson("/api/ext/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !data?.ok || !data?.campaign?.id) {
        throw new Error(data?.error || "No fue posible crear la campaña.");
      }

      state.selectedCampaignId = data.campaign.id;
      await loadCampaigns({ silent: true });

      const pieces = [
        "Campaña creada correctamente.",
        `${state.recipientDraft.validCount} destinatario${state.recipientDraft.validCount === 1 ? "" : "s"} listo${state.recipientDraft.validCount === 1 ? "" : "s"} para enviar.`,
      ];
      if (state.recipientDraft.duplicateCount) {
        pieces.push(`${state.recipientDraft.duplicateCount} repetido${state.recipientDraft.duplicateCount === 1 ? "" : "s"} se omitio${state.recipientDraft.duplicateCount === 1 ? "" : "eron"}.`);
      }
      if (state.recipientDraft.invalidCount) {
        pieces.push(`${state.recipientDraft.invalidCount} fila${state.recipientDraft.invalidCount === 1 ? "" : "s"} invalida${state.recipientDraft.invalidCount === 1 ? "" : "s"} se descarto${state.recipientDraft.invalidCount === 1 ? "" : "aron"}.`);
      }
      setFeedback(state.recipientDraft.invalidCount ? "warning" : "success", pieces.join(" "));

      const shouldStartNow = refs.campaignStartNow.checked;
      const wasScheduled = Boolean(refs.campaignSchedule.value);
      resetCampaignForm();
      activateTab("reports-panel");

      if (shouldStartNow) {
        await startSelectedCampaign(data.campaign.id);
        setFeedback("success", wasScheduled ? "Campaña programada y runner activado; se enviará a la hora indicada." : "Campaña creada e iniciada en el runner automático.");
      }
    } catch (error) {
      setFeedback("danger", error instanceof Error ? error.message : "No fue posible crear la campaña.");
    } finally {
      refs.campaignSubmit.disabled = false;
    }
  }

  async function initializeCampaignModule({ silent = false } = {}) {
    state.token = await getStoredSessionToken();
    if (!state.token) {
      state.bootstrap = null;
      setApiPill("warning", "Inicia sesion para campañas");
      renderRunnerStatus();
      renderCampaignActions(getSelectedCampaign());
      return;
    }

    try {
      await loadBootstrap();
      await loadCampaigns({ silent });
      await loadRunnerStatus();
    } catch (error) {
      setApiPill("danger", "Sin conexion");
      if (!silent) {
        setFeedback("danger", error instanceof Error ? error.message : "No fue posible iniciar campañas.");
      }
    }
  }

  refs.campaignRecipients.addEventListener("input", refreshRecipientDraft);
  refs.campaignCsv.addEventListener("change", (event) => void handleCsvImport(event));

  refs.campaignTemplateLibrary?.addEventListener("change", () => {
    const selectedId = String(refs.campaignTemplateLibrary.value || "").trim();
    const entry = state.templateLibrary.find((item) => item.id === selectedId);
    if (entry) refs.campaignTemplate.value = entry.body;
  });

  refs.campaignTemplateSave?.addEventListener("click", async () => {
    try {
      await saveCurrentTemplate();
      setFeedback("success", "Template guardado en la extension.");
    } catch (error) {
      setFeedback("danger", error instanceof Error ? error.message : "No fue posible guardar el template.");
    }
  });

  refs.campaignTemplateDelete?.addEventListener("click", async () => {
    try {
      await deleteSelectedTemplate();
      setFeedback("success", "Template eliminado de la biblioteca local.");
    } catch (error) {
      setFeedback("danger", error instanceof Error ? error.message : "No fue posible borrar el template.");
    }
  });

  refs.campaignImage?.addEventListener("change", (event) => void handleImageSelection(event));
  refs.campaignImageClear?.addEventListener("click", () => clearUploadedAsset());

  refs.campaignReset.addEventListener("click", resetCampaignForm);
  refs.campaignForm.addEventListener("submit", (event) => void handleCampaignSubmit(event));
  refs.campaignSchedule?.addEventListener("change", updateCampaignClock);
  refs.campaignRefreshList.addEventListener("click", () => void loadCampaigns());
  refs.campaignToggleList?.addEventListener("click", () => {
    state.listExpanded = !state.listExpanded;
    renderCampaignList();
  });
  refs.campaignToggleDetail?.addEventListener("click", () => {
    state.detailExpanded = !state.detailExpanded;
    renderCampaignDetail(getSelectedCampaign());
  });
  refs.campaignDownloadResults?.addEventListener("click", () => {
    if (chrome?.tabs?.create) chrome.tabs.create({ url: RESULTS_URL });
    else window.open(RESULTS_URL, "_blank", "noopener");
  });
  refs.campaignStartSelected.addEventListener("click", async () => {
    try {
      await startSelectedCampaign();
      setFeedback("success", "Runner iniciado para la campaña seleccionada.");
    } catch (error) {
      setFeedback("danger", error instanceof Error ? error.message : "No fue posible iniciar el runner.");
    }
  });
  refs.campaignStopRunner.addEventListener("click", async () => {
    try {
      const result = await forcePauseCampaign();
      if (result?.localRunnerError) {
        setFeedback("warning", `Campaña pausada en backend, pero el runner local reportó: ${result.localRunnerError}`);
      } else {
        setFeedback("success", "La campaña seleccionada quedo en pausa segura.");
      }
    } catch (error) {
      setFeedback("danger", error instanceof Error ? error.message : "No fue posible pausar la campaña.");
    }
  });
  refs.campaignRunSelected.addEventListener("click", async () => {
    try {
      await startSelectedCampaign();
      setFeedback("success", "Campaña preparada para ejecutarse.");
    } catch (error) {
      setFeedback("danger", error instanceof Error ? error.message : "No fue posible ejecutar la campaña.");
    }
  });
  refs.campaignPauseSelected.addEventListener("click", async () => {
    try {
      const result = await forcePauseCampaign();
      if (result?.localRunnerError) {
        setFeedback("warning", `Campaña pausada en backend, pero el runner local reportó: ${result.localRunnerError}`);
      } else {
        setFeedback("success", "La campaña fue pausada correctamente.");
      }
    } catch (error) {
      setFeedback("danger", error instanceof Error ? error.message : "No fue posible pausar la campaña.");
    }
  });
  refs.campaignDeleteSelected.addEventListener("click", async () => {
    try {
      await deleteSelectedCampaign();
      setFeedback("success", "La campaña fue eliminada.");
    } catch (error) {
      setFeedback("danger", error instanceof Error ? error.message : "No fue posible eliminar la campaña.");
    }
  });

  if (canUseChromeStorage() && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (!(EXTENSION_SESSION_TOKEN_KEY in changes)) return;
      void initializeCampaignModule({ silent: true });
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateCampaignClock();
      void initializeCampaignModule({ silent: true });
    }
  });

  window.setInterval(() => {
    if (document.hidden) return;
    if (refs.appView?.classList.contains("hidden")) return;
    void loadRunnerStatus();
  }, RUNNER_POLL_MS);

  window.setInterval(() => {
    if (document.hidden) return;
    if (refs.appView?.classList.contains("hidden")) return;
    void loadCampaigns({ silent: true });
  }, CAMPAIGN_POLL_MS);

  refs.campaignTemplate.value = DEFAULT_TEMPLATE;
  void initializeTemplateLibrary();
  refreshRecipientDraft();
  clearUploadedAsset();
  renderRunnerStatus();
  renderCampaignActions(null);
  updateCampaignClock();
  state.timeTickerId = window.setInterval(updateCampaignClock, 30_000);
  void initializeCampaignModule({ silent: true });
});
