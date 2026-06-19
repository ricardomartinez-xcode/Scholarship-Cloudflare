(function attachRecalcWaSelectors(globalScope) {
  const DEFAULT_SELECTOR_PACK = {
    selectors: {
      // Estos selectores siguen siendo sensibles a cambios de WhatsApp Web,
      // pero se usan solo como punto de partida antes de aplicar fallbacks por texto/atributos.
      searchBox:
        "div[role='textbox'][contenteditable='true'][data-tab], div[contenteditable='true'][data-tab='3']",
      messageInput:
        "footer div[contenteditable='true'][role='textbox'], footer div[contenteditable='true'], div[role='textbox'][contenteditable='true'][aria-label='Escribir un mensaje'], div[role='textbox'][contenteditable='true'][aria-label='Write a message']",
      sendButton:
        "div[role='button'][aria-label='Enviar'], div[role='button'][aria-label='Send'], div[role='button'][aria-label^='Enviar'][aria-label*='seleccionado'], div[role='button'][aria-label^='Send'][aria-label*='selected'], button[aria-label='Enviar'], button[aria-label='Send'], button[aria-label^='Enviar'][aria-label*='seleccionado'], button[aria-label^='Send'][aria-label*='selected'], [data-icon='send-i'], span[data-icon='wds-ic-send-filled'], span[data-icon='send-filled'], span[data-icon='send']",
      attachButton:
        "button[title*='Adjuntar'], button[title*='Attach'], button[aria-label*='Adjuntar'], button[aria-label*='Attach'], span[data-icon='plus-i'], span[data-icon='plus'], span[data-icon='plus-rounded']",
      mediaCaptionInput:
        "div[data-testid='media-caption-input-container'][contenteditable='true'], div[contenteditable='true'][role='textbox'][data-testid='media-caption-input-container'], div[contenteditable='true'][role='textbox'][aria-placeholder='Escribe un mensaje'], div[contenteditable='true'][role='textbox'][aria-label='Escribe un mensaje'], div[contenteditable='true'][role='textbox'][aria-label*='Escribir un mensaje para'], div[contenteditable='true'][role='textbox'][aria-label*='Write a message for'], div[contenteditable='true'][role='textbox'][data-tab='10'], div[contenteditable='true'][role='textbox'][data-tab='6'], div[contenteditable='true'][role='textbox'][data-tab='undefined']",
      conversationReady:
        "header, div[data-testid='conversation-panel-wrapper'], main[role='main']",
      previewModal:
        "div[role='button'][aria-label='Quitar archivo adjunto'], div[role='button'][aria-label='Remove attached file'], div[data-testid='media-caption-input-container'][contenteditable='true'], div[role='button'][aria-label^='Enviar'][aria-label*='seleccionado'], div[role='button'][aria-label^='Send'][aria-label*='selected']",
      fileInput: "input[type='file']",
    },
  };
  const DOCUMENT_ATTACHMENT_NEEDLES = ["document", "documento", "archivo", "file"];
  const MEDIA_ATTACHMENT_NEEDLES = [
    "photos & videos",
    "photos and videos",
    "photo & video",
    "photo and video",
    "fotos y videos",
    "foto y video",
    "fotos",
    "foto",
    "photos",
    "photo",
    "videos",
    "video",
    "imagen",
    "imágenes",
    "imagenes",
    "image",
    "images",
    "picture",
    "pictures",
    "galería",
    "galeria",
    "gallery",
    "ic-filter-filled",
    "filter-filled",
  ];
  const PRIMARY_MEDIA_ATTACHMENT_NEEDLES = [
    "photos & videos",
    "photos and videos",
    "photo & video",
    "photo and video",
    "fotos y videos",
    "foto y video",
  ];
  const STICKER_ATTACHMENT_NEEDLES = [
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

  function mergeSelector(defaultSelector, overrideSelector) {
    const pieces = [
      String(overrideSelector || "").trim(),
      String(defaultSelector || "").trim(),
    ].filter(Boolean);

    return pieces
      .join(", ")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index)
      .join(", ");
  }

  function normalizeSelectorPack(pack) {
    const selectors = pack && typeof pack === "object" && typeof pack.selectors === "object"
      ? pack.selectors
      : {};
    const defaults = DEFAULT_SELECTOR_PACK.selectors;
    const merged = {};

    Object.keys(defaults).forEach((key) => {
      merged[key] = mergeSelector(defaults[key], selectors[key]);
    });

    Object.keys(selectors).forEach((key) => {
      if (!merged[key]) {
        merged[key] = String(selectors[key] || "").trim();
      }
    });

    return { selectors: merged };
  }

  function parseSelectorList(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function isVisible(node) {
    if (!(node instanceof Element)) return false;
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function firstVisible(selectors) {
    for (const selector of parseSelectorList(selectors)) {
      const nodes = Array.from(document.querySelectorAll(selector));
      const visible = nodes.find((node) => isVisible(node));
      if (visible) return visible;
      if (nodes[0]) return nodes[0];
    }
    return null;
  }

  function textContent(node) {
    return String(node?.textContent || node?.innerText || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function resolveClickable(target) {
    if (!(target instanceof Element)) return null;
    return (
      target.closest?.("button, [role='button'], [role='menuitem'], label, [tabindex]") ||
      target
    );
  }

  function accessibleText(node) {
    if (!(node instanceof Element)) return "";
    const parts = [
      node.getAttribute?.("aria-label"),
      node.getAttribute?.("title"),
      node.getAttribute?.("data-icon"),
      node.textContent,
      node.innerText,
    ];

    try {
      node.querySelectorAll?.("[aria-label], [title], [data-icon], title")?.forEach((child) => {
        parts.push(
          child.getAttribute?.("aria-label"),
          child.getAttribute?.("title"),
          child.getAttribute?.("data-icon"),
          child.textContent,
          child.innerText,
        );
      });
    } catch {
      // Some DOM shims used by tests do not implement full selector parsing.
    }

    return parts
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
      .join(" ");
  }

  function matchAnyText(node, needles) {
    const haystack = accessibleText(node);

    return needles.some((needle) => haystack.includes(String(needle).trim().toLowerCase()));
  }

  function isStickerLikeAttachmentOption(node) {
    return matchAnyText(node, STICKER_ATTACHMENT_NEEDLES);
  }

  function scoreMediaAttachmentOption(node) {
    if (isStickerLikeAttachmentOption(node) || !matchAnyText(node, MEDIA_ATTACHMENT_NEEDLES)) {
      return 0;
    }

    const haystack = accessibleText(node);
    let score = 1;
    if (PRIMARY_MEDIA_ATTACHMENT_NEEDLES.some((needle) => haystack.includes(needle))) score += 20;
    if (haystack.includes("video")) score += 4;
    if (
      haystack.includes("foto") ||
      haystack.includes("photo") ||
      haystack.includes("imagen") ||
      haystack.includes("image")
    ) {
      score += 3;
    }
    return score;
  }

  function firstVisibleWithin(root, selectors) {
    if (!(root instanceof Element)) return null;
    for (const selector of parseSelectorList(selectors)) {
      const nodes = Array.from(root.querySelectorAll(selector));
      const visible = nodes.find((node) => isVisible(node));
      if (visible) return visible;
      if (nodes[0]) return nodes[0];
    }
    return null;
  }

  function getSelector(name, pack) {
    return normalizeSelectorPack(pack).selectors[name];
  }

  function firstVisibleInFooter(selectors) {
    const footer = document.querySelector("footer");
    return footer ? firstVisibleWithin(footer, selectors) : null;
  }

  function findMessageInput(pack) {
    return firstVisibleInFooter(getSelector("messageInput", pack)) || firstVisible(getSelector("messageInput", pack));
  }

  function findSendButton(pack) {
    return firstVisibleInFooter(getSelector("sendButton", pack)) || firstVisible(getSelector("sendButton", pack));
  }

  function findPreviewSendButton(pack) {
    const previewAnchor = findPreviewModal(pack);
    if (!(previewAnchor instanceof Element)) return null;

    const previewSpecificSelectors = [
      "div[role='button'][aria-label^='Enviar'][aria-label*='seleccionado']",
      "div[role='button'][aria-label^='Send'][aria-label*='selected']",
      "button[aria-label^='Enviar'][aria-label*='seleccionado']",
      "button[aria-label^='Send'][aria-label*='selected']",
      "span[data-icon='wds-ic-send-filled']",
      "span[data-icon='send-i']",
      "span[data-icon='send-filled']",
      "div[role='button'][aria-label='Enviar']",
      "div[role='button'][aria-label='Send']",
      "button[aria-label='Enviar']",
      "button[aria-label='Send']",
    ];

    for (const selector of previewSpecificSelectors) {
      const nodes = Array.from(document.querySelectorAll(selector))
        .map((node) => node.closest?.("button, [role='button']") || node)
        .filter((node, index, list) => node && list.indexOf(node) === index);
      const visible = nodes.find((node) => isVisible(node));
      const previewScoped = [visible, ...nodes]
        .filter(Boolean)
        .find((node) => node instanceof Element && !node.closest("footer"));
      if (previewScoped) return previewScoped;
    }

    return null;
  }

  function findAttachButton(pack) {
    const target = firstVisibleInFooter(getSelector("attachButton", pack)) || firstVisible(getSelector("attachButton", pack));
    return resolveClickable(target);
  }

  function findConversationReady(pack) {
    return firstVisible(getSelector("conversationReady", pack));
  }

  function findPreviewModal(pack) {
    const removeButton = firstVisible(
      "div[role='button'][aria-label='Quitar archivo adjunto'], div[role='button'][aria-label='Remove attached file']",
    );
    if (removeButton) return removeButton;

    const currentCaption = firstVisible(
      "div[data-testid='media-caption-input-container'][contenteditable='true'], div[contenteditable='true'][role='textbox'][aria-placeholder='Escribe un mensaje']",
    );
    if (currentCaption && !currentCaption.closest?.("footer")) return currentCaption;

    const previewModal = firstVisible(getSelector("previewModal", pack));
    if (previewModal) return previewModal;

    for (const selector of parseSelectorList(getSelector("mediaCaptionInput", pack))) {
      const nodes = Array.from(document.querySelectorAll(selector));
      const previewCaption = nodes.find((node) => node instanceof Element && isVisible(node) && !node.closest?.("footer"));
      if (previewCaption) return previewCaption;
    }

    return null;
  }

  function findCaptionInput(pack) {
    const modal = findPreviewModal(pack);
    if (!(modal instanceof Element)) return null;
    const selectorsToTry = parseSelectorList(getSelector("mediaCaptionInput", pack));

    for (const selector of selectorsToTry) {
      const nodes = Array.from(document.querySelectorAll(selector));
      const visible = nodes.find((node) => isVisible(node));
      if (visible) return visible;
      if (nodes[0]) return nodes[0];
    }
    return null;
  }

  function allFileInputs(pack) {
    return Array.from(document.querySelectorAll(getSelector("fileInput", pack))).filter((node) => node instanceof HTMLInputElement);
  }

  function fileInputsWithin(root, pack) {
    if (!(root instanceof Element)) return [];

    const selector = getSelector("fileInput", pack);
    const inputs = [];
    if (root instanceof HTMLInputElement) {
      inputs.push(root);
    }

    try {
      inputs.push(...Array.from(root.querySelectorAll(selector)));
    } catch {
      // WhatsApp can redraw the attachment menu while it is being inspected.
    }

    return inputs.filter((node, index, list) =>
      node instanceof HTMLInputElement &&
      !node.disabled &&
      list.indexOf(node) === index,
    );
  }

  function nearestAttachmentInputContext(input) {
    if (!(input instanceof Element)) return null;
    return input.closest?.("label, [role='menuitem'], [role='button'], li, button, div[aria-label], div[title]") || null;
  }

  function isStickerLikeAttachmentInput(input) {
    const context = nearestAttachmentInputContext(input);
    return Boolean(context && isStickerLikeAttachmentOption(context));
  }

  function scoreAttachmentInput(input, kind, options = {}) {
    const accept = String(input?.accept || "").toLowerCase();
    const multiple = Boolean(input?.multiple);
    const scopedToMediaOption = Boolean(options.scopedToMediaOption);
    const allowSingleImage = Boolean(options.allowSingleImage);

    if (kind === "media") {
      let score = 0;
      if (accept.includes("image")) score += 3;
      if (accept.includes("video")) score += 6;
      if (accept.includes("audio")) score -= 4;
      if (multiple) score += 4;
      if (isStickerLikeAttachmentInput(input)) score -= 20;
      // WhatsApp deja un input image/* que abre Sticker Maker; penalizarlo cuando exista
      // otra opción más parecida al flujo real de Fotos y videos.
      if (accept === "image/*" && !multiple && !scopedToMediaOption && !allowSingleImage) score -= 6;
      return score;
    }

    let score = 0;
    if (!accept) score += 1;
    if (accept.includes("application")) score += 2;
    if (accept.includes("pdf")) score += 2;
    if (accept.includes("*")) score += 1;
    return score;
  }

  function isViableMediaInput(input, score, options = {}) {
    const accept = String(input?.accept || "").toLowerCase().trim();
    const multiple = Boolean(input?.multiple);
    const scopedToMediaOption = Boolean(options.scopedToMediaOption);
    const allowSingleImage = Boolean(options.allowSingleImage);

    if (isStickerLikeAttachmentInput(input)) return false;
    if (accept.includes("video")) return true;
    if (accept.includes("image") && (multiple || scopedToMediaOption || allowSingleImage)) return true;
    return score >= 4;
  }

  function findAttachmentInputForOption(option, kind, pack) {
    if (!(option instanceof Element)) return null;
    if (kind === "media" && isStickerLikeAttachmentOption(option)) return null;

    const scopedInputs = fileInputsWithin(option, pack);
    const sorted = scopedInputs
      .map((input) => ({
        input,
        score: scoreAttachmentInput(input, kind, { scopedToMediaOption: kind === "media" }),
      }))
      .sort((a, b) => b.score - a.score);

    if (kind === "media") {
      return sorted.find(({ input, score }) =>
        isViableMediaInput(input, score, { scopedToMediaOption: true }),
      )?.input || null;
    }

    return sorted[0]?.input || null;
  }

  function findAttachmentInput(kind, pack, options = {}) {
    const inputs = allFileInputs(pack).filter((input) => !input.disabled);

    const sorted = inputs
      .map((input) => ({ input, score: scoreAttachmentInput(input, kind, options) }))
      .sort((a, b) => b.score - a.score);

    if (kind === "media") {
      const viableMediaInputs = sorted.filter(({ input, score }) => isViableMediaInput(input, score, options));

      if (viableMediaInputs[0]?.input) return viableMediaInputs[0].input;

      // WhatsApp Web can expose only one media input with accept="image/*".
      // Older builds also used a similar single-image input for Sticker Maker,
      // so prefer richer media inputs above but keep this as the safe fallback.
      const imageInputsByDom = inputs.filter((input) => {
        const accept = String(input?.accept || "").toLowerCase().trim();
        return accept.includes("image") && !accept.includes("audio");
      });
      if (
        imageInputsByDom.length > 1 &&
        String(imageInputsByDom[0]?.accept || "").toLowerCase().trim() === "image/*" &&
        !imageInputsByDom[0].multiple &&
        isStickerLikeAttachmentInput(imageInputsByDom[0]) &&
        !isStickerLikeAttachmentInput(imageInputsByDom[1])
      ) {
        return imageInputsByDom[1];
      }

      const imageFallback = sorted.find(({ input }) => {
        const accept = String(input?.accept || "").toLowerCase().trim();
        return accept.includes("image") && !accept.includes("audio");
      })?.input || null;
      const fallbackAccept = String(imageFallback?.accept || "").toLowerCase().trim();
      const fallbackMultiple = Boolean(imageFallback?.multiple);
      const hasMediaMenuOption = Boolean(findAttachmentOption("media") || findAttachmentOptionByPosition(1));

      if (fallbackAccept === "image/*" && !fallbackMultiple && options.allowSingleImage && !isStickerLikeAttachmentInput(imageFallback)) {
        return imageFallback;
      }

      if (fallbackAccept === "image/*" && !fallbackMultiple && !hasMediaMenuOption) {
        return null;
      }

      return imageFallback;
    }

    return sorted[0]?.input || null;
  }

  function findAttachmentOption(kind) {
    const candidates = findAttachmentMenuOptions();

    if (kind === "media") {
      const scored = candidates
        .map((node, index) => ({ node, index, score: scoreMediaAttachmentOption(node) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.node || null;

      if (scored) return scored;

      // WhatsApp puede ocultar el texto accesible del item. En los dumps
      // capturados, Fotos y videos queda como segundo item del popup.
      const positionFallback = candidates[1] || null;
      if (positionFallback && !isStickerLikeAttachmentOption(positionFallback)) {
        return positionFallback;
      }

      return null;
    }

    return candidates.find((node) => matchAnyText(node, DOCUMENT_ATTACHMENT_NEEDLES)) || null;
  }

  function findAttachmentMenuOptions() {
    const candidates = Array.from(
      document.querySelectorAll(
        "[role='menu'] [role='menuitem'], [role='menuitem'], [data-animate-dropdown-item='true'], div[role='application'] li[role='button'], li[role='button'], li [role='button'], li button",
      ),
    )
      .filter((node) => isVisible(node))
      .map((node) =>
        resolveClickable(node.closest?.("[role='menuitem'], button, [role='button'], li") || node) ||
        (node instanceof Element ? node : null),
      )
      .filter(Boolean);

    return candidates.filter((node, index, list) => list.indexOf(node) === index);
  }

  function findAttachmentOptionByPosition(position) {
    return findAttachmentMenuOptions()[position] || null;
  }

  globalScope.RecalcWaSelectors = {
    DEFAULT_SELECTOR_PACK,
    normalizeSelectorPack,
    parseSelectorList,
    isVisible,
    firstVisible,
    textContent,
    matchAnyText,
    resolveClickable,
    findMessageInput,
    findSendButton,
    findPreviewSendButton,
    findAttachButton,
    findConversationReady,
    findPreviewModal,
    findCaptionInput,
    findAttachmentInput,
    findAttachmentInputForOption,
    findAttachmentOption,
    findAttachmentMenuOptions,
    findAttachmentOptionByPosition,
  };
})(typeof self !== "undefined" ? self : window);
