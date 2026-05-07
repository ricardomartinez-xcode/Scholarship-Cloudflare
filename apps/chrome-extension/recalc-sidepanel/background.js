importScripts(
  "lib/campaigns/buildMessage.js",
  "lib/campaigns/runCampaign.js",
);

const SIDE_PANEL_PATH = "panel.html";
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

function normalizeToken(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

async function apiJsonFetch({ appBaseUrl, extensionSessionToken, path, method = "GET", body = null }) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const token = normalizeToken(extensionSessionToken);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-extension-session-token", token);
  }
  headers.set("x-extension-client", "chrome-sidepanel");
  headers.set("x-extension-version", chrome?.runtime?.getManifest?.().version || "unknown");

  const response = await fetch(`${appBaseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  return { response, data };
}

async function apiBinaryFetch({ appBaseUrl, extensionSessionToken, path }) {
  const headers = new Headers();
  const token = normalizeToken(extensionSessionToken);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-extension-session-token", token);
  }
  headers.set("x-extension-client", "chrome-sidepanel");
  headers.set("x-extension-version", chrome?.runtime?.getManifest?.().version || "unknown");

  return fetch(`${appBaseUrl}${path}`, {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });
}

async function logRunEvent({ appBaseUrl, extensionSessionToken, runId, eventType, message, metaJson }) {
  if (!appBaseUrl || !extensionSessionToken || !runId) return;
  try {
    await fetch(`${appBaseUrl}/api/ext/runs/${encodeURIComponent(runId)}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${extensionSessionToken}`,
        "x-extension-session-token": extensionSessionToken,
        "x-extension-client": "chrome-sidepanel",
        "x-extension-version": chrome?.runtime?.getManifest?.().version || "unknown",
      },
      credentials: "include",
      body: JSON.stringify({ eventType, message, metaJson: metaJson ?? null }),
    });
  } catch {
    // Ignore telemetry failures.
  }
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

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function ensureWhatsAppTab({ phone, text } = {}) {
  const url = buildWhatsAppUrl({ phone, text });
  const tabs = await chrome.tabs.query({ url: WHATSAPP_HOST });
  const current = tabs[0];
  if (current?.id) {
    await chrome.tabs.update(current.id, { url, active: true });
    await waitForTabComplete(current.id);
    return current.id;
  }
  const tab = await chrome.tabs.create({ url, active: true });
  if (!tab?.id) {
    throw new Error("No fue posible abrir la pestaña de WhatsApp Web.");
  }
  await waitForTabComplete(tab.id);
  return tab.id;
}

async function ensureWhatsAppBridge(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: mainWorldFiles,
    world: "MAIN",
  }).catch(() => null);
}

async function sendMessageToTab(tabId, message, { retries = 10, delayMs = 700 } = {}) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (result) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          resolve({ transportError: true, error: lastError.message });
          return;
        }
        if (typeof result === "undefined") {
          resolve({ transportError: true, error: "Sin respuesta del content script." });
          return;
        }
        resolve(result);
      });
    });
    if (!response?.transportError) return response;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("No fue posible comunicarse con WhatsApp Web desde la extensión.");
}

async function loadCampaignById(runnerState) {
  const { response, data } = await apiJsonFetch({
    appBaseUrl: runnerState.appBaseUrl,
    extensionSessionToken: runnerState.extensionSessionToken,
    path: "/api/ext/campaigns",
  });
  if (!response.ok || !data?.ok || !Array.isArray(data.campaigns)) {
    throw new Error(data?.error || "No fue posible leer las campañas del backend.");
  }
  return data.campaigns.find((campaign) => campaign.id === runnerState.campaignId) ?? null;
}

async function claimNextBatch(runnerState) {
  const { response, data } = await apiJsonFetch({
    appBaseUrl: runnerState.appBaseUrl,
    extensionSessionToken: runnerState.extensionSessionToken,
    path: "/api/ext/campaigns/claim",
    method: "POST",
    body: { campaignId: runnerState.campaignId },
  });
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "No fue posible reclamar el siguiente batch.");
  }
  return data.batch ?? null;
}

async function reportDispatch(runnerState, result) {
  const { response, data } = await apiJsonFetch({
    appBaseUrl: runnerState.appBaseUrl,
    extensionSessionToken: runnerState.extensionSessionToken,
    path: `/api/ext/campaigns/${encodeURIComponent(runnerState.campaignId)}/dispatch`,
    method: "POST",
    body: { results: [result] },
  });
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "No fue posible reportar el resultado del despacho.");
  }
  return data.campaign ?? null;
}

function resolveMessage(working, recipient) {
  if (recipient?.resolvedMessage) return String(recipient.resolvedMessage).trim();
  return self.RecalcBuildMessage.buildMessage(
    working.currentBatch?.campaign?.messageTemplate || "",
    recipient,
    recipient?.payload ?? null,
  );
}

function filenameFromDisposition(headerValue) {
  const normalized = String(headerValue || "");
  const utf8Match = normalized.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const quotedMatch = normalized.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];

  const plainMatch = normalized.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim() || "";
}

async function getAttachmentsForCampaign(working) {
  const campaignId = String(working.currentBatch?.campaign?.id || working.campaignId || "").trim();
  if (!campaignId) return [];
  if (mediaCache.has(campaignId)) return mediaCache.get(campaignId);

  const response = await apiBinaryFetch({
    appBaseUrl: working.appBaseUrl,
    extensionSessionToken: working.extensionSessionToken,
    path: `/api/ext/campaigns/media?campaignId=${encodeURIComponent(campaignId)}`,
  });

  if (response.status === 404) {
    mediaCache.set(campaignId, []);
    return [];
  }

  if (!response.ok) {
    throw new Error("No fue posible recuperar la imagen oficial de la campaña.");
  }

  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const bytes = Array.from(new Uint8Array(buffer));
  const contentType = blob.type || response.headers.get("content-type") || "application/octet-stream";
  const fileName =
    filenameFromDisposition(response.headers.get("content-disposition")) ||
    `campaign-media.${contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : contentType.includes("gif") ? "gif" : "jpg"}`;

  const payload = [{
    name: fileName,
    type: contentType,
    size: blob.size,
    lastModified: Date.now(),
    bytes,
  }];

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
    appBaseUrl: message.appBaseUrl ?? null,
    extensionSessionToken: normalizeToken(message.extensionSessionToken ?? ""),
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
    } else {
      await logRunEvent({
        appBaseUrl: message.appBaseUrl,
        extensionSessionToken: message.extensionSessionToken,
        runId: message.runId,
        eventType: "whatsapp_draft_waiting",
        message: "WhatsApp abrió correctamente. Falta seleccionar un chat para insertar el borrador.",
        metaJson: { source: "background_worker" },
      });
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

  if (message?.type === "GET_CAMPAIGN_STATUS" || message?.type === "GET_CAMPAIGN_RUNNER_STATUS") {
    void self.RecalcCampaignRunner.getCampaignStatus()
      .then((runner) => sendResponse({ ok: true, runner }))
      .catch(() => sendResponse({ ok: true, runner: null }));
    return true;
  }

  if (message?.type === "RECALC_WHATSAPP_DRAFT_STATUS") {
    void logRunEvent({
      appBaseUrl: message.appBaseUrl,
      extensionSessionToken: message.extensionSessionToken,
      runId: message.runId,
      eventType: message.eventType ?? "whatsapp_draft_status",
      message: message.message ?? null,
      metaJson: message.metaJson ?? null,
    });
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
