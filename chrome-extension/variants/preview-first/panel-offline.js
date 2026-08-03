document.addEventListener("DOMContentLoaded", () => {
  const analytics = window.RecalcAnonymousAnalytics;
  const refs = {
    statusPill: document.getElementById("status-pill"),
    setupView: document.getElementById("setup-view"),
    appView: document.getElementById("app-view"),
    setupForm: document.getElementById("setup-form"),
    nameIdInput: document.getElementById("name-id-input"),
    setupError: document.getElementById("setup-error"),
    profileName: document.getElementById("profile-name-id"),
    analyticsStatus: document.getElementById("analytics-status"),
    recalcConnection: document.getElementById("recalc-connection-status"),
    syncDetail: document.getElementById("recalc-sync-detail"),
    syncError: document.getElementById("recalc-sync-error"),
    syncButton: document.getElementById("sync-recalc"),
    changeName: document.getElementById("change-name-id"),
    openWhatsApp: document.getElementById("open-whatsapp-direct"),
  };

  let syncPromise = null;

  function formatDate(value) {
    if (!value) return "Nunca";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Nunca";
    return date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
  }

  function setStatus(kind, label) {
    refs.statusPill.textContent = label;
    refs.statusPill.className = "pill";
    if (kind) refs.statusPill.classList.add(kind);
  }

  function setError(message = "") {
    refs.setupError.textContent = message;
    refs.setupError.classList.toggle("hidden", !message);
  }

  function setSyncError(message = "") {
    refs.syncError.textContent = message ? `Error de ReCalc: ${message}` : "";
    refs.syncError.classList.toggle("hidden", !message);
  }

  function setConnectionState(state, { profile = null, error = "" } = {}) {
    const busy = state === "connecting" || state === "registered" || state === "syncing";
    refs.syncButton.disabled = busy;
    refs.syncButton.textContent = busy ? "Sincronizando..." : "Sincronizar con ReCalc";
    refs.analyticsStatus.className = "sync-badge";
    setSyncError("");

    if (state === "connected") {
      setStatus("success", "ReCalc conectado");
      refs.recalcConnection.textContent = "Conectado";
      refs.analyticsStatus.textContent = "Sincronizado";
      refs.analyticsStatus.classList.add("sync-badge--connected");
      refs.syncDetail.textContent = `Última sincronización: ${formatDate(profile?.lastSyncAt)}`;
      return;
    }

    if (state === "offline") {
      setStatus("danger", "ReCalc sin conexión");
      refs.recalcConnection.textContent = "Sin conexión";
      refs.analyticsStatus.textContent = "Runner local activo";
      refs.analyticsStatus.classList.add("sync-badge--offline");
      refs.syncDetail.textContent = profile?.lastSyncAt
        ? `Última sincronización correcta: ${formatDate(profile.lastSyncAt)}`
        : "Nunca se ha sincronizado con ReCalc.";
      setSyncError(error || "No fue posible establecer conexión.");
      return;
    }

    if (state === "syncing") {
      setStatus("warning", "Sincronizando ReCalc");
      refs.recalcConnection.textContent = "Enviando resultados";
      refs.analyticsStatus.textContent = "Sincronizando";
      refs.syncDetail.textContent = profile?.lastSyncAt
        ? `Última sincronización correcta: ${formatDate(profile.lastSyncAt)}`
        : "Preparando la primera sincronización.";
      return;
    }

    if (state === "connecting" || state === "registered") {
      setStatus("warning", "Conectando con ReCalc");
      refs.recalcConnection.textContent = state === "registered" ? "Instalación registrada" : "Comprobando conexión";
      refs.analyticsStatus.textContent = state === "registered" ? "Preparando datos" : "Conectando";
      refs.syncDetail.textContent = profile?.lastSyncAt
        ? `Última sincronización correcta: ${formatDate(profile.lastSyncAt)}`
        : "Esperando respuesta de ReCalc.";
      return;
    }

    setStatus("warning", "ReCalc pendiente");
    refs.recalcConnection.textContent = "Pendiente de conexión";
    refs.analyticsStatus.textContent = "Sin sincronizar";
    refs.syncDetail.textContent = profile?.lastSyncAt
      ? `Última sincronización correcta: ${formatDate(profile.lastSyncAt)}`
      : "Aún no se ha sincronizado.";
  }

  function showSetup(profile = null) {
    refs.setupView.classList.remove("hidden");
    refs.appView.classList.add("hidden");
    refs.nameIdInput.value = profile?.nameId || "";
    refs.profileName.textContent = profile?.nameId || "Sin Name_ID";
    setConnectionState("idle", { profile });
    setStatus("warning", "Configura Name_ID");
  }

  function showApp(profile) {
    refs.setupView.classList.add("hidden");
    refs.appView.classList.remove("hidden");
    refs.profileName.textContent = profile.nameId;
    setConnectionState("idle", { profile });
    document.dispatchEvent(new CustomEvent("recalc-profile-ready", { detail: profile }));
  }

  async function syncWithRecalc() {
    if (syncPromise) return syncPromise;
    syncPromise = (async () => {
      const profile = await analytics.getProfile();
      if (!profile) return { ok: false, skipped: true };
      const registration = await analytics.registerInstallation(profile);
      if (!registration.ok) return registration;
      return analytics.syncCampaigns();
    })();
    try {
      return await syncPromise;
    } finally {
      syncPromise = null;
    }
  }

  async function bootstrap() {
    const profile = await analytics.getProfile();
    if (!profile) {
      showSetup();
      return;
    }
    showApp(profile);
    void syncWithRecalc();
  }

  window.addEventListener(analytics.STATUS_EVENT, (event) => {
    const detail = event.detail || {};
    setConnectionState(detail.state || "idle", {
      profile: detail.profile || null,
      error: detail.error || "",
    });
  });

  refs.setupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");
    const submit = refs.setupForm.querySelector("button[type='submit']");
    submit.disabled = true;
    submit.textContent = "Guardando...";
    try {
      const profile = await analytics.saveProfile(refs.nameIdInput.value);
      showApp(profile);
      await analytics.queueEvent("profile_ready", { nameId: profile.nameId });
      void syncWithRecalc();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No fue posible guardar el Name_ID.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Continuar";
    }
  });

  refs.syncButton.addEventListener("click", () => {
    void syncWithRecalc();
  });

  refs.changeName.addEventListener("click", async () => {
    const profile = await analytics.getProfile();
    showSetup(profile);
    refs.nameIdInput.focus();
  });

  refs.openWhatsApp.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://web.whatsapp.com/" });
  });

  void bootstrap();
});
