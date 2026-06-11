(function attachRecalcWaText(globalScope) {
  const selectors = globalScope.RecalcWaSelectors;

  function log(...args) {
    console.log("[ReCalc][WA]", ...args);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitFor(callback, timeoutMs, intervalMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const result = callback();
      if (result) return result;
      await wait(intervalMs);
    }
    return null;
  }

  function composerText(node) {
    return String(node?.innerText || node?.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function setComposerSelection(node, collapseToEnd = true) {
    if (!(node instanceof Element)) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
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

  function fillLexicalComposer(node, normalized) {
    const editor = node?.__lexicalEditor;
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

  function clearComposer(node) {
    if (!(node instanceof Element)) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    selection?.removeAllRanges();
    selection?.addRange(range);
    try {
      document.execCommand("delete");
    } catch {
      node.innerHTML = "";
    }
    node.textContent = "";
    node.innerHTML = "";
    node.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "deleteContentBackward",
      data: null,
    }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    setComposerSelection(node, true);
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

    const rect = clickable.getBoundingClientRect?.() || { x: 0, y: 0, width: 0, height: 0 };
    const eventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      button: 0,
      buttons: 1,
      clientX: rect.x + rect.width / 2,
      clientY: rect.y + rect.height / 2,
    };

    for (const type of [
      "pointerover",
      "mouseover",
      "pointerenter",
      "mouseenter",
      "pointerdown",
      "mousedown",
      "pointerup",
      "mouseup",
      "click",
    ]) {
      const EventClass = type.startsWith("pointer") && typeof PointerEvent === "function"
        ? PointerEvent
        : MouseEvent;
      clickable.dispatchEvent(new EventClass(type, eventInit));
    }

    return true;
  }

  function fillComposer(node, text) {
    const normalized = normalizeComposerText(text);
    if (!node || !normalized) return false;
    if (composerText(node) === normalized) return true;

    if (node.getAttribute("data-lexical-editor") === "true") {
      return fillLexicalComposer(node, normalized);
    }

    node.focus();
    clearComposer(node);
    setComposerSelection(node, true);
    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, normalized);
    } catch {
      inserted = false;
    }

    if (!inserted || composerText(node) !== normalized) {
      const lexicalMode = node.getAttribute("data-lexical-editor") === "true";
      node.innerHTML = buildComposerHtml(normalized, lexicalMode);
    }

    node.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: normalized,
    }));
    node.dispatchEvent(new Event("change", { bubbles: true }));

    if (composerText(node) !== normalized) {
      node.textContent = normalized;
      node.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: normalized,
      }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return composerText(node) === normalized;
  }

  function clickSend(pack) {
    const target = selectors.findSendButton(pack);
    if (!target) return false;
    return clickElement(target);
  }

  async function sendTextMessage(text, pack) {
    const composer = await waitFor(() => selectors.findMessageInput(pack), 15000, 250);
    if (!composer) {
      throw Object.assign(new Error("No fue posible encontrar la caja de mensaje."), { code: "text_send_failed" });
    }
    if (!fillComposer(composer, text)) {
      throw Object.assign(new Error("No fue posible escribir el mensaje."), { code: "text_send_failed" });
    }
    await wait(200);
    if (!clickSend(pack)) {
      throw Object.assign(new Error("No fue posible pulsar enviar."), { code: "final_send_failed" });
    }
    log("Texto enviado.");
    return { ok: true };
  }

  globalScope.RecalcWaText = {
    wait,
    waitFor,
    composerText,
    clearComposer,
    fillComposer,
    resolveClickable,
    clickElement,
    clickSend,
    sendTextMessage,
  };
})(typeof self !== "undefined" ? self : window);
