importScripts(
  "lib/campaigns/buildMessage.js",
  "lib/campaigns/runCampaign.js",
);

const SIDE_PANEL_PATH = "panel.html";
const WHATSAPP_URL = "https://web.whatsapp.com/";
const WHATSAPP_HOST = "https://web.whatsapp.com/*";
const PENDING_DRAFT_KEY = "recalc.pendingWhatsAppDraft";
const DEBUGGER_PROTOCOL_VERSION = "1.3";
const DEBUGGER_UPLOAD_TIMEOUT_MS = 20000;
const TEMP_DOWNLOAD_DIR = "ReCalc";
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

const SUPPORTED_CAMPAIGN_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function normalizeContentType(value) {
  const normalized = String(value || "").split(";")[0].trim().toLowerCase();
  if (normalized === "image/jpg" || normalized === "image/pjpeg" || normalized === "image/jfif") {
    return "image/jpeg";
  }
  return normalized;
}

function isSupportedCampaignImageType(value) {
  return SUPPORTED_CAMPAIGN_IMAGE_TYPES.has(normalizeContentType(value));
}

function extensionForCampaignImageType(contentType) {
  const normalized = normalizeContentType(contentType);
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  return "jpg";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeDownloadName(value, fallback = "campaign-media") {
  const safe = String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return safe || fallback;
}

function bytesToBase64(bytes) {
  const source = Array.isArray(bytes) ? bytes : [];
  let binary = "";
  for (let index = 0; index < source.length; index += 0x8000) {
    binary += String.fromCharCode(...source.slice(index, index + 0x8000));
  }
  return btoa(binary);
}

function chromeCallback(fn) {
  return new Promise((resolve, reject) => {
    fn((result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
}

function downloadWithCallback(options) {
  return chromeCallback((resolve) => chrome.downloads.download(options, resolve));
}

function searchDownloadWithCallback(query) {
  return chromeCallback((resolve) => chrome.downloads.search(query, resolve));
}

function removeDownloadFile(downloadId) {
  if (!downloadId && downloadId !== 0) return Promise.resolve();
  return chromeCallback((resolve) => chrome.downloads.removeFile(downloadId, resolve)).catch(() => null)
    .then(() => chromeCallback((resolve) => chrome.downloads.erase({ id: downloadId }, resolve)).catch(() => null));
}

function waitForDownloadComplete(downloadId, timeoutMs = DEBUGGER_UPLOAD_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.downloads.onChanged.removeListener(listener);
      reject(new Error("La descarga temporal de la imagen tardó demasiado."));
    }, timeoutMs);

    function listener(delta) {
      if (delta.id !== downloadId || !delta.state?.current) return;
      if (delta.state.current === "complete") {
        clearTimeout(timer);
        chrome.downloads.onChanged.removeListener(listener);
        resolve();
        return;
      }
      if (delta.state.current === "interrupted") {
        clearTimeout(timer);
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error("Chrome interrumpió la descarga temporal de la imagen."));
      }
    }

    chrome.downloads.onChanged.addListener(listener);
  });
}

async function materializeAttachmentForDebugger(attachment) {
  const bytes = Array.isArray(attachment?.bytes) ? attachment.bytes : [];
  if (!bytes.length) {
    throw new Error("La imagen de campaña no contiene bytes para cargar en WhatsApp.");
  }

  const contentType = normalizeContentType(attachment.type || "image/png") || "image/png";
  const extension = extensionForCampaignImageType(contentType);
  const baseName = sanitizeDownloadName(attachment.name || `campaign-media.${extension}`);
  const fileName = baseName.includes(".") ? baseName : `${baseName}.${extension}`;
  const dataUrl = `data:${contentType};base64,${bytesToBase64(bytes)}`;
  const downloadId = await downloadWithCallback({
    url: dataUrl,
    filename: `${TEMP_DOWNLOAD_DIR}/${Date.now()}-${fileName}`,
    conflictAction: "uniquify",
    saveAs: false,
  });

  await waitForDownloadComplete(downloadId);
  const [item] = await searchDownloadWithCallback({ id: downloadId });
  if (!item?.filename) {
    throw new Error("Chrome no devolvió la ruta local de la imagen temporal.");
  }

  return { downloadId, filePath: item.filename };
}

function debuggerCommand(tabId, method, params = {}) {
  return chromeCallback((resolve) => chrome.debugger.sendCommand({ tabId }, method, params, resolve));
}

function waitForDebuggerEvent(tabId, method, timeoutMs = DEBUGGER_UPLOAD_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.debugger.onEvent.removeListener(listener);
      reject(new Error(`No llegó el evento ${method} desde Chrome Debugger.`));
    }, timeoutMs);

    function listener(source, eventMethod, params) {
      if (source.tabId !== tabId || eventMethod !== method) return;
      clearTimeout(timer);
      chrome.debugger.onEvent.removeListener(listener);
      resolve(params || {});
    }

    chrome.debugger.onEvent.addListener(listener);
  });
}

async function withDebugger(tabId, task) {
  await chromeCallback((resolve) => chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION, resolve));
  try {
    return await task();
  } finally {
    await chromeCallback((resolve) => chrome.debugger.detach({ tabId }, resolve)).catch(() => null);
  }
}

async function executeMainWorld(tabId, func, args = []) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func,
    args,
  });
  return result?.result ?? null;
}

async function waitForMainWorld(tabId, func, args = [], timeoutMs = 12000, intervalMs = 250) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await executeMainWorld(tabId, func, args).catch(() => null);
    if (result) return result;
    await wait(intervalMs);
  }
  return null;
}

function centerFromRect(rect) {
  if (!rect || !rect.width || !rect.height) return null;
  return {
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
  };
}

async function debuggerClick(tabId, point) {
  if (!point) throw new Error("No se pudo calcular el punto de click para WhatsApp.");
  await debuggerCommand(tabId, "Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    button: "none",
  });
  await debuggerCommand(tabId, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await debuggerCommand(tabId, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
}

function hasDebuggerMediaAttachments(payload) {
  return Array.isArray(payload?.attachments) &&
    payload.attachments.length > 0 &&
    payload.attachments.every((attachment) => {
      const mime = normalizeContentType(attachment?.type || "");
      return mime.startsWith("image/") || mime.startsWith("video/");
    });
}

async function waitForWhatsAppConversation(tabId, selectorPack) {
  return waitForMainWorld(tabId, (pack) => {
    if (!window.RecalcWaSelectors) return null;
    const bodyText = String(document.body?.innerText || "").toLowerCase();
    const invalid = [
      "phone number shared via url is invalid",
      "número de teléfono compartido mediante la url no es válido",
      "no está en whatsapp",
      "not on whatsapp",
    ].some((pattern) => bodyText.includes(pattern));
    if (invalid) return { invalid: true };

    const attach = window.RecalcWaSelectors.findAttachButton(pack);
    const composer = window.RecalcWaSelectors.findMessageInput(pack);
    if (!attach && !composer) return null;
    return { invalid: false, ready: true };
  }, [selectorPack], 20000, 350);
}

async function getAttachClickPoint(tabId, selectorPack) {
  return executeMainWorld(tabId, (pack) => {
    const attach = window.RecalcWaSelectors?.findAttachButton?.(pack);
    if (!attach) return null;
    const rect = attach.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      inFooter: Boolean(attach.closest?.("footer")),
    };
  }, [selectorPack]).then((rect) => centerFromRect(rect));
}

async function getMediaOptionClickPoint(tabId, selectorPack) {
  return waitForMainWorld(tabId, (pack) => {
    const selectors = window.RecalcWaSelectors;
    if (!selectors) return null;
    const option = selectors.findAttachmentOption("media");
    const stickerNeedles = [
      "sticker",
      "stickers",
      "sticker maker",
      "pegatina",
      "pegatinas",
      "calcomanía",
      "calcomanías",
      "calcomania",
      "calcomanias",
    ];
    if (!option || selectors.matchAnyText?.(option, stickerNeedles)) return null;
    const rect = option.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }, [selectorPack], 6000, 150).then((rect) => centerFromRect(rect));
}

async function fillPreviewCaption(tabId, text, selectorPack) {
  return waitForMainWorld(tabId, (captionText, pack) => {
    const selectors = window.RecalcWaSelectors;
    const textUtils = window.RecalcWaText;
    if (!selectors || !textUtils || !selectors.findPreviewModal(pack)) return null;

    const normalized = String(captionText || "").trim();
    const caption = selectors.findCaptionInput(pack);
    if (!caption) return { previewFound: true, captionFound: false, captionApplied: !normalized };

    let captionApplied = true;
    if (normalized) {
      captionApplied = Boolean(textUtils.fillComposer(caption, normalized));
      captionApplied = captionApplied && textUtils.composerText(caption) === normalized;
    }

    const composer = selectors.findMessageInput(pack);
    if (composer && composer !== caption && textUtils.composerText(composer) === normalized) {
      textUtils.clearComposer(composer);
    }

    return {
      previewFound: true,
      captionFound: true,
      captionApplied,
      captionText: textUtils.composerText(caption),
    };
  }, [text, selectorPack], 10000, 250);
}

async function getPreviewSendClickPoint(tabId, selectorPack) {
  return waitForMainWorld(tabId, (pack) => {
    const button = window.RecalcWaSelectors?.findPreviewSendButton?.(pack);
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }, [selectorPack], 10000, 250).then((rect) => centerFromRect(rect));
}

async function sendMediaMessageViaDebugger(tabId, payload) {
  const selectorPack = payload?.selectorPack ?? null;
  const text = String(payload?.text || "").trim();
  const attachments = Array.isArray(payload?.attachments) ? payload.attachments : [];
  const materialized = [];

  try {
    await ensureWhatsAppBridge(tabId);
    const readyState = await waitForWhatsAppConversation(tabId, selectorPack);
    if (readyState?.invalid) {
      throw new Error("WhatsApp marcó el número como inválido o no disponible.");
    }
    if (!readyState?.ready) {
      throw new Error("No fue posible preparar el chat de WhatsApp Web.");
    }

    for (const attachment of attachments) {
      materialized.push(await materializeAttachmentForDebugger(attachment));
    }

    await withDebugger(tabId, async () => {
      await debuggerCommand(tabId, "Page.enable");
      await debuggerCommand(tabId, "DOM.enable");

      for (const item of materialized) {
        await debuggerCommand(tabId, "Page.setInterceptFileChooserDialog", { enabled: true });

        const attachPoint = await getAttachClickPoint(tabId, selectorPack);
        await debuggerClick(tabId, attachPoint);
        await wait(500);

        const mediaPoint = await getMediaOptionClickPoint(tabId, selectorPack);
        if (!mediaPoint) {
          throw new Error("No se encontró una opción segura de Fotos y videos en WhatsApp.");
        }

        const chooserPromise = waitForDebuggerEvent(tabId, "Page.fileChooserOpened", 8000);
        await debuggerClick(tabId, mediaPoint);
        const chooser = await chooserPromise;
        if (!chooser?.backendNodeId) {
          throw new Error("Chrome no expuso el input del file chooser de WhatsApp.");
        }

        await debuggerCommand(tabId, "DOM.setFileInputFiles", {
          files: [item.filePath],
          backendNodeId: chooser.backendNodeId,
        });

        const captionState = await fillPreviewCaption(tabId, text, selectorPack);
        if (text && !captionState?.captionApplied) {
          throw new Error("No fue posible escribir el caption en el preview de WhatsApp.");
        }

        const sendPoint = await getPreviewSendClickPoint(tabId, selectorPack);
        await debuggerClick(tabId, sendPoint);
        const previewClosed = await waitForMainWorld(tabId, (pack) => {
          return window.RecalcWaSelectors?.findPreviewModal?.(pack) ? null : { closed: true };
        }, [selectorPack], 12000, 300);
        if (!previewClosed) {
          throw new Error("WhatsApp no confirmó el cierre del preview después de enviar la imagen.");
        }
      }
    });

    return {
      success: true,
      step: "debugger_media_sent",
      delayMs: 4000,
    };
  } catch (error) {
    return {
      success: false,
      step: "debugger_media_failed",
      delayMs: 4000,
      error: error instanceof Error ? error.message : "Falló el envío de media con Chrome Debugger.",
    };
  } finally {
    await Promise.all(materialized.map((item) => removeDownloadFile(item.downloadId)));
  }
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
  const contentType = normalizeContentType(
    blob.type || response.headers.get("content-type") || "application/octet-stream",
  );

  if (!isSupportedCampaignImageType(contentType)) {
    throw new Error(
      `La imagen de campaña debe ser PNG, JPG o WEBP. El backend entregó: ${contentType || "desconocido"}.`,
    );
  }

  const fileName =
    filenameFromDisposition(response.headers.get("content-disposition")) ||
    `campaign-media.${extensionForCampaignImageType(contentType)}`;

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
  if (payload?.type === "RECALC_WA_SEND_WITH_ATTACHMENTS" && hasDebuggerMediaAttachments(payload)) {
    return sendMediaMessageViaDebugger(tabId, payload);
  }

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
