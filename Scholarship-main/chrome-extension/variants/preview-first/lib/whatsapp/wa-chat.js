(function attachRecalcWaChat(globalScope) {
  const selectors = globalScope.RecalcWaSelectors;
  const textUtils = globalScope.RecalcWaText;

  function detectInvalidPhoneMessage() {
    const bodyText = document.body?.innerText?.toLowerCase?.() || "";
    return [
      "phone number shared via url is invalid",
      "número de teléfono compartido mediante la url no es válido",
      "número de teléfono compartido a través de la url es inválido",
      "no está en whatsapp",
      "no esta en whatsapp",
      "not on whatsapp",
    ].some((pattern) => bodyText.includes(pattern));
  }

  async function ensureChatReady(pack) {
    const status = await textUtils.waitFor(() => {
      if (detectInvalidPhoneMessage()) {
        return { invalid: true };
      }

      const composer = selectors.findMessageInput(pack);
      const attachButton = selectors.findAttachButton(pack);
      const ready = composer || attachButton || selectors.findConversationReady(pack);
      if (!ready) return null;

      if (!composer && !attachButton) {
        return null;
      }

      return {
        invalid: false,
        ready,
      };
    }, 15000, 300);

    if (status?.invalid) {
      throw Object.assign(new Error("WhatsApp marcó el número como inválido o no disponible."), {
        code: "open_chat_failed",
      });
    }

    if (!status?.ready) {
      throw Object.assign(new Error("No fue posible preparar el chat de WhatsApp."), {
        code: "open_chat_failed",
      });
    }

    return status.ready;
  }

  async function openChat(_recipient, _text, pack) {
    return ensureChatReady(pack);
  }

  globalScope.RecalcWaChat = {
    openChat,
    ensureChatReady,
  };
})(typeof self !== "undefined" ? self : window);
