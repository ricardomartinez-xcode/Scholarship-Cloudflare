const PENDING_DRAFT_KEY = "recalc.pendingWhatsAppDraft";
const DEFAULT_SELECTOR_PACK = {
  selectors: {
    messageInput:
      "footer div[contenteditable='true'][role='textbox'], footer div[contenteditable='true'], div[role='textbox'][contenteditable='true'][aria-label='Escribir un mensaje'], div[role='textbox'][contenteditable='true'][aria-label='Write a message']",
    sendButton:
      "button[aria-label='Enviar'], button[aria-label='Send'], span[data-icon='send']",
    attachButton:
      "button[title*='Adjuntar'], button[title*='Attach'], button[aria-label*='Adjuntar'], button[aria-label*='Attach'], span[data-icon='plus'], span[data-icon='plus-rounded']",
    fileInput:
      "input[type='file'][accept*='image'], input[type='file'][accept*='video'], input[type='file']",
    mediaCaptionInput:
      "div[contenteditable='true'][role='textbox'][aria-label*='Escribir un mensaje para'], div[contenteditable='true'][role='textbox'][aria-label*='Write a message for'], div[contenteditable='true'][role='textbox'][data-tab='10'], div[contenteditable='true'][role='textbox'][data-tab='6']",
    conversationReady:
      "header, div[data-testid='conversation-panel-wrapper'], main[role='main']",
  },
};

let awaitingChatNotified = false;
let observer = null;
let applyingDraft = false;

function normalizeSelectorPack(pack) {
  const selectors =
    pack && typeof pack === "object" && typeof pack.selectors === "object"
      ? pack.selectors
      : {};

  return {
    selectors: {
      messageInput:
        typeof selectors.messageInput === "string" && selectors.messageInput.trim()
          ? selectors.messageInput.trim()
          : DEFAULT_SELECTOR_PACK.selectors.messageInput,
      sendButton:
        typeof selectors.sendButton === "string" && selectors.sendButton.trim()
          ? selectors.sendButton.trim()
          : DEFAULT_SELECTOR_PACK.selectors.sendButton,
      attachButton:
        typeof selectors.attachButton === "string" && selectors.attachButton.trim()
          ? selectors.attachButton.trim()
          : DEFAULT_SELECTOR_PACK.selectors.attachButton,
      fileInput:
        typeof selectors.fileInput === "string" && selectors.fileInput.trim()
          ? selectors.fileInput.trim()
          : DEFAULT_SELECTOR_PACK.selectors.fileInput,
      mediaCaptionInput:
        typeof selectors.mediaCaptionInput === "string" && selectors.mediaCaptionInput.trim()
          ? selectors.mediaCaptionInput.trim()
          : DEFAULT_SELECTOR_PACK.selectors.mediaCaptionInput,
      conversationReady:
        typeof selectors.conversationReady === "string" && selectors.conversationReady.trim()
          ? selectors.conversationReady.trim()
          : DEFAULT_SELECTOR_PACK.selectors.conversationReady,
    },
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function parseSelectorList(rawSelectors) {
  return String(rawSelectors ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function findFirstVisible(selectors) {
  for (const selector of parseSelectorList(selectors)) {
    const nodes = Array.from(document.querySelectorAll(selector));
    const visible = nodes.find((node) => isVisible(node));
    if (visible) return visible;
    if (nodes[0]) return nodes[0];
  }
  return null;
}

function findComposer(selectorPack) {
  const selectors = normalizeSelectorPack(selectorPack).selectors.messageInput;
  const footer = document.querySelector("footer");
  if (footer) {
    for (const selector of parseSelectorList(selectors)) {
      const nodes = Array.from(footer.querySelectorAll(selector));
      const visible = nodes.find((node) => isVisible(node));
      if (visible) return visible;
      if (nodes[0]) return nodes[0];
    }
  }
  return findFirstVisible(selectors);
}

function findSendButton(selectorPack) {
  const selectors = normalizeSelectorPack(selectorPack).selectors.sendButton;
  const footer = document.querySelector("footer");
  if (footer) {
    for (const selector of parseSelectorList(selectors)) {
      const nodes = Array.from(footer.querySelectorAll(selector));
      const visible = nodes.find((node) => isVisible(node));
      if (visible) return visible;
      if (nodes[0]) return nodes[0];
    }
  }
  return findFirstVisible(selectors);
}

function findAttachButton(selectorPack) {
  return findFirstVisible(normalizeSelectorPack(selectorPack).selectors.attachButton);
}

function findFileInput(selectorPack) {
  const selectors = normalizeSelectorPack(selectorPack).selectors;
  const candidates = [];
  for (const selector of parseSelectorList(selectors.fileInput)) {
    const nodes = Array.from(document.querySelectorAll(selector));
    for (const node of nodes) {
      if (node instanceof HTMLInputElement && node.type === "file" && !node.disabled) {
        candidates.push(node);
      }
    }
  }

  const uniqueCandidates = candidates.filter((node, index, list) => list.indexOf(node) === index);
  const scoreInput = (input) => {
    const accept = String(input.accept || "").toLowerCase();
    const multiple = Boolean(input.multiple);
    let score = 0;
    if (accept.includes("image")) score += 3;
    if (accept.includes("video")) score += 6;
    if (multiple) score += 4;
    if (accept.includes("audio")) score -= 4;
    if (accept === "image/*" && !multiple) score -= 6;
    return score;
  };

  return uniqueCandidates
    .map((input) => ({ input, score: scoreInput(input) }))
    .sort((a, b) => b.score - a.score)[0]?.input || null;
}

function findCaptionComposer(selectorPack) {
  return findFirstVisible(normalizeSelectorPack(selectorPack).selectors.mediaCaptionInput);
}

function findConversationReady(selectorPack) {
  return findFirstVisible(normalizeSelectorPack(selectorPack).selectors.conversationReady);
}

function readComposerText(composer) {
  return String(composer?.innerText ?? composer?.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function setComposerSelection(composer, collapseToEnd = true) {
  if (!(composer instanceof Element)) return;
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composer);
  range.collapse(collapseToEnd);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function buildComposerHtml(text, lexicalMode) {
  const lines = String(text || "").split("\n");
  if (!lexicalMode) {
    return lines.map((line) => escapeHtml(line)).join("<br>");
  }

  return lines
    .map((line) =>
      line
        ? `<p dir="ltr"><span data-lexical-text="true">${escapeHtml(line)}</span></p>`
        : '<p dir="ltr"><br></p>',
    )
    .join("");
}

function normalizeComposerText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fillLexicalComposer(composer, normalized) {
  const editor = composer?.__lexicalEditor;
  if (!editor || typeof editor.update !== "function") return false;

  const ParagraphNode =
    editor._nodes?.get?.("bidi-paragraph")?.klass ||
    editor._nodes?.get?.("paragraph")?.klass;
  const TextNode = editor._nodes?.get?.("text")?.klass;
  const LineBreakNode = editor._nodes?.get?.("linebreak")?.klass;

  if (!ParagraphNode || !TextNode) return false;

  let applied = false;
  editor.update(() => {
    const root = editor.getEditorState()?._nodeMap?.get?.("root")?.getWritable?.();
    if (!root) return;

    root.clear();
    const paragraph = new ParagraphNode();
    const lines = normalized.split("\n");

    lines.forEach((line, index) => {
      if (line) {
        paragraph.append(new TextNode(line));
      }
      if (index < lines.length - 1 && LineBreakNode) {
        paragraph.append(new LineBreakNode());
      }
    });

    if (!paragraph.getChildrenSize?.()) {
      paragraph.append(new TextNode(""));
    }

    root.append(paragraph);
    paragraph.selectEnd();
    applied = true;
  }, { discrete: true });

  if (!applied) return false;
  let currentText = "";
  editor.getEditorState().read(() => {
    currentText = normalizeComposerText(
      editor.getEditorState()?._nodeMap?.get?.("root")?.getTextContent?.() || "",
    );
  });
  return currentText === normalized;
}

function clearComposer(composer) {
  if (!(composer instanceof Element)) return;
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composer);
  selection?.removeAllRanges();
  selection?.addRange(range);
  try {
    document.execCommand("delete");
  } catch {
    // fallback below
  }
  composer.textContent = "";
  composer.innerHTML = "";
  composer.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "deleteContentBackward",
      data: null,
    }),
  );
  composer.dispatchEvent(new Event("change", { bubbles: true }));
  setComposerSelection(composer, true);
}

function resolveClickable(target) {
  if (!(target instanceof Element)) return null;
  return (
    target.closest?.("button, [role='button'], [role='menuitem']") ||
    (target.matches?.("button, [role='button'], [role='menuitem']") ? target : null)
  );
}

function clickElement(target) {
  const clickable = resolveClickable(target);
  if (!(clickable instanceof HTMLElement)) return false;

  clickable.scrollIntoView?.({ block: "center", inline: "center" });
  clickable.focus?.();
  try {
    clickable.click();
  } catch {
    clickable.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      composed: true,
    }));
  }
  return true;
}

function fillComposer(composer, draftText) {
  const normalized = normalizeComposerText(draftText);
  if (!normalized || !composer) return false;

  if (readComposerText(composer) === normalized) return true;

  if (composer.getAttribute("data-lexical-editor") === "true") {
    return fillLexicalComposer(composer, normalized);
  }

  composer.focus();
  clearComposer(composer);
  setComposerSelection(composer, true);

  let inserted = false;
  try {
    inserted = document.execCommand("insertText", false, normalized);
  } catch {
    inserted = false;
  }

  if (!inserted || readComposerText(composer) !== normalized) {
    const lexicalMode = composer.getAttribute("data-lexical-editor") === "true";
    composer.innerHTML = buildComposerHtml(normalized, lexicalMode);
  }

  composer.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: normalized,
    }),
  );
  composer.dispatchEvent(new Event("change", { bubbles: true }));

  if (readComposerText(composer) !== normalized) {
    composer.textContent = normalized;
    composer.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: normalized,
      }),
    );
    composer.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return readComposerText(composer) === normalized;
}

function clickSend(selectorPack) {
  const button = findSendButton(selectorPack);
  if (!button) return false;
  return clickElement(button);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitFor(fn, timeoutMs = 12000, intervalMs = 250) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = fn();
    if (result) return result;
    await wait(intervalMs);
  }
  return null;
}

function assignFilesToInput(input, files) {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  input.files = dataTransfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function fetchMediaFile(url, extensionSessionToken) {
  const headers = new Headers();
  const token = String(extensionSessionToken ?? "").trim();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-extension-session-token", token);
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No fue posible descargar la imagen de la campaña.");
  }

  const blob = await response.blob();
  const contentType = blob.type || response.headers.get("content-type") || "application/octet-stream";
  const extension =
    contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : "jpg";

  return new File([blob], `campaign-media.${extension}`, { type: contentType });
}

async function attachMedia(selectorPack, mediaUrl, extensionSessionToken) {
  if (!mediaUrl) return false;

  const attachButton = findAttachButton(selectorPack);
  if (!clickElement(attachButton)) {
    throw new Error("No fue posible abrir el menú de adjuntos en WhatsApp Web.");
  }
  await wait(350);

  const menuOptions = await waitFor(
    () => Array.from(document.querySelectorAll("[role='menuitem'], [data-animate-dropdown-item='true']")).filter((node) => isVisible(node)),
    6000,
    200,
  );
  const mediaOption = menuOptions?.[1] || null;
  if (!clickElement(mediaOption)) {
    throw new Error("No fue posible seleccionar la opción de imagen en WhatsApp Web.");
  }
  await wait(300);

  const fileInput = await waitFor(() => findFileInput(selectorPack), 10000, 300);
  if (!(fileInput instanceof HTMLInputElement)) {
    throw new Error("No fue posible encontrar el input de adjuntos en WhatsApp Web.");
  }

  const file = await fetchMediaFile(mediaUrl, extensionSessionToken);
  assignFilesToInput(fileInput, [file]);
  const preview = await waitFor(
    () => document.querySelector("div[role='dialog'], div[data-testid='media-viewer'], div[data-animate-modal-body='true']"),
    12000,
    250,
  );
  if (!preview) {
    throw new Error("No se detectó un preview válido para la imagen en WhatsApp Web.");
  }

  await wait(1200);
  return true;
}

function detectInvalidPhoneMessage() {
  const bodyText = document.body?.innerText?.toLowerCase?.() || "";
  const patterns = [
    "phone number shared via url is invalid",
    "número de teléfono compartido mediante la url no es válido",
    "número de teléfono compartido a través de la url es inválido",
    "el número de teléfono compartido",
    "no está en whatsapp",
    "no esta en whatsapp",
    "not on whatsapp",
  ];
  return patterns.some((pattern) => bodyText.includes(pattern));
}

async function getPendingDraft() {
  const stored = await chrome.storage.local.get([PENDING_DRAFT_KEY]);
  return stored?.[PENDING_DRAFT_KEY] ?? null;
}

async function clearPendingDraft() {
  awaitingChatNotified = false;
  await chrome.storage.local.remove([PENDING_DRAFT_KEY]);
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver(() => {
    void applyPendingDraft();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function stopObserver() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
}

async function notifyBackground(payload) {
  try {
    await chrome.runtime.sendMessage(payload);
  } catch {
    // Ignore background notification failures.
  }
}

async function applyPendingDraft() {
  if (applyingDraft) return { ok: true, applied: false };
  applyingDraft = true;
  try {
    const pending = await getPendingDraft();
    if (!pending?.draftText) return { ok: false, applied: false };

    const composer = findComposer(pending.selectorPack);
  if (!composer) {
    startObserver();
    if (!awaitingChatNotified) {
      awaitingChatNotified = true;
      await notifyBackground({
        type: "RECALC_WHATSAPP_DRAFT_STATUS",
        appBaseUrl: pending.appBaseUrl ?? null,
        extensionSessionToken: pending.extensionSessionToken ?? null,
        runId: pending.runId ?? null,
        eventType: "whatsapp_draft_waiting",
        message:
          "WhatsApp está abierto pero todavía no hay un chat activo. Abre un chat para insertar el borrador.",
        metaJson: {
          source: "content_script",
        },
      });
    }
      return { ok: true, applied: false };
    }

    const applied = fillComposer(composer, pending.draftText);
    if (!applied) {
      return { ok: false, applied: false };
    }

    stopObserver();
    await clearPendingDraft();
    await notifyBackground({
      type: "RECALC_WHATSAPP_DRAFT_STATUS",
      appBaseUrl: pending.appBaseUrl ?? null,
      extensionSessionToken: pending.extensionSessionToken ?? null,
      runId: pending.runId ?? null,
      eventType: "whatsapp_draft_applied",
      message: "El borrador quedó pegado una sola vez en el composer de WhatsApp Web.",
      metaJson: {
        source: "content_script",
      },
    });
    return { ok: true, applied: true };
  } finally {
    applyingDraft = false;
  }
}

async function automateRecipient(payload) {
  const recipient = payload?.recipient ?? null;
  const selectorPack = payload?.selectorPack ?? null;
  if (!recipient?.id) {
    return { ok: false, error: "No llegó un destinatario válido para automatizar." };
  }

  const readyState = await waitFor(() => {
    if (detectInvalidPhoneMessage()) return { invalid: true };
    const composer = findComposer(selectorPack);
    const attachButton = findAttachButton(selectorPack);
    const ready = composer || attachButton || findConversationReady(selectorPack);
    if (!ready) return null;
    if (!composer && !attachButton) return null;
    return { invalid: false, ready };
  }, 15000, 350);

  if (readyState?.invalid) {
    return { ok: false, error: "WhatsApp marcó el número como inválido o no disponible." };
  }

  if (!readyState?.ready) {
    return { ok: false, error: "No fue posible preparar el chat de WhatsApp Web." };
  }

  if (recipient.mediaDownloadUrl) {
    await attachMedia(selectorPack, recipient.mediaDownloadUrl, payload?.extensionSessionToken ?? null);
    const captionComposer = await waitFor(() => findCaptionComposer(selectorPack), 8000, 250);
    let captionApplied = false;
    if (captionComposer && recipient.resolvedMessage) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        captionApplied = fillComposer(captionComposer, recipient.resolvedMessage);
        await wait(450);
        if (captionApplied && readComposerText(captionComposer) === recipient.resolvedMessage) {
          break;
        }
        captionApplied = false;
        await wait(250);
      }
    }

    const sentMedia = clickSend(selectorPack);
    if (!sentMedia) {
      return { ok: false, error: "No fue posible enviar el adjunto en WhatsApp Web." };
    }

    if ((!captionComposer || !captionApplied) && recipient.resolvedMessage) {
      console.warn(
        "[ReCalc][WA] La imagen fue enviada, pero no se confirmó el caption. Se omite fallback de texto para evitar duplicados.",
      );
    }

    return { ok: true, messageDelayMs: recipient.messageDelayMs ?? 4000 };
  }

  if (!recipient.resolvedMessage) {
    return { ok: false, error: "La campaña no tiene contenido para enviar." };
  }

  const composer = await waitFor(() => findComposer(selectorPack), 15000, 350);
  if (!composer) {
    if (detectInvalidPhoneMessage()) {
      return { ok: false, error: "WhatsApp marcó el número como inválido o no disponible." };
    }
    return { ok: false, error: "No fue posible encontrar el composer de WhatsApp Web." };
  }

  if (!fillComposer(composer, recipient.resolvedMessage || "")) {
    return { ok: false, error: "No fue posible escribir el template en el composer." };
  }

  await wait(250);
  if (!clickSend(selectorPack)) {
    return { ok: false, error: "No fue posible pulsar el botón de enviar." };
  }

  return { ok: true, messageDelayMs: recipient.messageDelayMs ?? 4000 };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "RECALC_APPLY_WHATSAPP_DRAFT") {
    void applyPendingDraft().then((result) => sendResponse(result));
    return true;
  }

  if (message?.type === "RECALC_AUTOMATION_SEND_RECIPIENT") {
    void automateRecipient(message)
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Falló la automatización del destinatario.",
        });
      });
    return true;
  }

  return undefined;
});

void applyPendingDraft();
