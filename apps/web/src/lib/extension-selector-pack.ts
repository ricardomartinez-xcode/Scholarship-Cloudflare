export type ExtensionSelectorPack = {
  version: string;
  channel: string;
  selectors: {
    searchBox: string;
    messageInput: string;
    sendButton: string;
    attachButton: string;
    fileInput: string;
    mediaCaptionInput: string;
    conversationReady: string;
  };
};

export const DEFAULT_EXTENSION_SELECTOR_PACK: ExtensionSelectorPack = {
  version: "waweb-2026.06.18-media-caption-03",
  channel: "compatible",
  selectors: {
    searchBox:
      "div[role='textbox'][contenteditable='true'][data-tab], div[contenteditable='true'][data-tab='3']",
    messageInput:
      "footer div[contenteditable='true'][role='textbox'], footer div[contenteditable='true']",
    sendButton:
      "button[aria-label='Enviar'], button[aria-label='Send'], button[aria-label^='Enviar'][aria-label*='seleccionado'], button[aria-label^='Send'][aria-label*='selected'], div[role='button'][aria-label^='Enviar'][aria-label*='seleccionado'], div[role='button'][aria-label^='Send'][aria-label*='selected'], span[data-icon='wds-ic-send-filled'], span[data-icon='send-filled'], span[data-icon='send']",
    attachButton:
      "button[title*='Adjuntar'], button[title*='Attach'], button[aria-label*='Adjuntar'], button[aria-label*='Attach'], span[data-icon='plus'], span[data-icon='plus-rounded']",
    fileInput:
      "input[type='file'][accept*='video'], input[type='file'][accept*='image'][multiple], input[type='file'][accept*='image'], input[type='file']",
    mediaCaptionInput:
      "div[data-testid='media-caption-input-container'][contenteditable='true'], div[contenteditable='true'][role='textbox'][data-testid='media-caption-input-container'], div[contenteditable='true'][role='textbox'][aria-placeholder='Escribe un mensaje'], div[contenteditable='true'][role='textbox'][aria-label='Escribe un mensaje'], div[contenteditable='true'][role='textbox'][aria-label*='Escribir un mensaje para'], div[contenteditable='true'][role='textbox'][aria-label*='Write a message for'], div[contenteditable='true'][role='textbox'][data-tab='10'], div[contenteditable='true'][role='textbox'][data-tab='6'], div[contenteditable='true'][role='textbox'][data-tab='undefined'], div[contenteditable='true'][role='textbox']",
    conversationReady:
      "header, div[data-testid='conversation-panel-wrapper'], main[role='main']",
  },
};

function normalizeText(value: unknown, fallback: string) {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function mergeSelector(defaultSelector: string, overrideSelector: unknown) {
  const pieces = [
    String(overrideSelector ?? "").trim(),
    String(defaultSelector ?? "").trim(),
  ].filter(Boolean);

  return pieces
    .join(", ")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .join(", ");
}

export function normalizeExtensionSelectorPack(
  value: unknown,
): ExtensionSelectorPack {
  const source =
    typeof value === "object" && value !== null
      ? (value as Partial<ExtensionSelectorPack>)
      : {};

  const selectors =
    typeof source.selectors === "object" && source.selectors !== null
      ? source.selectors
      : {};

  return {
    version: normalizeText(
      source.version,
      DEFAULT_EXTENSION_SELECTOR_PACK.version,
    ),
    channel: normalizeText(
      source.channel,
      DEFAULT_EXTENSION_SELECTOR_PACK.channel,
    ),
    selectors: {
      searchBox: mergeSelector(
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.searchBox,
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).searchBox,
      ),
      messageInput: mergeSelector(
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.messageInput,
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).messageInput,
      ),
      sendButton: mergeSelector(
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.sendButton,
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).sendButton,
      ),
      attachButton: mergeSelector(
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.attachButton,
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).attachButton,
      ),
      fileInput: mergeSelector(
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.fileInput,
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).fileInput,
      ),
      mediaCaptionInput: mergeSelector(
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.mediaCaptionInput,
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).mediaCaptionInput,
      ),
      conversationReady: mergeSelector(
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.conversationReady,
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).conversationReady,
      ),
    },
  };
}

export function parseExtensionSelectorPackJson(
  rawValue: string | null | undefined,
) {
  const normalized = String(rawValue ?? "").trim();
  if (!normalized) {
    return {
      ok: true as const,
      value: DEFAULT_EXTENSION_SELECTOR_PACK,
    };
  }

  try {
    return {
      ok: true as const,
      value: normalizeExtensionSelectorPack(JSON.parse(normalized)),
    };
  } catch {
    return {
      ok: false as const,
      error:
        "El selector pack no es JSON válido. Revisa llaves, comillas y comas.",
    };
  }
}

export function serializeExtensionSelectorPack(
  pack: ExtensionSelectorPack,
) {
  return JSON.stringify(normalizeExtensionSelectorPack(pack), null, 2);
}
