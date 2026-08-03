document.addEventListener("DOMContentLoaded", () => {
  const analytics = window.RecalcAnonymousAnalytics;
  const attachmentStore = window.RecalcAttachmentStore;
  const CAMPAIGNS_KEY = analytics.CAMPAIGNS_KEY;
  const TEMPLATE_LIBRARY_KEY = "recalc.campaignTemplateLibrary";
  const ACTIVE_TAB_KEY = "recalc.extensionActiveTab";
  const DEFAULT_TEMPLATE = "Hola {{nombre}}, te comparto la información que acordamos.\n\nSi gustas, te ayudo a seguir con el proceso.";
  const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);

  const refs = {
    appView: document.getElementById("app-view"),
    tabButtons: Array.from(document.querySelectorAll("[data-tab-target]")),
    tabPanels: Array.from(document.querySelectorAll(".tab-panel")),
    apiPill: document.getElementById("campaign-api-pill"),
    form: document.getElementById("campaign-form"),
    feedback: document.getElementById("campaign-feedback"),
    name: document.getElementById("campaign-name"),
    schedule: document.getElementById("campaign-schedule"),
    batchSize: document.getElementById("campaign-batch-size"),
    delaySeconds: document.getElementById("campaign-delay-seconds"),
    batchDelaySeconds: document.getElementById("campaign-batch-delay-seconds"),
    jitterSeconds: document.getElementById("campaign-jitter-seconds"),
    currentTime: document.getElementById("campaign-current-time"),
    startNow: document.getElementById("campaign-start-now"),
    countryCode: document.getElementById("campaign-country-code"),
    costPerMessage: document.getElementById("campaign-cost-per-message"),
    csv: document.getElementById("campaign-csv"),
    recipients: document.getElementById("campaign-recipients"),
    recipientCount: document.getElementById("campaign-recipient-count"),
    recipientSummary: document.getElementById("campaign-recipient-summary"),
    template: document.getElementById("campaign-template"),
    templateLibrary: document.getElementById("campaign-template-library"),
    templateSave: document.getElementById("campaign-template-save"),
    templateDelete: document.getElementById("campaign-template-delete"),
    image: document.getElementById("campaign-image"),
    imageClear: document.getElementById("campaign-image-clear"),
    imageFeedback: document.getElementById("campaign-image-feedback"),
    imageEmpty: document.getElementById("campaign-image-empty"),
    imagePreviewWrap: document.getElementById("campaign-image-preview-wrap"),
    imagePreview: document.getElementById("campaign-image-preview"),
    imageMeta: document.getElementById("campaign-image-meta"),
    notes: document.getElementById("campaign-notes"),
    reset: document.getElementById("campaign-reset"),
    submit: document.getElementById("campaign-submit"),
    refresh: document.getElementById("campaign-refresh-list"),
    startSelected: document.getElementById("campaign-start-selected"),
    pauseRunner: document.getElementById("campaign-stop-runner"),
    runSelected: document.getElementById("campaign-run-selected"),
    pauseSelected: document.getElementById("campaign-pause-selected"),
    deleteSelected: document.getElementById("campaign-delete-selected"),
    exportResults: document.getElementById("campaign-download-results"),
    runnerTitle: document.getElementById("runner-status-title"),
    runnerCopy: document.getElementById("runner-status-copy"),
    summaryCampaigns: document.getElementById("summary-campaigns"),
    summaryRecipients: document.getElementById("summary-recipients"),
    summarySent: document.getElementById("summary-sent"),
    summaryFailed: document.getElementById("summary-failed"),
    list: document.getElementById("campaign-list"),
    listEmpty: document.getElementById("campaign-list-empty"),
    detail: document.getElementById("campaign-detail"),
    detailEmpty: document.getElementById("campaign-detail-empty"),
    detailTitle: document.getElementById("campaign-detail-title"),
    detailStatus: document.getElementById("campaign-detail-status"),
    detailTotal: document.getElementById("detail-total"),
    detailQueued: document.getElementById("detail-queued"),
    detailSent: document.getElementById("detail-sent"),
    detailFailed: document.getElementById("detail-failed"),
    detailTemplate: document.getElementById("campaign-detail-template"),
    detailSchedule: document.getElementById("campaign-detail-schedule"),
    detailDelay: document.getElementById("campaign-detail-delay"),
    detailUpdated: document.getElementById("campaign-detail-updated"),
    detailCost: document.getElementById("campaign-detail-cost"),
    detailMediaWrap: document.getElementById("campaign-detail-media-wrap"),
    detailMedia: document.getElementById("campaign-detail-media"),
    detailRecipients: document.getElementById("campaign-detail-recipients"),
  };

  const state = {
    campaigns: [],
    selectedCampaignId: null,
    runner: null,
    templateLibrary: [],
    recipientDraft: emptyDraft(),
    mediaDraftId: `draft_${analytics.randomUuid()}`,
    mediaMeta: null,
    previewUrl: "",
    detailPreviewUrl: "",
  };

  function emptyDraft() {
    return { recipients: [], totalRows: 0, validCount: 0, duplicateCount: 0, invalidCount: 0 };
  }

  function text(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function multiline(value) {
    return String(value ?? "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trimEnd()).join("\n").trim();
  }

  function clamp(value, fallback, min, max) {
    const parsed = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : fallback));
  }

  function statusCount(campaign, statuses) {
    const allowed = new Set(Array.isArray(statuses) ? statuses : [statuses]);
    return (campaign.recipients || []).filter((recipient) => allowed.has(recipient.status)).length;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
  }

  function setFeedback(kind = "", message = "") {
    refs.feedback.textContent = message;
    refs.feedback.className = "feedback";
    if (!message) refs.feedback.classList.add("hidden");
    if (kind === "error") refs.feedback.classList.add("feedback-error");
    if (kind === "success") refs.feedback.classList.add("success");
  }

  function setImageFeedback(kind = "", message = "") {
    refs.imageFeedback.textContent = message;
    refs.imageFeedback.className = "feedback";
    if (!message) refs.imageFeedback.classList.add("hidden");
    if (kind === "error") refs.imageFeedback.classList.add("feedback-error");
    if (kind === "success") refs.imageFeedback.classList.add("success");
  }

  function activateTab(targetId) {
    refs.tabButtons.forEach((button) => {
      const active = button.dataset.tabTarget === targetId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    refs.tabPanels.forEach((panel) => {
      const active = panel.id === targetId;
      panel.classList.toggle("hidden", !active);
      panel.classList.toggle("is-active", active);
    });
    localStorage.setItem(ACTIVE_TAB_KEY, targetId);
  }

  function normalizePhone(value, countryCode) {
    const raw = String(value ?? "").trim();
    if (!raw || !/^[+\d\s().-]+$/.test(raw)) return "";
    const explicitPlus = raw.startsWith("+");
    let digits = raw.replace(/\D+/g, "");
    if (digits.length < 10 || digits.length > 15) return "";
    if (!explicitPlus && digits.length === 10 && countryCode) digits = `${countryCode}${digits}`;
    return digits;
  }

  function parseDelimitedLine(line, delimiter) {
    const values = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted;
      } else if (!quoted && char === delimiter) {
        values.push(current.trim()); current = "";
      } else current += char;
    }
    values.push(current.trim());
    return values;
  }

  function key(value) {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
  }

  function parseRecipients(value) {
    const lines = String(value ?? "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return emptyDraft();
    const countryCode = refs.countryCode.value;
    const delimiter = ["\t", ";", "|", ","].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
    const first = parseDelimitedLine(lines[0], delimiter);
    const headerKeys = first.map(key);
    const phoneAliases = ["numero", "telefono", "celular", "movil", "phone", "whatsapp", "wa", "numero_de_telefono"];
    const nameAliases = ["nombre", "nombre_completo", "name", "contacto", "contact_name"];
    const hasHeader = headerKeys.some((item) => phoneAliases.includes(item));
    const rows = hasHeader ? lines.slice(1) : lines;
    const seen = new Set();
    const recipients = [];
    let duplicates = 0;
    let invalid = 0;

    rows.forEach((line) => {
      const columns = parseDelimitedLine(line, delimiter);
      const payload = {};
      if (hasHeader) headerKeys.forEach((header, index) => { if (header) payload[header] = columns[index] || ""; });
      const phoneIndex = hasHeader ? headerKeys.findIndex((item) => phoneAliases.includes(item)) : columns.length - 1;
      const nameIndex = hasHeader ? headerKeys.findIndex((item) => nameAliases.includes(item)) : (columns.length > 1 ? 0 : -1);
      const contactValue = normalizePhone(columns[phoneIndex] || "", countryCode);
      if (!contactValue) { invalid += 1; return; }
      if (seen.has(contactValue)) { duplicates += 1; return; }
      seen.add(contactValue);
      recipients.push({ contactName: nameIndex >= 0 ? text(columns[nameIndex]) || null : null, contactValue, payload });
    });

    return { recipients, totalRows: rows.length, validCount: recipients.length, duplicateCount: duplicates, invalidCount: invalid };
  }

  function refreshRecipientDraft() {
    state.recipientDraft = parseRecipients(refs.recipients.value);
    refs.recipientCount.textContent = `${state.recipientDraft.validCount} contacto${state.recipientDraft.validCount === 1 ? "" : "s"} válido${state.recipientDraft.validCount === 1 ? "" : "s"}`;
    refs.recipientSummary.textContent = `${state.recipientDraft.duplicateCount} duplicados omitidos · ${state.recipientDraft.invalidCount} inválidos`;
  }

  async function getCampaigns() {
    const data = await chrome.storage.local.get([CAMPAIGNS_KEY]);
    return Array.isArray(data?.[CAMPAIGNS_KEY]) ? data[CAMPAIGNS_KEY] : [];
  }

  async function saveCampaigns(campaigns, { sync = true } = {}) {
    state.campaigns = campaigns;
    await chrome.storage.local.set({ [CAMPAIGNS_KEY]: campaigns });
    renderAll();
    if (sync) void analytics.syncCampaigns(campaigns);
  }

  async function loadCampaigns() {
    state.campaigns = await getCampaigns();
    if (!state.selectedCampaignId || !state.campaigns.some((item) => item.id === state.selectedCampaignId)) {
      state.selectedCampaignId = state.campaigns[0]?.id || null;
    }
    renderAll();
  }

  function selectedCampaign() {
    return state.campaigns.find((campaign) => campaign.id === state.selectedCampaignId) || null;
  }

  function renderSummary() {
    refs.summaryCampaigns.textContent = String(state.campaigns.length);
    refs.summaryRecipients.textContent = String(state.campaigns.reduce((sum, campaign) => sum + (campaign.recipients?.length || 0), 0));
    refs.summarySent.textContent = String(state.campaigns.reduce((sum, campaign) => sum + statusCount(campaign, "sent"), 0));
    refs.summaryFailed.textContent = String(state.campaigns.reduce((sum, campaign) => sum + statusCount(campaign, "failed"), 0));
  }

  function renderList() {
    refs.list.replaceChildren();
    refs.listEmpty.classList.toggle("hidden", state.campaigns.length > 0);
    refs.list.classList.toggle("hidden", state.campaigns.length === 0);
    state.campaigns.forEach((campaign) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "campaign-item";
      if (campaign.id === state.selectedCampaignId) button.classList.add("is-selected");
      const title = document.createElement("strong");
      title.textContent = campaign.campaignName;
      const meta = document.createElement("span");
      meta.className = "helper-text";
      meta.textContent = `${campaign.status} · ${statusCount(campaign, "sent")}/${campaign.recipients.length} enviados`;
      button.append(title, meta);
      button.addEventListener("click", () => { state.selectedCampaignId = campaign.id; renderAll(); });
      refs.list.appendChild(button);
    });
  }

  async function renderDetailMedia(campaign) {
    if (state.detailPreviewUrl) URL.revokeObjectURL(state.detailPreviewUrl);
    state.detailPreviewUrl = "";
    refs.detailMediaWrap.classList.add("hidden");
    refs.detailMedia.removeAttribute("src");
    if (!campaign?.mediaDraftId || campaign.mediaType?.startsWith("video/")) return;
    const files = await attachmentStore.getAttachments(campaign.mediaDraftId);
    if (!files[0]) return;
    state.detailPreviewUrl = URL.createObjectURL(files[0]);
    refs.detailMedia.src = state.detailPreviewUrl;
    refs.detailMediaWrap.classList.remove("hidden");
  }

  function renderDetail() {
    const campaign = selectedCampaign();
    refs.detailEmpty.classList.toggle("hidden", Boolean(campaign));
    refs.detail.classList.toggle("hidden", !campaign);
    if (!campaign) return;
    refs.detailTitle.textContent = campaign.campaignName;
    refs.detailStatus.textContent = campaign.status;
    refs.detailStatus.className = `pill ${campaign.status === "completed" ? "success" : campaign.status === "failed" ? "danger" : ""}`;
    refs.detailTotal.textContent = String(campaign.recipients.length);
    refs.detailQueued.textContent = String(statusCount(campaign, ["queued", "claimed", "scheduled"]));
    refs.detailSent.textContent = String(statusCount(campaign, "sent"));
    refs.detailFailed.textContent = String(statusCount(campaign, "failed"));
    refs.detailTemplate.textContent = campaign.messageTemplate || "Sin template.";
    refs.detailSchedule.textContent = campaign.scheduleAt ? formatDate(campaign.scheduleAt) : "Inmediata";
    refs.detailDelay.textContent = `Delay: ${Number(campaign.messageDelayMs || 0) / 1000}s · lote ${Number(campaign.meta?.batchDelayMs || 0) / 1000}s`;
    refs.detailUpdated.textContent = `Actualizada: ${formatDate(campaign.updatedAt)}`;
    refs.detailCost.textContent = `Costo estimado: $${Number(campaign.estimatedCostMxn || 0).toFixed(2)} MXN`;
    refs.detailRecipients.replaceChildren();
    campaign.recipients.slice(0, 200).forEach((recipient) => {
      const row = document.createElement("div");
      row.className = "recipient-row";
      const label = document.createElement("span");
      label.textContent = `${recipient.contactName || "Sin nombre"} · ${recipient.contactValue}`;
      const status = document.createElement("strong");
      status.textContent = recipient.status;
      row.append(label, status);
      refs.detailRecipients.appendChild(row);
    });
    void renderDetailMedia(campaign);
  }

  function renderRunner() {
    const runner = state.runner;
    if (!runner) {
      refs.runnerTitle.textContent = "Sin ejecución activa";
      refs.runnerCopy.textContent = "Las campañas se almacenan y ejecutan desde este equipo.";
      return;
    }
    refs.runnerTitle.textContent = `${runner.campaignName || "Campaña"} · ${runner.status || "local"}`;
    refs.runnerCopy.textContent = runner.lastMessage || "Runner local activo.";
  }

  function renderAll() {
    renderSummary();
    renderList();
    renderDetail();
    renderRunner();
  }

  function runtimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
        if (!response?.ok) { reject(new Error(response?.error || "La operación del runner falló.")); return; }
        resolve(response);
      });
    });
  }

  async function pollRunner() {
    try {
      const response = await runtimeMessage({ type: "GET_CAMPAIGN_RUNNER_STATUS" });
      state.runner = response.runner || null;
      renderRunner();
    } catch {
      state.runner = null;
      renderRunner();
    }
  }

  async function startCampaign(campaignId = state.selectedCampaignId) {
    const index = state.campaigns.findIndex((campaign) => campaign.id === campaignId);
    if (index < 0) throw new Error("Selecciona una campaña para ejecutar.");
    const campaign = state.campaigns[index];
    if (!campaign.recipients.some((recipient) => ["queued", "claimed", "scheduled"].includes(recipient.status))) {
      throw new Error("Esta campaña ya no tiene destinatarios pendientes.");
    }
    const updated = {
      ...campaign,
      status: campaign.scheduleAt && new Date(campaign.scheduleAt).getTime() > Date.now() ? "scheduled" : "queued",
      recipients: campaign.recipients.map((recipient) => recipient.status === "claimed" ? { ...recipient, status: "queued" } : recipient),
      updatedAt: new Date().toISOString(),
    };
    const campaigns = state.campaigns.slice();
    campaigns[index] = updated;
    await saveCampaigns(campaigns);
    const response = await runtimeMessage({ type: "START_CAMPAIGN_RUNNER", campaignId: updated.id, campaignName: updated.campaignName });
    state.runner = response.runner;
    renderRunner();
    await analytics.queueEvent("campaign_started", null, updated.id);
  }

  async function pauseCampaign(campaignId = state.runner?.campaignId || state.selectedCampaignId) {
    if (!campaignId) return;
    const response = await runtimeMessage({ type: "PAUSE_CAMPAIGN", runId: state.runner?.runId || null });
    state.runner = response.runner;
    const campaigns = state.campaigns.map((campaign) => campaign.id === campaignId ? { ...campaign, status: "paused", updatedAt: new Date().toISOString() } : campaign);
    await saveCampaigns(campaigns);
    await analytics.queueEvent("campaign_paused", null, campaignId);
  }

  async function clearCurrentMedia() {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = "";
    await attachmentStore.clearAttachments(state.mediaDraftId);
    state.mediaMeta = null;
    refs.imagePreview.removeAttribute("src");
    refs.imagePreviewWrap.classList.add("hidden");
    refs.imageEmpty.classList.remove("hidden");
    setImageFeedback();
  }

  async function selectMedia(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_MEDIA.has(file.type)) {
      setImageFeedback("error", "Solo se permiten JPG, PNG, WEBP, MP4 o WEBM.");
      return;
    }
    await clearCurrentMedia();
    const result = await attachmentStore.saveAttachments(state.mediaDraftId, [file]);
    if (!result.saved.length) {
      setImageFeedback("error", result.rejected[0]?.message || "No fue posible guardar el archivo.");
      return;
    }
    state.mediaMeta = result.saved[0];
    refs.imageEmpty.classList.add("hidden");
    refs.imagePreviewWrap.classList.remove("hidden");
    refs.imageMeta.textContent = `${file.name} · ${attachmentStore.formatBytes(file.size)} · guardado localmente`;
    if (file.type.startsWith("image/")) {
      state.previewUrl = URL.createObjectURL(file);
      refs.imagePreview.src = state.previewUrl;
      refs.imagePreview.classList.remove("hidden");
    } else {
      refs.imagePreview.removeAttribute("src");
      refs.imagePreview.classList.add("hidden");
    }
    setImageFeedback("success", "Multimedia lista para la campaña.");
  }

  async function resetForm({ clearMedia = true } = {}) {
    refs.name.value = "";
    refs.schedule.value = "";
    refs.batchSize.value = "25";
    refs.delaySeconds.value = "4";
    refs.batchDelaySeconds.value = "30";
    refs.jitterSeconds.value = "3";
    refs.startNow.checked = true;
    refs.recipients.value = "";
    refs.template.value = DEFAULT_TEMPLATE;
    refs.notes.value = "";
    refs.costPerMessage.value = "0";
    refreshRecipientDraft();
    setFeedback();
    if (clearMedia) {
      await clearCurrentMedia();
    } else {
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = "";
      state.mediaMeta = null;
      refs.imagePreview.removeAttribute("src");
      refs.imagePreview.classList.remove("hidden");
      refs.imagePreviewWrap.classList.add("hidden");
      refs.imageEmpty.classList.remove("hidden");
      setImageFeedback();
    }
    state.mediaDraftId = `draft_${analytics.randomUuid()}`;
  }

  async function submitCampaign(event) {
    event.preventDefault();
    refs.submit.disabled = true;
    setFeedback();
    try {
      const profile = await analytics.getProfile();
      if (!profile) throw new Error("Configura un Name_ID antes de crear campañas.");
      refreshRecipientDraft();
      if (!state.recipientDraft.validCount) throw new Error("Agrega al menos un número válido.");
      const messageTemplate = multiline(refs.template.value);
      if (!messageTemplate && !state.mediaMeta) throw new Error("La campaña necesita texto o multimedia.");
      const now = new Date().toISOString();
      const id = analytics.randomUuid();
      const scheduleAt = refs.schedule.value ? new Date(refs.schedule.value).toISOString() : null;
      const costPerMessage = clamp(refs.costPerMessage.value, 0, 0, 100000);
      const recipients = state.recipientDraft.recipients.map((recipient) => ({
        id: analytics.randomUuid(),
        ...recipient,
        status: scheduleAt && new Date(scheduleAt).getTime() > Date.now() ? "scheduled" : "queued",
        resolvedMessage: window.RecalcBuildMessage.buildMessage(messageTemplate, recipient, recipient.payload),
        attemptedAt: null,
        sentAt: null,
        failedAt: null,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      }));
      const campaign = {
        id,
        campaignName: text(refs.name.value) || `Campaña ${new Date().toLocaleDateString("es-MX")}`,
        notes: multiline(refs.notes.value) || null,
        status: scheduleAt && new Date(scheduleAt).getTime() > Date.now() ? "scheduled" : "queued",
        scheduleAt,
        batchSize: Math.round(clamp(refs.batchSize.value, 25, 1, 200)),
        messageTemplate,
        messageDelayMs: Math.round(clamp(refs.delaySeconds.value, 4, 1, 120) * 1000),
        mediaDraftId: state.mediaMeta ? state.mediaDraftId : null,
        mediaType: state.mediaMeta?.type || null,
        mediaName: state.mediaMeta?.name || null,
        country: { code: refs.countryCode.value },
        settings: { costPerMessageMxn: costPerMessage },
        estimatedCostMxn: Number((costPerMessage * recipients.length).toFixed(2)),
        meta: {
          batchDelayMs: Math.round(clamp(refs.batchDelaySeconds.value, 30, 0, 1800) * 1000),
          jitterMs: Math.round(clamp(refs.jitterSeconds.value, 3, 0, 60) * 1000),
          nameId: profile.nameId,
        },
        recipients,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        completedAt: null,
      };
      const campaigns = [campaign, ...state.campaigns].slice(0, 100);
      state.selectedCampaignId = campaign.id;
      await saveCampaigns(campaigns);
      await analytics.queueEvent("campaign_created", { recipientCount: recipients.length, hasMedia: Boolean(campaign.mediaDraftId) }, campaign.id);
      const shouldStart = refs.startNow.checked;
      await resetForm({ clearMedia: false });
      activateTab("reports-panel");
      setFeedback("success", `Campaña local creada con ${recipients.length} destinatarios.`);
      if (shouldStart) await startCampaign(campaign.id);
    } catch (error) {
      setFeedback("error", error instanceof Error ? error.message : "No fue posible crear la campaña.");
    } finally {
      refs.submit.disabled = false;
    }
  }

  async function deleteCampaign() {
    const campaign = selectedCampaign();
    if (!campaign) return;
    if (state.runner?.enabled && state.runner.campaignId === campaign.id) throw new Error("Pausa la campaña antes de eliminarla.");
    const campaigns = state.campaigns.filter((item) => item.id !== campaign.id);
    if (campaign.mediaDraftId) await attachmentStore.clearAttachments(campaign.mediaDraftId);
    state.selectedCampaignId = campaigns[0]?.id || null;
    await saveCampaigns(campaigns);
    await analytics.queueEvent("campaign_deleted", null, campaign.id);
  }

  function csvCell(value) {
    const normalized = String(value ?? "");
    return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
  }

  function exportCsv() {
    const campaign = selectedCampaign();
    if (!campaign) { setFeedback("error", "Selecciona una campaña para exportar."); return; }
    const rows = [["Name_ID", "Campaña", "Nombre", "Número", "Estado", "Enviado", "Error", "Mensaje"]];
    campaign.recipients.forEach((recipient) => rows.push([
      campaign.meta?.nameId || "", campaign.campaignName, recipient.contactName || "", recipient.contactValue,
      recipient.status, recipient.sentAt || "", recipient.lastError || "", recipient.resolvedMessage || "",
    ]));
    const blob = new Blob(["\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `recalc-${campaign.campaignName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "campana"}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    refs.recipients.value = [refs.recipients.value, await file.text()].filter(Boolean).join("\n");
    refreshRecipientDraft();
    setFeedback("success", `Archivo importado: ${file.name}`);
  }

  async function loadTemplates() {
    const data = await chrome.storage.local.get([TEMPLATE_LIBRARY_KEY]);
    state.templateLibrary = Array.isArray(data?.[TEMPLATE_LIBRARY_KEY]) ? data[TEMPLATE_LIBRARY_KEY] : [];
    refs.templateLibrary.innerHTML = '<option value="">Templates guardados</option>';
    state.templateLibrary.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.name;
      refs.templateLibrary.appendChild(option);
    });
  }

  async function saveTemplate() {
    const body = multiline(refs.template.value);
    if (!body) throw new Error("Escribe un template antes de guardarlo.");
    const name = prompt("Nombre del template", `Template ${state.templateLibrary.length + 1}`);
    if (!name) return;
    state.templateLibrary = [{ id: analytics.randomUuid(), name: text(name), body }, ...state.templateLibrary.filter((entry) => entry.body !== body)].slice(0, 25);
    await chrome.storage.local.set({ [TEMPLATE_LIBRARY_KEY]: state.templateLibrary });
    await loadTemplates();
  }

  function updateClock() {
    const now = new Date();
    refs.currentTime.textContent = `Hora actual: ${now.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}`;
    const offset = now.getTimezoneOffset() * 60000;
    refs.schedule.min = new Date(now.getTime() - offset).toISOString().slice(0, 16);
  }

  refs.tabButtons.forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.tabTarget)));
  refs.recipients.addEventListener("input", refreshRecipientDraft);
  refs.countryCode.addEventListener("change", refreshRecipientDraft);
  refs.csv.addEventListener("change", (event) => void importCsv(event));
  refs.image.addEventListener("change", (event) => void selectMedia(event));
  refs.imageClear.addEventListener("click", () => void clearCurrentMedia());
  refs.form.addEventListener("submit", (event) => void submitCampaign(event));
  refs.reset.addEventListener("click", () => void resetForm());
  refs.refresh.addEventListener("click", () => void loadCampaigns());
  refs.startSelected.addEventListener("click", () => void startCampaign().catch((error) => setFeedback("error", error.message)));
  refs.runSelected.addEventListener("click", () => void startCampaign().catch((error) => setFeedback("error", error.message)));
  refs.pauseSelected.addEventListener("click", () => void pauseCampaign().catch((error) => setFeedback("error", error.message)));
  refs.pauseRunner.addEventListener("click", () => void pauseCampaign().catch((error) => setFeedback("error", error.message)));
  refs.deleteSelected.addEventListener("click", () => void deleteCampaign().catch((error) => setFeedback("error", error.message)));
  refs.exportResults.addEventListener("click", exportCsv);
  refs.templateLibrary.addEventListener("change", () => {
    const entry = state.templateLibrary.find((item) => item.id === refs.templateLibrary.value);
    if (entry) refs.template.value = entry.body;
  });
  refs.templateSave.addEventListener("click", () => void saveTemplate().catch((error) => setFeedback("error", error.message)));
  refs.templateDelete.addEventListener("click", async () => {
    state.templateLibrary = state.templateLibrary.filter((entry) => entry.id !== refs.templateLibrary.value);
    await chrome.storage.local.set({ [TEMPLATE_LIBRARY_KEY]: state.templateLibrary });
    await loadTemplates();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[CAMPAIGNS_KEY]) void loadCampaigns();
    if (changes["recalc.activeCampaignRunner"]) void pollRunner();
  });

  refs.template.value = DEFAULT_TEMPLATE;
  refreshRecipientDraft();
  updateClock();
  setInterval(updateClock, 30000);
  setInterval(() => void pollRunner(), 2000);
  const storedTab = localStorage.getItem(ACTIVE_TAB_KEY);
  if (["campaign-panel", "reports-panel"].includes(storedTab)) activateTab(storedTab);
  void loadTemplates();
  void loadCampaigns();
  void pollRunner();
});
