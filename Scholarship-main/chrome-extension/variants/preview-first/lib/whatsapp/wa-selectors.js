(function attachRecalcWaSelectors(globalScope) {
  const DEFAULT_SELECTOR_PACK = {
    selectors: {
      // Estos selectores siguen siendo sensibles a cambios de WhatsApp Web,
      // pero ahora se fusionan con cualquier selector remoto para evitar que
      // el backend sobrescriba selectores locales más actualizados.
      searchBox:
        "div[role='textbox'][contenteditable='true'][data-tab], div[contenteditable='true'][data-tab='3']",

      messageInput:
        "footer div[contenteditable='true'][role='textbox'], footer div[contenteditable='true'], div[role='textbox'][contenteditable='true'][aria-label='Escribir un mensaje'], div[role='textbox'][contenteditable='true'][aria-label='Write a message']",

      sendButton:
        "div[role='button'][aria-label='Enviar'], div[role='button'][aria-label='Send'], button[aria-label='Enviar'], button[aria-label='Send'], span[data-icon='wds-ic-send-filled'], span[data-testid='wds-ic-send-filled'], span[data-icon='send-filled'], span[data-icon='send']",

      attachButton:
        "button[aria-label='Adjuntar'], button[aria-label='Attach'], [role='button'][aria-label='Adjuntar'], [role='button'][aria-label='Attach'], button[aria-label*='Adjuntar'], button[aria-label*='Attach'], [role='button'][aria-label*='Adjuntar'], [role='button'][aria-label*='Attach'], button[title*='Adjuntar'], button[title*='Attach'], span[data-testid='plus-rounded'], span[data-icon='plus-rounded'], span[data-icon='plus']",

      mediaCaptionInput:
        "div[contenteditable='true'][role='textbox'][aria-label*='Escribir un mensaje para'], div[contenteditable='true'][role='textbox'][aria-label*='Write a message for'], div[contenteditable='true'][role='textbox'][data-tab='10'], div[contenteditable='true'][role='textbox'][data-tab='6'], p.copyable-text",

      conversationReady:
        "header, div[data-testid='conversation-panel-wrapper'], main[role='main']",

      previewModal:
        "div[role='dialog'], div[data-testid='media-viewer'], div[data-animate-modal-body='true'], div[role='button'][aria-label='Quitar archivo adjunto'], div[role='button'][aria-label='Remove attached file'], div[role='button'][aria-label*='Send'][aria-label*='selected'], div[role='button'][aria-label*='Enviar'][aria-label*='seleccionado']",

      fileInput:
        "input[type='file']",
    },
  };

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
    const selectors =
      pack && typeof pack === "object" && typeof pack.selectors === "object"
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

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function firstVisible(selectors) {
    for (const selector of parseSelectorList(selectors)) {
      let nodes = [];

      try {
        nodes = Array.from(document.querySelectorAll(selector));
      } catch {
        continue;
      }

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

  function matchAnyText(node, needles) {
    const haystack = [
      node?.getAttribute?.("aria-label"),
      node?.getAttribute?.("title"),
      node?.textContent,
      node?.innerText,
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
      .join(" ");

    return needles.some((needle) =>
      haystack.includes(String(needle).trim().toLowerCase()),
    );
  }

  function firstVisibleWithin(root, selectors) {
    if (!(root instanceof Element)) return null;

    for (const selector of parseSelectorList(selectors)) {
      let nodes = [];

      try {
        nodes = Array.from(root.querySelectorAll(selector));
      } catch {
        continue;
      }

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
    return (
      firstVisibleInFooter(getSelector("messageInput", pack)) ||
      firstVisible(getSelector("messageInput", pack))
    );
  }

  function findSendButton(pack) {
    return (
      firstVisibleInFooter(getSelector("sendButton", pack)) ||
      firstVisible(getSelector("sendButton", pack))
    );
  }

  function findAttachButton(pack) {
    const fromSelectors = firstVisible(getSelector("attachButton", pack));

    if (fromSelectors) {
      const clickable =
        fromSelectors.closest?.("button, [role='button']") ||
        fromSelectors;

      if (clickable instanceof Element && isVisible(clickable)) {
        return clickable;
      }
    }

    const candidates = Array.from(
      document.querySelectorAll("button, [role='button']"),
    )
      .filter((node) => isVisible(node))
      .filter((node) => {
        const icon = node.querySelector(
          "[data-icon='plus-rounded'], [data-testid='plus-rounded'], [data-icon='plus']",
        );

        const label = String(
          node.getAttribute("aria-label") ||
            node.getAttribute("title") ||
            node.textContent ||
            "",
        ).toLowerCase();

        return (
          icon ||
          label.includes("adjuntar") ||
          label.includes("attach")
        );
      });

    return candidates[0] || null;
  }

  function findConversationReady(pack) {
    return firstVisible(getSelector("conversationReady", pack));
  }

  function findPreviewModal(pack) {
    const selectors = getSelector("previewModal", pack);
    const found = firstVisible(selectors);
    if (found) return found;

    const sendSelectedButton = Array.from(
      document.querySelectorAll("button, [role='button']"),
    ).find((node) => {
      if (!isVisible(node)) return false;

      const label = String(
        node.getAttribute("aria-label") ||
          node.getAttribute("title") ||
          node.textContent ||
          "",
      ).toLowerCase();

      return (
        label.includes("send") && label.includes("selected")
      ) || (
        label.includes("enviar") && label.includes("seleccion")
      );
    });

    return sendSelectedButton || null;
  }

  function findCaptionInput(pack) {
    const modal = findPreviewModal(pack);
    if (!(modal instanceof Element)) return null;

    const selectorsToTry = parseSelectorList(getSelector("mediaCaptionInput", pack));

    for (const selector of selectorsToTry) {
      let nodes = [];

      try {
        nodes = Array.from(document.querySelectorAll(selector));
      } catch {
        continue;
      }

      const visible = nodes.find((node) => isVisible(node));
      if (visible) return visible;
      if (nodes[0]) return nodes[0];
    }

    return null;
  }

  function allFileInputs(pack) {
    return Array.from(document.querySelectorAll(getSelector("fileInput", pack)))
      .filter((node) => node instanceof HTMLInputElement);
  }

  function scoreAttachmentInput(input, kind) {
    const accept = String(input?.accept || "").toLowerCase();
    const multiple = Boolean(input?.multiple);

    if (kind === "media") {
      let score = 0;

      if (accept.includes("image")) score += 3;
      if (accept.includes("video")) score += 6;
      if (accept.includes("audio")) score -= 4;
      if (multiple) score += 4;

      // WhatsApp deja un input image/* que puede abrir Sticker Maker.
      // Lo penalizamos cuando no es múltiple para preferir Fotos y Videos.
      if (accept === "image/*" && !multiple) score -= 6;

      return score;
    }

    let score = 0;

    if (!accept) score += 1;
    if (accept.includes("application")) score += 2;
    if (accept.includes("pdf")) score += 2;
    if (accept.includes("*")) score += 1;

    return score;
  }

  function findAttachmentInput(kind, pack) {
    const inputs = allFileInputs(pack).filter((input) => !input.disabled);

    const sorted = inputs
      .map((input) => ({ input, score: scoreAttachmentInput(input, kind) }))
      .sort((a, b) => b.score - a.score);

    return sorted[0]?.input || null;
  }

  function findPreviewSendButton(pack) {
    const previewAnchor = findPreviewModal(pack);
    if (!(previewAnchor instanceof Element)) return null;

    const previewSpecificSelectors = [
      "div[role='button'][aria-label='Send 1 selected']",
      "div[role='button'][aria-label*='Send'][aria-label*='selected']",
      "div[role='button'][aria-label*='Enviar'][aria-label*='seleccionado']",
      "button[aria-label*='Send'][aria-label*='selected']",
      "button[aria-label*='Enviar'][aria-label*='seleccionado']",
      "span[data-icon='wds-ic-send-filled']",
      "span[data-testid='wds-ic-send-filled']",
      "span[data-icon='send-filled']",
      "div[role='button'][aria-label='Enviar']",
      "div[role='button'][aria-label='Send']",
      "button[aria-label='Enviar']",
      "button[aria-label='Send']",
    ];

    for (const selector of previewSpecificSelectors) {
      let nodes = [];

      try {
        nodes = Array.from(document.querySelectorAll(selector));
      } catch {
        continue;
      }

      const normalized = nodes
        .map((node) => node.closest?.("button, [role='button']") || node)
        .filter((node, index, list) => node && list.indexOf(node) === index);

      const visible = normalized.find((node) => isVisible(node));
      const previewScoped = [visible, ...normalized]
        .filter(Boolean)
        .find((node) => node instanceof Element && !node.closest("footer"));

      if (previewScoped) return previewScoped;
    }

    const buttons = Array.from(document.querySelectorAll("button, [role='button']"))
      .filter((node) => isVisible(node))
      .filter((node) => !node.closest("footer"))
      .filter((node) => {
        const icon = node.querySelector(
          "[data-icon='wds-ic-send-filled'], [data-testid='wds-ic-send-filled'], [data-icon='send-filled'], [data-icon='send']",
        );

        const label = String(
          node.getAttribute("aria-label") ||
            node.getAttribute("title") ||
            node.textContent ||
            "",
        ).toLowerCase();

        return (
          icon ||
          (label.includes("send") && label.includes("selected")) ||
          (label.includes("enviar") && label.includes("seleccion"))
        );
      });

    return buttons[0] || null;
  }

  function findAttachmentOption(kind) {
    const needles =
      kind === "document"
        ? ["document", "documento", "archivo", "file"]
        : [
            "photos & videos",
            "photos and videos",
            "fotos y videos",
            "foto y video",
            "photos",
            "videos",
            "fotos",
          ];

    const candidates = Array.from(
      document.querySelectorAll(
        "[role='menuitem'], [role='button'], button, li, div[aria-label], div[title], div",
      ),
    ).filter((node) => isVisible(node));

    return candidates.find((node) => matchAnyText(node, needles)) || null;
  }

  function findAttachmentMenuOptions() {
    const candidates = Array.from(
      document.querySelectorAll(
        "[role='menuitem'], [data-animate-dropdown-item='true'], li [role='button'], li button, [role='button']",
      ),
    )
      .filter((node) => isVisible(node))
      .map((node) =>
        node.closest?.("[role='menuitem'], button, [role='button'], li") ||
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
    findMessageInput,
    findSendButton,
    findPreviewSendButton,
    findAttachButton,
    findConversationReady,
    findPreviewModal,
    findCaptionInput,
    findAttachmentInput,
    findAttachmentOption,
    findAttachmentMenuOptions,
    findAttachmentOptionByPosition,
  };
})(typeof self !== "undefined" ? self : window);
