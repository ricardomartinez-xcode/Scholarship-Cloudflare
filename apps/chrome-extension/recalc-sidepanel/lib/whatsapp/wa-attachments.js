(function attachRecalcWaAttachments(globalScope) {
  const selectors = globalScope.RecalcWaSelectors;
  const textUtils = globalScope.RecalcWaText;

  function log(...args) {
    console.log("[ReCalc][WA]", ...args);
  }

  function isMediaAttachment(file) {
    const mime = String(file?.type || "").toLowerCase();
    return mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/");
  }

  function splitAttachments(files) {
    const documents = [];
    const media = [];
    (files || []).forEach((file) => {
      if (isMediaAttachment(file)) {
        media.push(file);
        return;
      }
      documents.push(file);
    });
    return { documents, media };
  }

  function assignFilesToInput(input, files) {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function openAttachmentMenu(pack) {
    const attachButton = selectors.findAttachButton(pack);
    if (!attachButton) {
      throw Object.assign(new Error("No fue posible encontrar el botón de adjuntar."), {
        code: "attachment_menu_not_found",
      });
    }

    if (!(attachButton instanceof Element)) {
      throw Object.assign(new Error("No fue posible encontrar un botón clickable para adjuntar."), {
        code: "attachment_menu_not_found",
      });
    }

    log("Abriendo menú de adjuntos.", { kind: pack?.kind ?? null });
    const opened = textUtils.clickElement(attachButton);
    if (!opened) {
      throw Object.assign(new Error("No fue posible abrir el menú de adjuntos."), {
        code: "attachment_menu_not_found",
      });
    }
    await textUtils.wait(300);
  }

  async function chooseAttachmentOption(kind) {
    const option = await textUtils.waitFor(() => {
      if (kind === "media") {
        return (
          selectors.findAttachmentOption("media") ||
          selectors.findAttachmentOptionByPosition(1) ||
          selectors.findAttachmentOptionByPosition(0)
        );
      }
      return (
        selectors.findAttachmentOption("document") ||
        selectors.findAttachmentOptionByPosition(1) ||
        selectors.findAttachmentOptionByPosition(0)
      );
    }, 4000, 150);
    if (!option) {
      throw Object.assign(new Error("No fue posible encontrar la opción correcta de adjuntos."), {
        code: "attachment_option_not_found",
      });
    }

    if (!(option instanceof Element)) {
      throw Object.assign(new Error("La opción de adjuntar no tiene un contenedor clickable válido."), {
        code: "attachment_option_not_found",
      });
    }

    log("Seleccionando opción de adjunto.", { kind });
    const clicked = textUtils.clickElement(option);
    if (!clicked) {
      throw Object.assign(new Error("No fue posible seleccionar la opción de adjunto."), {
        code: "attachment_option_not_found",
      });
    }
    await textUtils.wait(300);
  }

  async function waitForPreview(pack) {
    const preview = await textUtils.waitFor(() => selectors.findPreviewModal(pack), 6000, 200);
    if (!preview) {
      throw Object.assign(new Error("No se detectó un preview válido para la imagen."), {
        code: "attachment_preview_not_found",
      });
    }

    log("Preview de adjunto detectado.");
    return preview;
  }

  async function findReadyInput(kind, pack) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await openAttachmentMenu(pack);

      if (kind === "media") {
        const mediaOption =
          selectors.findAttachmentOption("media") ||
          selectors.findAttachmentOptionByPosition(1) ||
          selectors.findAttachmentOptionByPosition(0);

        if (mediaOption) {
          await chooseAttachmentOption(kind);
          const input = await textUtils.waitFor(() => selectors.findAttachmentInput(kind, pack), 5000, 200);
          if (input) {
            log("Input de adjunto listo.", {
              kind,
              accept: String(input.accept || ""),
              attempt: attempt + 1,
            });
            return input;
          }
          await textUtils.wait(250);
          continue;
        }

        const existingMediaInput = await textUtils.waitFor(
          () => selectors.findAttachmentInput(kind, pack),
          800,
          100,
        );
        if (existingMediaInput) {
          log("Input de adjunto listo.", {
            kind,
            accept: String(existingMediaInput.accept || ""),
            attempt: attempt + 1,
            source: "opened-menu",
          });
          return existingMediaInput;
        }
      }

      await chooseAttachmentOption(kind);

      const input = await textUtils.waitFor(() => selectors.findAttachmentInput(kind, pack), 5000, 200);
      if (input) {
        log("Input de adjunto listo.", {
          kind,
          accept: String(input.accept || ""),
          attempt: attempt + 1,
        });
        return input;
      }
      await textUtils.wait(250);
    }

    throw Object.assign(new Error("No fue posible encontrar el input correcto de adjuntos."), {
      code: "attachment_input_not_found",
    });
  }

  async function writeCaptionIfPossible(caption, pack) {
    const normalized = String(caption || "").trim();
    if (!normalized) return { applied: false };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const captionInput = await textUtils.waitFor(
        () => selectors.findCaptionInput(pack),
        attempt === 0 ? 4000 : 2000,
        200,
      );
      if (!captionInput) {
        continue;
      }

      const applied = textUtils.fillComposer(captionInput, normalized);
      await textUtils.wait(450);

      if (applied && textUtils.composerText(captionInput) === normalized) {
        return { applied: true };
      }

      log("No se pudo confirmar el caption en el intento actual.", {
        attempt: attempt + 1,
        currentText: textUtils.composerText(captionInput),
      });
      await textUtils.wait(300);
    }

    return { applied: false };
  }

  async function clearComposerDraft(pack) {
    const composer = selectors.findMessageInput(pack);
    const currentText = textUtils.composerText(composer);
    if (!composer || !currentText) {
      return { cleared: true, previousText: currentText };
    }

    if (typeof textUtils.clearComposer === "function") {
      textUtils.clearComposer(composer);
      await textUtils.wait(250);
    }

    const remainingText = textUtils.composerText(selectors.findMessageInput(pack) || composer);
    return {
      cleared: !remainingText,
      previousText: currentText,
      remainingText,
    };
  }

  async function primeComposerCaption(text, pack) {
    const normalized = String(text || "").trim();
    if (!normalized) return { applied: false };

    const existingComposer = selectors.findMessageInput(pack);
    if (textUtils.composerText(existingComposer) === normalized) {
      return { applied: true, via: "existing" };
    }

    const cleared = await clearComposerDraft(pack);
    if (!cleared.cleared) {
      log("No fue posible limpiar el borrador previo del composer.", cleared);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const composer = await textUtils.waitFor(() => selectors.findMessageInput(pack), 4000, 200);
      if (!composer) {
        continue;
      }

      const applied = textUtils.fillComposer(composer, normalized);
      await textUtils.wait(450);
      if (applied && textUtils.composerText(selectors.findMessageInput(pack) || composer) === normalized) {
        return { applied: true };
      }

      log("No se pudo preparar el texto del composer para usarlo como caption.", {
        attempt: attempt + 1,
        currentText: textUtils.composerText(selectors.findMessageInput(pack) || composer),
      });
      await textUtils.wait(300);
    }

    return { applied: false };
  }

  async function finalizeAttachmentSend(pack) {
    const sendButton = await textUtils.waitFor(() => {
      const previewAnchor = selectors.findPreviewModal(pack);
      if (!previewAnchor) return null;
      return selectors.findPreviewSendButton(pack);
    }, 6000, 300);
    if (!sendButton) {
      throw Object.assign(new Error("No fue posible encontrar el botón de enviar del adjunto."), {
        code: "final_send_failed",
      });
    }

    const clicked = textUtils.clickElement(sendButton);
    if (!clicked) {
      throw Object.assign(new Error("No fue posible activar el botón de enviar del adjunto."), {
        code: "final_send_failed",
      });
    }

    const previewClosed = await textUtils.waitFor(
      () => (selectors.findPreviewModal(pack) ? null : { closed: true }),
      8000,
      250,
    );
    if (!previewClosed) {
      log("El preview del adjunto no se cerró después de enviar; se continúa para evitar falso negativo.");
    }
    await textUtils.wait(900);
  }

  async function sendDocumentAttachments(files, caption, pack) {
    if (!files?.length) return { ok: true, captionApplied: false };
    log("Preparando documentos.", { total: files.length });
    const normalizedCaption = String(caption || "").trim();

    // If there is a caption, prime the composer before selecting the files so
    // that WhatsApp can consume it as a caption. This mirrors the logic used
    // for media attachments and helps keep the caption together with the
    // document in one message.
    if (normalizedCaption) {
      await primeComposerCaption(normalizedCaption, pack);
    }

    const input = await findReadyInput("document", pack);
    assignFilesToInput(input, files);
    log("Archivos de documento asignados al input.", { total: files.length });
    await textUtils.wait(1200);
    await waitForPreview(pack);

    // Try to write the caption directly into the preview. If WhatsApp already
    // consumed the caption from the composer this will be a no-op. If it
    // doesn't work we leave the caption in the composer as a fallback.
    const captionResult = await writeCaptionIfPossible(normalizedCaption, pack);
    await finalizeAttachmentSend(pack);
    log("Documentos enviados", files.length);
    return { ok: true, captionApplied: captionResult.applied || Boolean(normalizedCaption) };
  }

  async function sendMediaAttachments(files, caption, pack) {
    if (!files?.length) return { ok: true, captionApplied: false };
    let captionApplied = false;
    const normalizedCaption = String(caption || "").trim();

    /*
     * WhatsApp Web tends to consume any text present in the main composer as a caption
     * for the first media attachment you add. Previously this code attempted to write
     * the caption into a dedicated caption field that appears in the preview. Recent
     * changes to WhatsApp Web have made that field more difficult to target reliably,
     * causing the fallback branch (sending the caption as a separate text message)
     * to trigger. To keep the caption and media in the same message we now prime
     * the main composer with the caption before picking the media file. When the
     * file is selected, WhatsApp automatically moves the composer text into the
     * caption field of the preview. If that fails we still fall back to the
     * previous behaviour of writing the caption directly into the preview or
     * keeping it in the composer.
     */

    // We will only apply the caption to the final media file if a caption was provided.
    // This mirrors WhatsApp's behaviour of using a single caption across multiple
    // attachments; adjust captionIndex if you want the caption on the first file instead.
    const captionIndex = normalizedCaption ? files.length - 1 : -1;

    for (const [index, file] of files.entries()) {
      const shouldApplyCaption = index === captionIndex && normalizedCaption;

      // Clear any stray text from the composer to ensure we don't carry over
      // unrelated drafts into the caption.
      if (!shouldApplyCaption) {
        const clearedComposer = await clearComposerDraft(pack);
        if (!clearedComposer.cleared) {
          log("No fue posible limpiar el borrador previo del composer.", clearedComposer);
        }
      }

      // If this file should carry the caption, pre-fill the composer now. When the
      // user selects the file, WhatsApp will consume the composer text as the
      // caption for the media. We ignore whether this returns true here because
      // the consumption happens after the file is selected.
      if (shouldApplyCaption) {
        await primeComposerCaption(normalizedCaption, pack);
      }

      log("Preparando media.", { index: index + 1, total: files.length, fileName: file.name });
      const input = await findReadyInput("media", pack);
      assignFilesToInput(input, [file]);
      await textUtils.wait(1400);
      await waitForPreview(pack);

      let captionResult = { applied: false };

      // After the preview appears, we try to apply the caption directly if it wasn't
      // consumed from the composer. If it was consumed, writeCaptionIfPossible
      // should detect that nothing needs to be done. This dual approach makes
      // caption placement more robust across WhatsApp Web updates.
      if (shouldApplyCaption) {
        captionResult = await writeCaptionIfPossible(normalizedCaption, pack);
        if (!captionResult.applied) {
          // If the preview caption input didn't accept the text, fall back to keeping
          // the caption in the composer. When the file is sent, WhatsApp should
          // still merge it into the media message.
          const composerCaptionResult = await primeComposerCaption(normalizedCaption, pack);
          captionResult = composerCaptionResult.applied
            ? { applied: true, via: "composer" }
            : { applied: false };
        } else {
          captionResult = {
            ...captionResult,
            via: "preview",
          };
          await clearComposerDraft(pack);
        }
      }
      captionApplied = captionApplied || captionResult.applied;

      await finalizeAttachmentSend(pack);

      // When using the composer to supply the caption, ensure that the text was
      // actually consumed by WhatsApp before moving on. If not consumed, we'll
      // clear the applied flag so the calling code knows to trigger the fallback.
      if (shouldApplyCaption && captionResult.via === "composer") {
        const consumedComposerDraft = await textUtils.waitFor(() => {
          const composer = selectors.findMessageInput(pack);
          return textUtils.composerText(composer) ? null : { cleared: true };
        }, 4000, 250);

        if (!consumedComposerDraft) {
          captionApplied = false;
          log("El texto del composer no se consumió como caption; se activará fallback.", {
            index: index + 1,
            currentText: textUtils.composerText(selectors.findMessageInput(pack)),
          });
        }
      }

      log("Media enviada", { index: index + 1, total: files.length });
      await textUtils.wait(700);
    }

    return { ok: true, captionApplied };
  }

  async function sendAttachments(files, text, pack) {
    const { documents, media } = splitAttachments(files || []);
    const normalizedText = String(text || "").trim();
    const documentCaption = normalizedText && !media.length ? normalizedText : "";
    const mediaCaption = normalizedText;
    const documentResult = await sendDocumentAttachments(documents, documentCaption, pack);
    const mediaResult = await sendMediaAttachments(media, mediaCaption, pack);

    // Con media, WhatsApp suele conservar el caption aunque no siempre podamos
    // confirmarlo de forma determinística en el DOM. Si aquí mandamos el
    // fallback de texto por una falsa negativa, terminamos duplicando el envío:
    // primero la imagen correcta y luego el mismo texto sin imagen. Para evitar
    // ese ciclo, el fallback automático solo se permite cuando no hay media.
    const shouldFallbackText = Boolean(
      normalizedText &&
      media.length === 0 &&
      !documentResult.captionApplied &&
      !mediaResult.captionApplied,
    );

    return {
      ok: true,
      documentResult,
      mediaResult,
      needsTextFallback: shouldFallbackText,
    };
  }

  globalScope.RecalcWaAttachments = {
    isMediaAttachment,
    splitAttachments,
    sendDocumentAttachments,
    sendMediaAttachments,
    sendAttachments,
  };
})(typeof self !== "undefined" ? self : window);
