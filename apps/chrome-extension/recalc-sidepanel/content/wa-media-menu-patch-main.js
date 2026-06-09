(function attachRecalcWaMediaMenuPatch(globalScope) {
  const PATCH_VERSION = "2026-06-09.media-caption-v2";
  const TIMER_KEY = "__RECALC_WA_MEDIA_MENU_PATCH_TIMER__";

  function mediaNeedles() {
    return [
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
    ];
  }

  function documentNeedles() {
    return ["document", "documento", "archivo", "file"];
  }

  function stickerNeedles() {
    return [
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
  }

  function fallbackVisible(node) {
    if (!(node instanceof Element)) return false;
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function fallbackAccessibleText(node) {
    if (!(node instanceof Element)) return "";
    const parts = [
      node.getAttribute("aria-label"),
      node.getAttribute("title"),
      node.getAttribute("data-icon"),
      node.textContent,
      node.innerText,
    ];

    try {
      node.querySelectorAll("[aria-label], [title], [data-icon], title").forEach((child) => {
        parts.push(
          child.getAttribute("aria-label"),
          child.getAttribute("title"),
          child.getAttribute("data-icon"),
          child.textContent,
          child.innerText,
        );
      });
    } catch {
      // WhatsApp DOM can change while the menu animates; ignore transient failures.
    }

    return parts
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
      .join(" ");
  }

  function matchText(selectors, node, needles) {
    if (typeof selectors.matchAnyText === "function") {
      return selectors.matchAnyText(node, needles);
    }

    const haystack = fallbackAccessibleText(node);
    return needles.some((needle) => haystack.includes(String(needle).trim().toLowerCase()));
  }

  function findMenuCandidates(selectors) {
    return Array.from(
      document.querySelectorAll("[role='menuitem'], [role='button'], button, li, div[aria-label], div[title]"),
    ).filter((node) => {
      const isVisible = typeof selectors.isVisible === "function" ? selectors.isVisible(node) : fallbackVisible(node);
      return Boolean(isVisible);
    });
  }

  function installPatch() {
    const selectors = globalScope.RecalcWaSelectors;
    if (!selectors || typeof selectors !== "object") return false;
    if (selectors.MEDIA_CAPTION_MENU_PATCH_VERSION === PATCH_VERSION) return true;

    const originalFindAttachmentOption = selectors.findAttachmentOption;
    const originalFindAttachmentOptionByPosition = selectors.findAttachmentOptionByPosition;

    if (typeof originalFindAttachmentOption !== "function") return false;

    function isStickerLike(node) {
      return matchText(selectors, node, stickerNeedles());
    }

    function byText(kind) {
      const needles = kind === "document" ? documentNeedles() : mediaNeedles();
      return (
        findMenuCandidates(selectors).find((node) => {
          if (!matchText(selectors, node, needles)) return false;
          return kind !== "media" || !isStickerLike(node);
        }) || null
      );
    }

    function bySafeMediaPosition() {
      if (typeof originalFindAttachmentOptionByPosition !== "function") return null;

      for (const position of [1, 2, 3, 0]) {
        const option = originalFindAttachmentOptionByPosition.call(selectors, position);
        if (option && !isStickerLike(option)) return option;
      }

      return null;
    }

    selectors.findAttachmentOption = function findAttachmentOptionPatched(kind) {
      if (kind === "media") {
        return (
          byText("media") ||
          bySafeMediaPosition() ||
          originalFindAttachmentOption.call(selectors, kind) ||
          null
        );
      }

      return byText(kind) || originalFindAttachmentOption.call(selectors, kind) || null;
    };

    selectors.MEDIA_CAPTION_MENU_PATCH_VERSION = PATCH_VERSION;
    console.log("[ReCalc][WA] Media menu patch instalado.", { version: PATCH_VERSION });
    return true;
  }

  installPatch();

  if (!globalScope[TIMER_KEY]) {
    globalScope[TIMER_KEY] = window.setInterval(installPatch, 1000);
  }
})(typeof self !== "undefined" ? self : window);
