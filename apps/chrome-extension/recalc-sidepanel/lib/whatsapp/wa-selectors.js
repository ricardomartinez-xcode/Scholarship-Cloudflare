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
        "div[role='button'][aria-label='Enviar'], div[role='button'][aria-label='Send'], button[aria-label='Enviar'], button[aria-label='Send'], [data-icon='send-i'], span[data-icon='wds-ic-send-filled'], span[data-icon='send-filled'], span[data-icon='send']",
      attachButton:
        "button[title*='Adjuntar'], button[title*='Attach'], button[aria-label*='Adjuntar'], button[aria-label*='Attach'], span[data-icon='plus-i'], span[data-icon='plus'], span[data-icon='plus-rounded']",
      mediaCaptionInput:
        "div[contenteditable='true'][role='textbox'][aria-label*='Escribir un mensaje para'], div[contenteditable='true'][role='textbox'][aria-label*='Write a message for'], div[contenteditable='true'][role='textbox'][data-tab='10'], div[contenteditable='true'][role='textbox'][data-tab='6']",
      conversationReady:
        "header, div[data-testid='conversation-panel-wrapper'], main[role='main']",
      previewModal:
        "div[role='button'][aria-label='Quitar archivo adjunto'], div[role='button'][aria-label='Remove attached file']",
      fileInput: "input[type='file']",
    },
  };

  function normalizeSelectorPack(pack) {
    const selectors = pack && typeof pack === "object" && typeof pack.selectors === "object"
      ? pack.selectors
      : {};
    return {
      selectors: {
        ...DEFAULT_SELECTOR_PACK.selectors,
        ...selectors,
      },
    };
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
    const target = firstVisible(getSelector("attachButton", pack));
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

    return firstVisible(getSelector("previewModal", pack));
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

  function scoreAttachmentInput(input, kind) {
    const accept = String(input?.accept || "").toLowerCase();
    const multiple = Boolean(input?.multiple);

    if (kind === "media") {
      let score = 0;
      if (accept.includes("image")) score += 3;
      if (accept.includes("video")) score += 6;
      if (accept.includes("audio")) score -= 4;
      if (multiple) score += 4;
      // WhatsApp deja un input image/* que abre Sticker Maker; penalizarlo cuando exista
      // otra opción más parecida al flujo real de Fotos y videos.
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

    if (kind === "media") {
      const viableMediaInputs = sorted.filter(({ input, score }) => {
        const accept = String(input?.accept || "").toLowerCase().trim();
        const multiple = Boolean(input?.multiple);

        if (accept.includes("video")) return true;
        if (multiple && accept.includes("image")) return true;
        return score >= 4;
      });

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
        !imageInputsByDom[0].multiple
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

      if (fallbackAccept === "image/*" && !fallbackMultiple && !hasMediaMenuOption) {
        return null;
      }

      return imageFallback;
    }

    return sorted[0]?.input || null;
  }

  function findAttachmentOption(kind) {
    const needles = kind === "document"
      ? ["document", "documento", "archivo", "file"]
      : ["photos & videos", "photos and videos", "fotos y videos", "photos", "videos", "fotos"];

    const candidates = Array.from(
      document.querySelectorAll("[role='menuitem'], [role='button'], button, li, div[aria-label], div[title]"),
    ).filter((node) => isVisible(node));

    return candidates.find((node) => isVisible(node) && matchAnyText(node, needles)) || null;
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
    findAttachmentOption,
    findAttachmentMenuOptions,
    findAttachmentOptionByPosition,
  };
})(typeof self !== "undefined" ? self : window);
