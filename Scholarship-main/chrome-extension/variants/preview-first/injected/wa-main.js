(function attachRecalcWaMain(globalScope) {
  const previousListener = globalScope.__RECALC_WA_MESSAGE_LISTENER__;
  if (typeof previousListener === "function") {
    window.removeEventListener("message", previousListener);
  }

  // MAIN world existe para ejecutar la automatización en el mismo contexto del runtime de WhatsApp Web
  // sin mezclar la UI del panel ni la coordinación del service worker con detalles internos de la página.
  function toUint8Array(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (Array.isArray(value)) {
      return new Uint8Array(value.map((item) => Number(item) & 0xff));
    }
    return null;
  }

  function toFileList(items) {
    return (items || []).map((item) => {
      if (item instanceof File) return item;
      const bytes =
        toUint8Array(item?.bytes) ||
        toUint8Array(item?.buffer) ||
        new Uint8Array();
      return new File([bytes], String(item?.name || "attachment.bin"), {
        type: String(item?.type || "application/octet-stream"),
        lastModified: Number(item?.lastModified || Date.now()),
      });
    });
  }

  async function applyDraft(payload) {
    const text = String(payload?.draftText || "").trim();
    const selectorPack = payload?.selectorPack ?? null;
    const composer = await globalScope.RecalcWaText.waitFor(() => globalScope.RecalcWaSelectors.findMessageInput(selectorPack), 10000, 250);
    if (!composer) {
      return { ok: true, applied: false };
    }
    const applied = globalScope.RecalcWaText.fillComposer(composer, text);
    return { ok: applied, applied };
  }

  async function sendTextWithAttachments(payload) {
    return globalScope.RecalcWaRunner.sendTextWithAttachments(
      payload?.recipient ?? null,
      payload?.text ?? "",
      toFileList(payload?.attachments ?? []),
      payload?.selectorPack ?? null,
    );
  }

  globalScope.__RECALC_WA__ = {
    applyDraft,
    sendTextWithAttachments,
  };

  const messageListener = async (event) => {
    const data = event.data;
    if (!data || data.source !== "recalc-bridge" || data.target !== "recalc-wa-main") return;

    let response;
    try {
      if (data.action === "applyDraft") {
        response = await applyDraft(data.payload);
      } else if (data.action === "sendTextWithAttachments") {
        response = await sendTextWithAttachments(data.payload);
      } else {
        response = { ok: false, error: "Acción no soportada." };
      }
    } catch (error) {
      response = {
        ok: false,
        error: error instanceof Error ? error.message : "Falló la ejecución en MAIN world.",
      };
    }

    window.postMessage({
      source: "recalc-wa-main",
      target: "recalc-bridge",
      requestId: data.requestId,
      response,
    }, "*");
  };

  window.addEventListener("message", messageListener);
  globalScope.__RECALC_WA_MESSAGE_LISTENER__ = messageListener;
})(window);
