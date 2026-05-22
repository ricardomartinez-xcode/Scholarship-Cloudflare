(function attachRecalcWaRunner(globalScope) {
  const chat = globalScope.RecalcWaChat;
  const textUtils = globalScope.RecalcWaText;
  const attachments = globalScope.RecalcWaAttachments;

  async function sendTextWithAttachments(recipient, text, attachmentFiles, selectorPack) {
    const normalizedText = String(text || "").trim();
    const files = Array.isArray(attachmentFiles) ? attachmentFiles : [];
    const result = {
      success: false,
      step: "init",
      error: null,
      delayMs: 4000,
    };

    try {
      await chat.openChat(recipient, "", selectorPack);
      result.step = "chat_ready";

      if (files.length) {
        const attachmentResult = await attachments.sendAttachments(files, normalizedText, selectorPack);
        result.step = "attachments_sent";
        if (attachmentResult.needsTextFallback && normalizedText) {
          await textUtils.sendTextMessage(normalizedText, selectorPack);
          result.step = "caption_fallback_sent";
        }
      } else if (normalizedText) {
        await textUtils.sendTextMessage(normalizedText, selectorPack);
        result.step = "text_sent";
      } else if (!normalizedText) {
        throw new Error("La campaña no tiene texto ni adjuntos.");
      }

      result.success = true;
      result.step = "completed";
      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Falló la automatización del mensaje.";
      result.step = error?.code || result.step || "unknown_error";
      return result;
    }
  }

  globalScope.RecalcWaRunner = {
    sendTextWithAttachments,
  };
})(typeof self !== "undefined" ? self : window);
