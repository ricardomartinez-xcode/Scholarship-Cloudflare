importScripts(
  "lib/analytics.js",
  "lib/storage/attachments.js",
  "lib/campaigns/buildMessage.js",
  "lib/campaigns/runCampaign-offline.js",
);

const SIDE_PANEL_PATH = "panel-offline.html";
const WHATSAPP_URL = "https://web.whatsapp.com/";
const WHATSAPP_HOST = "https://web.whatsapp.com/*";
const PENDING_DRAFT_KEY = "recalc.pendingWhatsAppDraft";
const mainWorldFiles = [
  "lib/whatsapp/wa-selectors.js",
  "lib/whatsapp/wa-text.js",
  "lib/whatsapp/wa-chat.js",
  "lib/whatsapp/wa-attachments.js",
  "lib/whatsapp/wa-runner.js",
  "injected/wa-main.js",
];
const mediaCache = new Map();

async function configureSidePanel() {
  if (!chrome.sidePanel) return;
  await chrome.sidePanel.setOptions({ enabled: true, path: SIDE_PANEL_PATH });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

async function storePendingDraft(payload) {
  await chrome.storage.local.set({ [PENDING_DRAFT_KEY]: payload });
}

async function clearPendingDraft() {
  await chrome.storage.local.remove([PENDING_DRAFT_KEY]);
}

function buildWhatsAppUrl({ phone, text }) {
  if (!phone) return WHATSAPP_URL;
  const url = new URL(`${WHATSAPP_URL}send`);
  url.searchParams.set("phone", phone);
  url.searchParams.set("app_absent", "0");
  if (text) url.searchParams.set("text", text);
  return url.toString();
}

function matchesWhatsAppNavigationTarget(currentUrl, expectedUrl) {
  try {
    const current = new URL(String(currentUrl || ""));
    const expected = new URL(String(expectedUrl || WHATSAPP_URL));
    if (current.origin !== expected.origin) return false;

    const expectedPhone = expected.searchParams.get("phone");
    if (!expectedPhone) return true;
    return current.searchParams.get("phone") === expectedPhone;
  } catch {
    return false;
  }
}

function createTabNavigationWaiter(
  tabId,
  expectedUrl,
  { timeoutMs = 30000, requireNavigationEvent = false, initialTab = null } = {},
) {
  let settled = false;
  let sawNavigation = !requireNavigationEvent;
  let sawTarget = false;
  let pollId = null;
  let timeoutId = null;
  let resolvePromise;
  let rejectPromise;

  const cleanup = () => {
    if (pollId) clearInterval(pollId);
    if (timeoutId) clearTimeout(timeoutId);
    chrome.tabs.onUpdated.removeListener(listener);
  };

  const finish = (tab) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolvePromise(tab || { id: tabId });
  };

  const fail = (message) => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectPromise(new Error(message));
  };

  const inspect = (tab, changeInfo = {}) => {
    if (settled) return;
    if (changeInfo.status === "loading" || changeInfo.url || tab?.status === "loading") {
      sawNavigation = true;
    }

    const currentUrl = changeInfo.url || tab?.url || "";
    if (matchesWhatsAppNavigationTarget(currentUrl, expectedUrl)) {
      sawTarget = true;
    }

    const isComplete = changeInfo.status === "complete" || (!changeInfo.status && tab?.status === "complete");
    if (isComplete && sawNavigation && sawTarget) {
      finish(tab);
    }
  };

  const listener = (updatedTabId, changeInfo, tab) => {
    if (updatedTabId !== tabId) return;
    inspect(tab, changeInfo);
  };

  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  chrome.tabs.onUpdated.addListener(listener);
  if (initialTab) inspect(initialTab);

  pollId = setInterval(() => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      inspect(tab);
    });
  }, 250);

  timeoutId = setTimeout(() => {
    fail("WhatsApp Web no terminó de abrir el chat del destinatario dentro del tiempo esperado.");
  }, timeoutMs);

  return {
    promise,
    inspect,
    cancel: () => fail("Se canceló la navegación de WhatsApp Web."),
  };
}

async function ensureWhatsAppTab({ phone, text } = {}) {
  const url = buildWhatsAppUrl({ phone, text });
  const tabs = await chrome.tabs.query({ url: WHATSAPP_HOST });
  const current = tabs[0];
  if (current?.id) {
    const waiter = createTabNavigationWaiter(current.id, url, {
      timeoutMs: 30000,
      requireNavigationEvent: true,
    });
    try {
      const updatedTab = await chrome.tabs.update(current.id, { url, active: false });
      waiter.inspect(updatedTab, {
        url: updatedTab?.url || "",
        status: updatedTab?.status || "",
      });
      await waiter.promise;
    } catch (error) {
      waiter.cancel();
      void waiter.promise.catch(() => null);
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
    return current.id;
  }
  const tab = await chrome.tabs.create({ url, active: false });
  if (!tab?.id) {
    throw new Error("No fue posible abrir la pestaña de WhatsApp Web.");
  }
  const waiter = createTabNavigationWaiter(tab.id, url, {
    timeoutMs: 30000,
    initialTab: tab,
  });
  await waiter.promise;
  await new Promise((resolve) => setTimeout(resolve, 700));
  return tab.id;
}

async function ensureWhatsAppBridge(tabId) {
  console.log("[ReCalc][BG] Inyectando bridge de WhatsApp.", {
    tabId,
    files: mainWorldFiles,
  });

  try {
    const injectionResult = await chrome.scripting.executeScript({
      target: { tabId },
      files: mainWorldFiles,
      world: "MAIN",
    });

    console.log("[ReCalc][BG] Bridge de WhatsApp inyectado.", {
      tabId,
      resultCount: Array.isArray(injectionResult) ? injectionResult.length : 0,
    });
  } catch (error) {
    console.error("[ReCalc][BG] Falló la inyección del bridge de WhatsApp.", error);

    throw new Error(
      `No fue posible inyectar los scripts de WhatsApp: ${error?.message || String(error)}`,
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));

  try {
    const [probeResult] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => ({
        href: window.location.href,
        readyState: document.readyState,
        hasSelectors: Boolean(window.RecalcWaSelectors),
        hasText: Boolean(window.RecalcWaText),
        hasChat: Boolean(window.RecalcWaChat),
        hasAttachments: Boolean(window.RecalcWaAttachments),
        hasRunner: Boolean(window.RecalcWaRunner),
        attachButtonFound: Boolean(
          document.querySelector(
            "button[aria-label='Adjuntar'], button[aria-label='Attach'], [role='button'][aria-label='Adjuntar'], [role='button'][aria-label='Attach'], span[data-icon='plus-rounded'], span[data-testid='plus-rounded'], span[data-icon='plus']",
          ),
        ),
      }),
    });

    const probe = probeResult?.result || null;

    console.log("[ReCalc][BG] Diagnóstico del bridge de WhatsApp.", probe);

    if (!probe?.hasSelectors || !probe?.hasText || !probe?.hasChat || !probe?.hasAttachments || !probe?.hasRunner) {
      throw new Error(
        `Bridge incompleto. Estado: ${JSON.stringify(probe)}`,
      );
    }

    if (!probe?.attachButtonFound) {
      console.warn("[ReCalc][BG] Bridge cargado, pero no se detectó el botón Adjuntar en el DOM actual.", probe);
    }

    return probe;
  } catch (error) {
    console.error("[ReCalc][BG] Falló el diagnóstico del bridge de WhatsApp.", error);

    throw new Error(
      `No fue posible validar el bridge de WhatsApp: ${error?.message || String(error)}`,
    );
  }
}

async function sendMessageToTab(tabId, message, { retries = 10, delayMs = 700 } = {}) {
  let lastTransportError = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    console.log("[ReCalc][BG] Enviando mensaje a WhatsApp.", {
      tabId,
      type: message?.type,
      attempt: attempt + 1,
      retries,
    });

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (result) => {
        const lastError = chrome.runtime.lastError;

        if (lastError) {
          resolve({
            transportError: true,
            error: lastError.message,
          });
          return;
        }

        if (typeof result === "undefined") {
          resolve({
            transportError: true,
            error: "Sin respuesta del content script.",
          });
          return;
        }

        resolve(result);
      });
    });

    console.log("[ReCalc][BG] Respuesta de WhatsApp/content script.", {
      attempt: attempt + 1,
      response,
    });

    if (!response?.transportError) {
      return response;
    }

    lastTransportError = response?.error || "Error de transporte desconocido.";

    console.warn("[ReCalc][BG] No hubo respuesta válida del content script. Reintentando.", {
      attempt: attempt + 1,
      error: lastTransportError,
    });

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(
    `No fue posible comunicarse con WhatsApp Web desde la extensión. Último error: ${lastTransportError || "sin detalle"}`,
  );
}

const LOCAL_CAMPAIGNS_KEY = "recalc.localCampaigns";

async function getLocalCampaigns() {
  const data = await chrome.storage.local.get([LOCAL_CAMPAIGNS_KEY]);
  return Array.isArray(data?.[LOCAL_CAMPAIGNS_KEY]) ? data[LOCAL_CAMPAIGNS_KEY] : [];
}

async function setLocalCampaigns(campaigns) {
  await chrome.storage.local.set({ [LOCAL_CAMPAIGNS_KEY]: campaigns });
}

function campaignForRunner(campaign) {
  if (!campaign) return null;
  return {
    ...campaign,
    batchDelayMs: Number(campaign.meta?.batchDelayMs || 0),
    jitterMs: Number(campaign.meta?.jitterMs || 0),
  };
}

async function loadCampaignById(runnerState) {
  const campaigns = await getLocalCampaigns();
  return campaignForRunner(campaigns.find((campaign) => campaign.id === runnerState.campaignId) ?? null);
}

async function claimNextBatch(runnerState) {
  const campaigns = await getLocalCampaigns();
  const index = campaigns.findIndex((campaign) => campaign.id === runnerState.campaignId);
  if (index < 0) return null;

  const campaign = campaigns[index];
  if (["paused", "stopped", "completed"].includes(String(campaign.status || "").toLowerCase())) {
    return null;
  }

  const scheduledAt = campaign.scheduleAt ? new Date(campaign.scheduleAt).getTime() : 0;
  if (scheduledAt && scheduledAt > Date.now()) {
    campaigns[index] = { ...campaign, status: "scheduled", updatedAt: new Date().toISOString() };
    await setLocalCampaigns(campaigns);
    return null;
  }

  const batchSize = Math.min(200, Math.max(1, Number(campaign.batchSize || 25)));
  const pending = (campaign.recipients || [])
    .filter((recipient) => ["queued", "scheduled"].includes(String(recipient.status || "queued").toLowerCase()))
    .slice(0, batchSize);
  if (!pending.length) return null;

  const claimedIds = new Set(pending.map((recipient) => recipient.id));
  const now = new Date().toISOString();
  const recipients = (campaign.recipients || []).map((recipient) =>
    claimedIds.has(recipient.id)
      ? { ...recipient, status: "claimed", attemptedAt: recipient.attemptedAt || now, updatedAt: now }
      : recipient,
  );
  const updatedCampaign = {
    ...campaign,
    status: "processing",
    startedAt: campaign.startedAt || now,
    updatedAt: now,
    recipients,
  };
  campaigns[index] = updatedCampaign;
  await setLocalCampaigns(campaigns);

  return {
    campaign: campaignForRunner(updatedCampaign),
    recipients: recipients.filter((recipient) => claimedIds.has(recipient.id)),
  };
}

async function reportDispatch(runnerState, result) {
  const campaigns = await getLocalCampaigns();
  const index = campaigns.findIndex((campaign) => campaign.id === runnerState.campaignId);
  if (index < 0) throw new Error("La campaña local ya no existe.");

  const campaign = campaigns[index];
  const now = new Date().toISOString();
  const recipients = (campaign.recipients || []).map((recipient) => {
    if (recipient.id !== result.recipientId) return recipient;
    const sent = result.status === "sent";
    return {
      ...recipient,
      status: sent ? "sent" : "failed",
      attemptedAt: recipient.attemptedAt || now,
      sentAt: sent ? now : null,
      failedAt: sent ? null : now,
      lastError: sent ? null : (result.error || "No fue posible enviar el mensaje."),
      updatedAt: now,
    };
  });

  const hasPending = recipients.some((recipient) =>
    ["queued", "claimed", "scheduled"].includes(String(recipient.status || "").toLowerCase()),
  );
  const updatedCampaign = {
    ...campaign,
    recipients,
    status: hasPending ? "processing" : "completed",
    completedAt: hasPending ? null : now,
    updatedAt: now,
  };
  campaigns[index] = updatedCampaign;
  await setLocalCampaigns(campaigns);

  void self.RecalcAnonymousAnalytics?.queueEvent(
    result.status === "sent" ? "recipient_sent" : "recipient_failed",
    { error: result.error || null, step: result.step || null },
    updatedCampaign.id,
    result.recipientId,
  );
  void self.RecalcAnonymousAnalytics?.syncCampaigns(campaigns);
  return campaignForRunner(updatedCampaign);
}

function resolveMessage(working, recipient) {
  if (recipient?.resolvedMessage) return String(recipient.resolvedMessage).trim();
  return self.RecalcBuildMessage.buildMessage(
    working.currentBatch?.campaign?.messageTemplate || "",
    recipient,
    recipient?.payload ?? null,
  );
}

const UNSUPPORTED_CAMPAIGN_MEDIA_TYPES = new Set(["image/x-icon", "image/vnd.microsoft.icon"]);

function normalizeContentType(value) {
  return String(value || "").split(";")[0].trim().toLowerCase();
}

function isSupportedCampaignMediaType(value) {
  const normalized = normalizeContentType(value);
  if (UNSUPPORTED_CAMPAIGN_MEDIA_TYPES.has(normalized)) return false;
  return ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"].includes(normalized);
}

async function getAttachmentsForCampaign(working) {
  const campaignId = String(working.currentBatch?.campaign?.id || working.campaignId || "").trim();
  if (!campaignId) return [];
  if (mediaCache.has(campaignId)) return mediaCache.get(campaignId);

  const campaign = await loadCampaignById({ campaignId });
  if (!campaign?.mediaDraftId) {
    mediaCache.set(campaignId, []);
    return [];
  }

  const files = await self.RecalcAttachmentStore.getAttachments(campaign.mediaDraftId);
  const payload = [];
  for (const file of files) {
    const contentType = normalizeContentType(file.type);
    if (!isSupportedCampaignMediaType(contentType)) {
      throw new Error(`El archivo local debe ser JPG, PNG, WEBP, MP4 o WEBM. Tipo: ${contentType || "desconocido"}.`);
    }
    payload.push({
      name: file.name || campaign.mediaName || "campaign-media",
      type: contentType,
      size: file.size,
      lastModified: file.lastModified || Date.now(),
      bytes: Array.from(new Uint8Array(await file.arrayBuffer())),
    });
  }

  mediaCache.set(campaignId, payload);
  return payload;
}

async function sendToWhatsApp(tabId, payload) {
  return sendMessageToTab(tabId, payload, { retries: 12, delayMs: 900 });
}

async function openWhatsAppWithDraft(message, sendResponse) {
  await storePendingDraft({
    runId: message.runId ?? null,
    draftText: String(message.draftText ?? "").trim(),
    selectorPack: message.selectorPack ?? null,
  });

  try {
    const tabId = await ensureWhatsAppTab();
    await ensureWhatsAppBridge(tabId);
    const response = await sendMessageToTab(tabId, {
      type: "RECALC_APPLY_WHATSAPP_DRAFT",
      draftText: String(message.draftText ?? "").trim(),
      selectorPack: message.selectorPack ?? null,
    }, { retries: 4, delayMs: 800 }).catch(() => null);

    if (response?.ok && response?.applied) {
      await clearPendingDraft();
    }

    sendResponse({ ok: true, tabId });
  } catch (error) {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : "No fue posible abrir WhatsApp Web." });
  }
}

chrome.runtime.onInstalled.addListener(() => { void configureSidePanel(); });
chrome.runtime.onStartup.addListener(() => { void configureSidePanel(); });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== self.RecalcCampaignRunner.RUNNER_ALARM) return;
  void self.RecalcCampaignRunner.processTick({
    loadCampaignById,
    claimNextBatch,
    reportDispatch,
    ensureWhatsAppTab,
    ensureWhatsAppBridge,
    resolveMessage,
    getAttachmentsForCampaign,
    sendToWhatsApp,
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return;
  }

  if (message?.type === "OPEN_WHATSAPP") {
    void openWhatsAppWithDraft(message, sendResponse);
    return true;
  }

  if (message?.type === "START_CAMPAIGN" || message?.type === "START_CAMPAIGN_RUNNER") {
    void self.RecalcCampaignRunner.runCampaign(message)
      .then((runner) => sendResponse({ ok: true, runner }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "No fue posible iniciar el runner." }));
    return true;
  }

  if (message?.type === "PAUSE_CAMPAIGN") {
    void self.RecalcCampaignRunner.pauseCampaign(message.runId ?? null)
      .then((runner) => sendResponse({ ok: true, runner }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "No fue posible pausar el runner." }));
    return true;
  }

  if (message?.type === "STOP_CAMPAIGN" || message?.type === "STOP_CAMPAIGN_RUNNER") {
    void self.RecalcCampaignRunner.stopCampaign(message.runId ?? null)
      .then((runner) => sendResponse({ ok: true, runner }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "No fue posible detener el runner." }));
    return true;
  }

  if (message?.type === "CLEAR_CAMPAIGN_RUNNER") {
    void self.RecalcCampaignRunner.clearCampaign(message.runId ?? null, message.campaignId ?? null)
      .then((runner) => sendResponse({ ok: true, runner }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "No fue posible limpiar el runner." }));
    return true;
  }

  if (message?.type === "GET_CAMPAIGN_STATUS" || message?.type === "GET_CAMPAIGN_RUNNER_STATUS") {
    void self.RecalcCampaignRunner.getCampaignStatus()
      .then((runner) => sendResponse({ ok: true, runner }))
      .catch(() => sendResponse({ ok: true, runner: null }));
    return true;
  }

  if (message?.type === "RECALC_WHATSAPP_DRAFT_STATUS") {
    if (message.eventType === "whatsapp_draft_applied") {
      void clearPendingDraft();
    }
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "RECALC_CLEAR_PENDING_WHATSAPP_DRAFT") {
    void clearPendingDraft();
    sendResponse({ ok: true });
  }
});
