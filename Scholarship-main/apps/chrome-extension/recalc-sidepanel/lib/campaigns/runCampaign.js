(function attachRecalcCampaignRunner(globalScope) {
  const ACTIVE_RUNNER_KEY = "recalc.activeCampaignRunner";
  const RUNNER_ALARM = "recalc.campaignRunnerTick";
  const MIN_RUNNER_DELAY_MS = 250;
  const MAX_SAFE_DELAY_MS = 30 * 60 * 1000;

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

      const tabId = await deps.ensureWhatsAppTab({
        phone,
        text: "",
      });
      await deps.ensureWhatsAppBridge(tabId);

      const sendResult = await deps.sendToWhatsApp(tabId, {
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

      const campaignSnapshot = await deps.reportDispatch(working, {
        recipientId: recipient.id,
        status: sendResult?.success ? "sent" : "failed",
        error: sendResult?.success ? null : (sendResult?.error || "No fue posible enviar el mensaje."),
      });

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
          ? `Mensaje enviado a ${recipient.contactName || recipient.contactValue}${batchCompleted ? ". Esperando el delay por reclamo antes del siguiente batch" : ""}.`
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
      await setState({
        ...nextState,
        busy: false,
        status: "waiting",
        lastMessage: error instanceof Error ? error.message : "Falló la ejecución automática.",
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
    schedule,
    runCampaign,
    pauseCampaign,
    stopCampaign,
    getCampaignStatus,
    processTick,
  };
})(typeof self !== "undefined" ? self : window);
