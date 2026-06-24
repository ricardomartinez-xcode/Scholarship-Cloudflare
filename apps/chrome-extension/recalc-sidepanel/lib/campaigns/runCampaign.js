(function attachRecalcCampaignRunner(globalScope) {
  const ACTIVE_RUNNER_KEY = "recalc.activeCampaignRunner";
  const DISPATCH_LEDGER_KEY = "recalc.campaignDispatchLedger";
  const RUNNER_ALARM = "recalc.campaignRunnerTick";
  const MIN_RUNNER_DELAY_MS = 250;
  const MAX_SAFE_DELAY_MS = 30 * 60 * 1000;
  const DISPATCH_LEDGER_MAX_ITEMS = 1000;
  const DISPATCH_LEDGER_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

  async function getState() {
    const data = await chrome.storage.local.get([ACTIVE_RUNNER_KEY]);
    return data?.[ACTIVE_RUNNER_KEY] ?? null;
  }

  async function setState(nextState) {
    await chrome.storage.local.set({ [ACTIVE_RUNNER_KEY]: nextState });
  }

  async function clearState() {
    await chrome.storage.local.remove([ACTIVE_RUNNER_KEY]);
  }

  async function getDispatchLedger() {
    const data = await chrome.storage.local.get([DISPATCH_LEDGER_KEY]);
    const ledger = data?.[DISPATCH_LEDGER_KEY];
    return ledger && typeof ledger === "object" && !Array.isArray(ledger) ? ledger : {};
  }

  function dispatchLedgerKey(campaignId, recipientId) {
    return `${String(campaignId || "").trim()}::${String(recipientId || "").trim()}`;
  }

  function pruneDispatchLedger(ledger) {
    const now = Date.now();
    const entries = Object.entries(ledger || {})
      .filter(([, entry]) => {
        const timestamp = Date.parse(entry?.updatedAt || entry?.sentAt || "");
        return !Number.isFinite(timestamp) || now - timestamp <= DISPATCH_LEDGER_MAX_AGE_MS;
      })
      .sort((a, b) => Date.parse(b[1]?.updatedAt || b[1]?.sentAt || 0) - Date.parse(a[1]?.updatedAt || a[1]?.sentAt || 0))
      .slice(0, DISPATCH_LEDGER_MAX_ITEMS);
    return Object.fromEntries(entries);
  }

  async function setDispatchLedger(ledger) {
    await chrome.storage.local.set({ [DISPATCH_LEDGER_KEY]: pruneDispatchLedger(ledger) });
  }

  async function getDispatchLedgerEntry(working, recipient) {
    const key = dispatchLedgerKey(working?.campaignId, recipient?.id);
    if (!key || key === "::") return null;
    const ledger = await getDispatchLedger();
    return ledger[key] ?? null;
  }

  async function markDispatchLedgerEntry(working, recipient, patch) {
    const key = dispatchLedgerKey(working?.campaignId, recipient?.id);
    if (!key || key === "::") return;
    const ledger = await getDispatchLedger();
    ledger[key] = {
      ...(ledger[key] ?? {}),
      campaignId: String(working?.campaignId || "").trim(),
      recipientId: String(recipient?.id || "").trim(),
      contactValue: String(recipient?.contactValue || "").trim(),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await setDispatchLedger(ledger);
  }

  async function schedule(delayMs) {
    await chrome.alarms.clear(RUNNER_ALARM);
    await chrome.alarms.create(RUNNER_ALARM, {
      when: Date.now() + Math.max(MIN_RUNNER_DELAY_MS, Math.round(delayMs || MIN_RUNNER_DELAY_MS)),
    });
  }

  function clampDelayMs(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return Math.max(0, fallback);
    return Math.min(MAX_SAFE_DELAY_MS, Math.max(0, Math.round(parsed)));
  }

  function getCampaignMetaNumber(campaign, key, fallback = 0) {
    const parsed = Number(campaign?.meta?.[key]);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function computeHumanizedDelayMs(baseDelayMs, campaign, { batchCompleted = false } = {}) {
    const base = clampDelayMs(baseDelayMs, 4000);
    const jitter = clampDelayMs(getCampaignMetaNumber(campaign, "jitterMs", 0));
    const batchDelay = batchCompleted ? clampDelayMs(getCampaignMetaNumber(campaign, "batchDelayMs", 0)) : 0;
    const variation = jitter > 0 ? Math.round((Math.random() * 2 - 1) * jitter) : 0;
    return Math.max(MIN_RUNNER_DELAY_MS, base + batchDelay + variation);
  }

  function normalizePhone(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const hasPlus = raw.startsWith("+");
    const digits = raw.replace(/\D+/g, "");
    return hasPlus ? `+${digits}` : digits;
  }

  function isCaptionMediaAttachment(attachment) {
    const mime = String(attachment?.type || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    return mime.startsWith("image/") || mime.startsWith("video/");
  }

  function shouldPrefillMediaCaption(text, attachments) {
    return Boolean(
      String(text || "").trim() &&
      Array.isArray(attachments) &&
      attachments.some(isCaptionMediaAttachment),
    );
  }

  function isAuthFailureError(error) {
    return Boolean(error && typeof error === "object" && error.authFailure === true);
  }

  function errorMessage(error, fallback) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message || "").trim()
        : "";
    return message || fallback;
  }

  function normalizeRunState(input, current) {
    return {
      ...current,
      runId: input.runId || current?.runId || `run_${Date.now()}`,
      campaignId: String(input.campaignId || current?.campaignId || "").trim(),
      campaignName: input.campaignName ?? current?.campaignName ?? null,
      appBaseUrl: String(input.appBaseUrl || current?.appBaseUrl || "").trim(),
      extensionSessionToken: String(input.extensionSessionToken || current?.extensionSessionToken || "").trim(),
      selectorPack: input.selectorPack ?? current?.selectorPack ?? null,
      enabled: true,
      paused: false,
      busy: false,
      status: "running",
      currentBatch: null,
      currentIndex: 0,
      lastMessage: input.lastMessage || "Runner iniciado. Preparando primer batch.",
      updatedAt: new Date().toISOString(),
    };
  }

  async function runCampaign(input) {
    const current = await getState();
    const nextState = normalizeRunState(input, current);
    if (!nextState.campaignId) {
      throw new Error("Debes indicar la campaña a ejecutar.");
    }
    if (!nextState.appBaseUrl || !nextState.extensionSessionToken) {
      throw new Error("La extensión necesita sesión activa para automatizar campañas.");
    }
    await setState(nextState);
    await schedule(MIN_RUNNER_DELAY_MS);
    return nextState;
  }

  async function pauseCampaign(runId) {
    const current = await getState();
    if (!current) return null;
    if (runId && current.runId !== runId) return current;
    const nextState = {
      ...current,
      paused: true,
      busy: false,
      status: "paused",
      lastMessage: "La campaña quedó en pausa.",
      updatedAt: new Date().toISOString(),
    };
    await setState(nextState);
    await chrome.alarms.clear(RUNNER_ALARM);
    return nextState;
  }

  async function stopCampaign(runId) {
    const current = await getState();
    if (!current) return null;
    if (runId && current.runId !== runId) return current;
    const nextState = {
      ...current,
      enabled: false,
      paused: false,
      busy: false,
      status: "stopped",
      lastMessage: "El runner fue detenido manualmente.",
      updatedAt: new Date().toISOString(),
    };
    await setState(nextState);
    await chrome.alarms.clear(RUNNER_ALARM);
    return nextState;
  }

  async function getCampaignStatus() {
    return getState();
  }

  async function readInterruptionState(runId) {
    const latest = await getState();
    if (!latest) {
      return { latest: null, interrupted: true, reason: "missing" };
    }
    if (runId && latest.runId !== runId) {
      return { latest, interrupted: true, reason: "replaced" };
    }
    if (!latest.enabled) {
      return { latest, interrupted: true, reason: "stopped" };
    }
    if (latest.paused) {
      return { latest, interrupted: true, reason: "paused" };
    }
    return { latest, interrupted: false, reason: null };
  }

  async function stopSchedulingIfInterrupted(runId) {
    const interruption = await readInterruptionState(runId);
    if (!interruption.interrupted) return false;
    if (interruption.reason === "replaced" || interruption.reason === "missing") {
      return true;
    }

    await setState({
      ...interruption.latest,
      busy: false,
      currentBatch: null,
      currentIndex: 0,
      updatedAt: new Date().toISOString(),
    });
    await chrome.alarms.clear(RUNNER_ALARM);
    return true;
  }

  async function processTick(deps) {
    const runner = await getState();
    if (!runner?.enabled || runner.paused) return;
    if (runner.busy) {
      await schedule(MIN_RUNNER_DELAY_MS * 2);
      return;
    }

    const nextState = { ...runner, busy: true, updatedAt: new Date().toISOString() };
    await setState(nextState);

    try {
      let working = nextState;

      if (!working.currentBatch || working.currentIndex >= (working.currentBatch.recipients?.length ?? 0)) {
        const batch = await deps.claimNextBatch(working);
        if (!batch) {
          const campaign = await deps.loadCampaignById(working);
          if (!campaign) {
            await setState({
              ...working,
              enabled: false,
              busy: false,
              status: "stopped",
              lastMessage: "La campaña ya no está disponible en el backend.",
            });
            await chrome.alarms.clear(RUNNER_ALARM);
            return;
          }

          const status = String(campaign.status ?? "queued");
          if (status === "completed") {
            await setState({
              ...working,
              enabled: false,
              busy: false,
              status: "completed",
              campaignName: campaign.campaignName,
              lastMessage: "Todos los destinatarios ya fueron procesados.",
              currentBatch: null,
              currentIndex: 0,
            });
            await chrome.alarms.clear(RUNNER_ALARM);
            return;
          }

          const waitMs = campaign.scheduleAt
            ? Math.max(new Date(campaign.scheduleAt).getTime() - Date.now(), 15_000)
            : 15_000;

          await setState({
            ...working,
            busy: false,
            campaignName: campaign.campaignName,
            status: status === "scheduled" ? "waiting" : "running",
            lastMessage: status === "scheduled"
              ? `La campaña está programada para ${new Date(campaign.scheduleAt).toLocaleString("es-MX")}.`
              : "No hay destinatarios disponibles todavía. Se volverá a intentar.",
            currentBatch: null,
            currentIndex: 0,
          });
          await schedule(waitMs);
          return;
        }

        working = {
          ...working,
          currentBatch: batch,
          currentIndex: 0,
          campaignName: batch.campaign?.campaignName ?? working.campaignName,
          status: "running",
          lastMessage: `Batch reclamado con ${batch.recipients?.length ?? 0} destinatarios.`,
        };
        await setState(working);
      }

      const recipient = working.currentBatch?.recipients?.[working.currentIndex] ?? null;
      if (!recipient?.id) {
        await setState({ ...working, busy: false, currentBatch: null, currentIndex: 0 });
        await schedule(MIN_RUNNER_DELAY_MS);
        return;
      }

      const phone = normalizePhone(recipient.contactValue);
      if (!phone) {
        await deps.reportDispatch(working, {
          recipientId: recipient.id,
          status: "failed",
          error: "El destinatario no tiene un teléfono válido.",
        });
        await setState({
          ...working,
          busy: false,
          currentIndex: working.currentIndex + 1,
          lastMessage: `Destinatario inválido omitido: ${recipient.contactValue || "sin teléfono"}.`,
        });
        await schedule(MIN_RUNNER_DELAY_MS);
        return;
      }

      const messageText = deps.resolveMessage(working, recipient);
      const attachments = await deps.getAttachmentsForCampaign(working);
      if (!messageText && !attachments.length) {
        await deps.reportDispatch(working, {
          recipientId: recipient.id,
          status: "failed",
          error: "La campaña no tiene mensaje ni adjuntos para enviar.",
        });
        await setState({
          ...working,
          busy: false,
          currentIndex: working.currentIndex + 1,
          lastMessage: "La campaña no tiene contenido para enviarse.",
        });
        await schedule(MIN_RUNNER_DELAY_MS);
        return;
      }

      if (await stopSchedulingIfInterrupted(working.runId)) {
        return;
      }

      const previousDispatch = await getDispatchLedgerEntry(working, recipient);
      const alreadySent = previousDispatch?.status === "sent";
      let sendResult = alreadySent
        ? {
            success: true,
            delayMs: recipient.messageDelayMs ?? working.currentBatch?.campaign?.messageDelayMs ?? 4000,
            skippedDuplicate: true,
          }
        : null;

      if (!alreadySent) {
        await markDispatchLedgerEntry(working, recipient, {
          status: "sending",
          phone,
          hasAttachments: Boolean(attachments.length),
          messageText,
          error: null,
        });

        const tabId = await deps.ensureWhatsAppTab({
          phone,
          text: shouldPrefillMediaCaption(messageText, attachments) ? messageText : "",
        });
        await deps.ensureWhatsAppBridge(tabId);

        sendResult = await deps.sendToWhatsApp(tabId, {
          type: "RECALC_WA_SEND_WITH_ATTACHMENTS",
          selectorPack: working.selectorPack ?? null,
          recipient: {
            id: recipient.id,
            contactName: recipient.contactName || null,
            contactValue: phone,
          },
          text: messageText,
          attachments,
        });

        await markDispatchLedgerEntry(working, recipient, {
          status: sendResult?.success ? "sent" : "failed",
          phone,
          hasAttachments: Boolean(attachments.length),
          messageText,
          sentAt: sendResult?.success ? new Date().toISOString() : null,
          error: sendResult?.success ? null : (sendResult?.error || "No fue posible enviar el mensaje."),
        });
      }

      let campaignSnapshot = null;
      let reportError = null;
      try {
        campaignSnapshot = await deps.reportDispatch(working, {
          recipientId: recipient.id,
          status: sendResult?.success ? "sent" : "failed",
          error: sendResult?.success ? null : (sendResult?.error || "No fue posible enviar el mensaje."),
        });
      } catch (error) {
        reportError = error instanceof Error ? error.message : "No fue posible reportar el resultado del despacho.";
        if (!sendResult?.success) {
          throw new Error(reportError);
        }
      }

      if (await stopSchedulingIfInterrupted(working.runId)) {
        return;
      }

      const nextIndex = working.currentIndex + 1;
      const batchCompleted = nextIndex >= (working.currentBatch?.recipients?.length ?? 0);
      const nextDelay = computeHumanizedDelayMs(
        sendResult?.delayMs ?? recipient.messageDelayMs ?? working.currentBatch?.campaign?.messageDelayMs ?? 4000,
        working.currentBatch?.campaign,
        { batchCompleted },
      );

      const finalState = {
        ...working,
        busy: false,
        campaignName: campaignSnapshot?.campaignName ?? working.campaignName,
        currentIndex: nextIndex,
        status: campaignSnapshot?.status === "completed" ? "completed" : "running",
        lastMessage: sendResult?.success
          ? (
              reportError
                ? `Mensaje enviado a ${recipient.contactName || recipient.contactValue}; el reporte quedó pendiente y no se duplicará el WhatsApp.`
                : `${sendResult.skippedDuplicate ? "Envio duplicado prevenido para" : "Mensaje enviado a"} ${recipient.contactName || recipient.contactValue}${batchCompleted ? ". Esperando el delay por reclamo antes del siguiente batch" : ""}.`
            )
          : `Falló el envío para ${recipient.contactName || recipient.contactValue}: ${sendResult?.error || "sin detalle"}.`,
        lastRecipientId: recipient.id,
        lastRecipientPhone: phone,
        lastSentAt: new Date().toISOString(),
      };

      if (campaignSnapshot?.status === "completed") {
        finalState.enabled = false;
        await setState(finalState);
        await chrome.alarms.clear(RUNNER_ALARM);
        return;
      }

      await setState(finalState);
      await schedule(nextDelay);
    } catch (error) {
      const message = errorMessage(error, "Falló la ejecución automática.");
      if (isAuthFailureError(error)) {
        await setState({
          ...nextState,
          enabled: false,
          paused: false,
          busy: false,
          status: "stopped",
          currentBatch: null,
          currentIndex: 0,
          lastMessage: message,
          updatedAt: new Date().toISOString(),
        });
        await chrome.alarms.clear(RUNNER_ALARM);
        return;
      }

      await setState({
        ...nextState,
        busy: false,
        status: "waiting",
        lastMessage: message,
      });
      await schedule(15_000);
    }
  }

  globalScope.RecalcCampaignRunner = {
    ACTIVE_RUNNER_KEY,
    RUNNER_ALARM,
    MIN_RUNNER_DELAY_MS,
    getState,
    setState,
    clearState,
    getDispatchLedger,
    getDispatchLedgerEntry,
    schedule,
    runCampaign,
    pauseCampaign,
    stopCampaign,
    getCampaignStatus,
    processTick,
  };
})(typeof self !== "undefined" ? self : window);
