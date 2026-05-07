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
  version: "waweb-2026.03.25-automation-01",
  channel: "compatible",
  selectors: {
    searchBox:
      "div[role='textbox'][contenteditable='true'][data-tab], div[contenteditable='true'][data-tab='3']",
    messageInput:
      "footer div[contenteditable='true'][role='textbox'], footer div[contenteditable='true']",
    sendButton:
      "button[aria-label='Enviar'], button[aria-label='Send'], span[data-icon='send']",
    attachButton:
      "button[title*='Adjuntar'], button[title*='Attach'], button[aria-label*='Adjuntar'], button[aria-label*='Attach'], span[data-icon='plus'], span[data-icon='plus-rounded']",
    fileInput:
      "input[type='file'][accept*='image'], input[type='file'][accept*='video'], input[type='file']",
    mediaCaptionInput:
      "div[contenteditable='true'][role='textbox'][data-tab='10'], div[contenteditable='true'][role='textbox'][data-tab='6'], div[contenteditable='true'][role='textbox']",
    conversationReady:
      "header, div[data-testid='conversation-panel-wrapper'], main[role='main']",
  },
};

function normalizeText(value: unknown, fallback: string) {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
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
      searchBox: normalizeText(
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).searchBox,
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.searchBox,
      ),
      messageInput: normalizeText(
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).messageInput,
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.messageInput,
      ),
      sendButton: normalizeText(
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).sendButton,
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.sendButton,
      ),
      attachButton: normalizeText(
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).attachButton,
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.attachButton,
      ),
      fileInput: normalizeText(
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).fileInput,
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.fileInput,
      ),
      mediaCaptionInput: normalizeText(
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).mediaCaptionInput,
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.mediaCaptionInput,
      ),
      conversationReady: normalizeText(
        (selectors as Partial<ExtensionSelectorPack["selectors"]>).conversationReady,
        DEFAULT_EXTENSION_SELECTOR_PACK.selectors.conversationReady,
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
