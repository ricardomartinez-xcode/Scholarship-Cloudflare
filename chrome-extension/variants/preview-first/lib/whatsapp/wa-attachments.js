(function attachRecalcWaAttachments(globalScope) {
  const selectors = globalScope.RecalcWaSelectors;
  const textUtils = globalScope.RecalcWaText;

  function log(...args) {
    console.log("[ReCalc][WA]", ...args);
  }

  const MEDIA_INSERTION_STRATEGY = "preview_first";

  // Mantener un conjunto de tipos de imagen oficialmente soportados por WhatsApp.
  // Sin embargo, para compatibilidad hacia atrás permitimos cualquier imagen
  // salvo iconos (.ico) o equivalentes, porque el menú de adjuntos acepta
  // prácticamente todos los formatos de foto. La lista se conserva por si
  // el backend u otras funciones necesitan validar.
  const SUPPORTED_WA_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
    "image/pjpeg",
    "image/jfif",
  ]);

  function normalizeMimeType(value) {
    return String(value || "").split(";")[0].trim().toLowerCase();
  }

  function isMediaAttachment(file) {
    const mime = normalizeMimeType(file?.type);
    // Considerar cualquier imagen como media, excepto formatos de iconos
    // que WhatsApp no acepta como fotos. Si el tipo es uno de los
    // oficialmente soportados, lo aceptamos directamente. Para otros
    // tipos de imagen (por ejemplo GIF, BMP, JPG sin e), intentamos
    // enviarlos como media; si WhatsApp los rechaza, se tratarán como
    // documentos al nivel de la interfaz de usuario.
    if (mime.startsWith("image/")) {
      const unsupported = ["image/x-icon", "image/vnd.microsoft.icon"];
      if (unsupported.includes(mime)) {
        return false;
      }
      return true;
    }
    return mime.startsWith("video/") || mime.startsWith("audio/");
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
    // Aumentar el tiempo de espera tras abrir el menú de adjuntos para
    // permitir que la animación de aparición se complete. Algunos usuarios
    // reportaron que el menú se cierra demasiado rápido cuando el delay es
    // corto, impidiendo la selección correcta. 500 ms ofrece un margen
    // suficiente sin degradar la experiencia.
    await textUtils.wait(500);
  }

  async function chooseAttachmentOption(kind) {
    // Para evitar depender del orden de las opciones del menú, primero intentamos
    // localizar la opción correspondiente por palabras clave. Solo si no
    // encontramos la opción por nombre hacemos un fallback a la posición
    // numérica. WhatsApp ha cambiado el orden de los botones en varias
    // versiones; apoyarnos exclusivamente en el índice puede provocar que
    // seleccionemos la opción incorrecta (por ejemplo, Documentos en lugar de
    // Fotos y videos). Si buscamos por nombre primero reducimos la probabilidad
    // de fallar.
    const option = await textUtils.waitFor(() => {
      if (kind === "media") {
        // Buscar la opción de fotos y videos por palabras clave.
        const foundByName = selectors.findAttachmentOption("media");
        if (foundByName) return foundByName;
        // Como último recurso usar la posición conocida (segunda opción). Si la
        // posición no existe, devuelve undefined y waitFor continuará.
        return selectors.findAttachmentOptionByPosition(1);
      }
      // Para documentos utilizamos la búsqueda por nombre únicamente. Buscar
      // directamente por posición puede resultar en enviar un contacto o
      // ubicación sin querer.
      return selectors.findAttachmentOption("document");
    }, 5000, 150);
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
    // Dar más tiempo a la interfaz después de seleccionar la opción para
    // asegurar que el input se genere correctamente. Un margen de 500 ms
    // mejora la estabilidad en redes lentas o con cargas de CPU.
    await textUtils.wait(500);
  }

  async function waitForPreview(pack) {
    // Aumentar el timeout máximo para esperar el preview a 9 s. Algunos
    // navegadores tardan más en renderizar el modal de adjuntos cuando
    // existen muchas pestañas o limitaciones de red.
    const preview = await textUtils.waitFor(() => selectors.findPreviewModal(pack), 9000, 200);
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

      // Antes de escribir una nueva leyenda, limpiar explícitamente el composer
      // del preview para evitar que textos anteriores se mezclen con el nuevo.
      if (typeof textUtils.clearComposer === "function") {
        textUtils.clearComposer(captionInput);
        await textUtils.wait(250);
      }

      const applied = textUtils.fillComposer(captionInput, normalized);
      await textUtils.wait(650);

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
      throw Object.assign(new Error("El preview del adjunto no se cerró después de intentar enviarlo."), {
        code: "attachment_preview_not_closed",
      });
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

  async function clearPreviewCaptionDraft(pack) {
    const captionInput = selectors.findCaptionInput(pack);
    if (!captionInput) {
      return { cleared: true, previousText: "" };
    }

    const currentText = textUtils.composerText(captionInput);
    if (typeof textUtils.clearComposer === "function") {
      textUtils.clearComposer(captionInput);
      await textUtils.wait(250);
    }

    const remainingText = textUtils.composerText(selectors.findCaptionInput(pack) || captionInput);
    return {
      cleared: !remainingText,
      previousText: currentText,
      remainingText,
    };
  }

  async function waitForComposerConsumed(pack) {
    return textUtils.waitFor(() => {
      const composer = selectors.findMessageInput(pack);
      return textUtils.composerText(composer) ? null : { cleared: true };
    }, 5000, 250);
  }

  async function attachSingleMediaFile(file, pack) {
    const input = await findReadyInput("media", pack);
    assignFilesToInput(input, [file]);
    await textUtils.wait(1800);
    await waitForPreview(pack);
    // Dar margen extra a WhatsApp para terminar de hidratar el modal antes de
    // escribir caption o presionar enviar.
    await textUtils.wait(700);
  }

  async function sendMediaPreviewFirst(files, caption, pack) {
    let captionApplied = false;
    const normalizedCaption = String(caption || "").trim();
    const captionIndex = normalizedCaption ? files.length - 1 : -1;

    for (const [index, file] of files.entries()) {
      const shouldApplyCaption = index === captionIndex && normalizedCaption;

      // Variante A: limpiar caja principal, adjuntar imagen, limpiar caption
      // del preview, escribir caption en preview y enviar desde preview.
      const clearedComposer = await clearComposerDraft(pack);
      if (!clearedComposer.cleared) {
        log("No fue posible limpiar el composer antes de adjuntar media.", clearedComposer);
      }

      log("Preparando media con estrategia preview_first.", {
        index: index + 1,
        total: files.length,
        fileName: file.name,
        strategy: MEDIA_INSERTION_STRATEGY,
      });

      await attachSingleMediaFile(file, pack);

      let captionResult = { applied: false, via: "none" };
      if (shouldApplyCaption) {
        const clearedPreview = await clearPreviewCaptionDraft(pack);
        if (!clearedPreview.cleared) {
          log("No fue posible limpiar el caption del preview antes de escribir.", clearedPreview);
        }
        const previewResult = await writeCaptionIfPossible(normalizedCaption, pack);
        captionResult = previewResult.applied
          ? { ...previewResult, via: "preview" }
          : { applied: false, via: "preview_failed" };
      }

      captionApplied = captionApplied || Boolean(captionResult.applied);
      await finalizeAttachmentSend(pack);
      log("Media enviada", { index: index + 1, total: files.length, strategy: MEDIA_INSERTION_STRATEGY });
      await textUtils.wait(900);
    }

    return { ok: true, captionApplied };
  }

  async function sendMediaComposerFirst(files, caption, pack) {
    let captionApplied = false;
    const normalizedCaption = String(caption || "").trim();
    const captionIndex = normalizedCaption ? files.length - 1 : -1;

    for (const [index, file] of files.entries()) {
      const shouldApplyCaption = index === captionIndex && normalizedCaption;

      // Variante B: limpiar caja principal, escribir texto en caja principal,
      // adjuntar media, verificar consumo hacia preview y enviar desde preview.
      const clearedComposer = await clearComposerDraft(pack);
      if (!clearedComposer.cleared) {
        log("No fue posible limpiar el composer antes de preparar media.", clearedComposer);
      }

      let captionResult = { applied: false, via: "none" };
      if (shouldApplyCaption) {
        const composerCaptionResult = await primeComposerCaption(normalizedCaption, pack);
        captionResult = composerCaptionResult.applied
          ? { applied: true, via: "composer" }
          : { applied: false, via: "composer_failed" };
      }

      log("Preparando media con estrategia composer_first.", {
        index: index + 1,
        total: files.length,
        fileName: file.name,
        strategy: MEDIA_INSERTION_STRATEGY,
      });

      await attachSingleMediaFile(file, pack);

      if (shouldApplyCaption) {
        const consumedComposerDraft = await waitForComposerConsumed(pack);
        if (!consumedComposerDraft) {
          log("El composer principal no se consumió como caption. Se intentará escribir en preview.", {
            index: index + 1,
            currentText: textUtils.composerText(selectors.findMessageInput(pack)),
          });

          const clearedPreview = await clearPreviewCaptionDraft(pack);
          if (!clearedPreview.cleared) {
            log("No fue posible limpiar el caption del preview antes de fallback.", clearedPreview);
          }

          const previewResult = await writeCaptionIfPossible(normalizedCaption, pack);
          captionResult = previewResult.applied
            ? { ...previewResult, via: "preview_fallback" }
            : { applied: false, via: "fallback_failed" };
        }
      }

      captionApplied = captionApplied || Boolean(captionResult.applied);
      await finalizeAttachmentSend(pack);
      log("Media enviada", { index: index + 1, total: files.length, strategy: MEDIA_INSERTION_STRATEGY });
      await textUtils.wait(900);
    }

    return { ok: true, captionApplied };
  }

  async function sendMediaAttachments(files, caption, pack) {
    if (!files?.length) return { ok: true, captionApplied: false };
    const normalizedCaption = String(caption || "").trim();

    if (MEDIA_INSERTION_STRATEGY === "preview_first") {
      return sendMediaPreviewFirst(files, normalizedCaption, pack);
    }

    return sendMediaComposerFirst(files, normalizedCaption, pack);
  }

  async function sendAttachments(files, text, pack) {
    const { documents, media } = splitAttachments(files || []);
    const normalizedText = String(text || "").trim();
    const documentCaption = normalizedText && !media.length ? normalizedText : "";
    const mediaCaption = normalizedText;
    const documentResult = await sendDocumentAttachments(documents, documentCaption, pack);
    const mediaResult = await sendMediaAttachments(media, mediaCaption, pack);
    return {
      ok: true,
      documentResult,
      mediaResult,
      needsTextFallback: Boolean(
        normalizedText &&
        !documentResult.captionApplied &&
        !mediaResult.captionApplied,
      ),
    };
  }

  globalScope.RecalcWaAttachments = {
    MEDIA_INSERTION_STRATEGY,
    isMediaAttachment,
    splitAttachments,
    sendDocumentAttachments,
    sendMediaAttachments,
    sendAttachments,
  };
})(typeof self !== "undefined" ? self : window);
