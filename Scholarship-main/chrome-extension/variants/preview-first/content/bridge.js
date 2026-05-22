(function attachRecalcBridge() {
  const pending = new Map();
  const DEFAULT_TIMEOUT_MS = 60000;

  function requestMainWorld(action, payload, options = {}) {
    const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
    const requestId = `bridge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        pending.delete(requestId);
        resolve({
          ok: false,
          error: "wa_main_timeout",
          step: "bridge_timeout",
        });
      }, timeoutMs);

      pending.set(requestId, (response) => {
        window.clearTimeout(timeout);
        resolve(response);
      });

      window.postMessage({
        source: "recalc-bridge",
        target: "recalc-wa-main",
        requestId,
        action,
        payload,
      }, "*");
    });
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== "recalc-wa-main" || data.target !== "recalc-bridge") return;
    const resolver = pending.get(data.requestId);
    if (!resolver) return;
    pending.delete(data.requestId);
    resolver(data.response);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "RECALC_WA_SEND_WITH_ATTACHMENTS") {
      void requestMainWorld(
        "sendTextWithAttachments",
        {
          recipient: message.recipient ?? null,
          text: message.text ?? "",
          attachments: message.attachments ?? [],
          selectorPack: message.selectorPack ?? null,
        },
        { timeoutMs: 90000 },
      ).then((response) => sendResponse(response));
      return true;
    }

    if (message?.type === "RECALC_APPLY_WHATSAPP_DRAFT") {
      void requestMainWorld(
        "applyDraft",
        {
          draftText: String(message.draftText ?? "").trim(),
          selectorPack: message.selectorPack ?? null,
        },
        { timeoutMs: 20000 },
      ).then((response) => sendResponse(response));
      return true;
    }

    return undefined;
  });
})();
