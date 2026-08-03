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
    changeName: document.getElementById("change-name-id"),
    openWhatsApp: document.getElementById("open-whatsapp-direct"),
  };

  function setStatus(kind, label) {
    refs.statusPill.textContent = label;
    refs.statusPill.className = "pill";
    if (kind) refs.statusPill.classList.add(kind);
  }

  function setError(message = "") {
    refs.setupError.textContent = message;
    refs.setupError.classList.toggle("hidden", !message);
  }

  function showSetup(profile = null) {
    refs.setupView.classList.remove("hidden");
    refs.appView.classList.add("hidden");
    refs.nameIdInput.value = profile?.nameId || "";
    setStatus("warning", "Configura Name_ID");
  }

  function showApp(profile) {
    refs.setupView.classList.add("hidden");
    refs.appView.classList.remove("hidden");
    refs.profileName.textContent = profile.nameId;
    refs.analyticsStatus.textContent = profile.lastSyncAt ? "Analítica sincronizada" : "Analítica opcional";
    setStatus("success", "Modo local");
    document.dispatchEvent(new CustomEvent("recalc-profile-ready", { detail: profile }));
  }

  async function bootstrap() {
    const profile = await analytics.getProfile();
    if (!profile) {
      showSetup();
      return;
    }
    showApp(profile);
    void analytics.registerInstallation(profile).then(async (result) => {
      if (!result.ok) return;
      const latest = await analytics.getProfile();
      if (latest) refs.analyticsStatus.textContent = latest.lastSyncAt ? "Analítica sincronizada" : "Analítica registrada";
    });
  }

  refs.setupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");
    const submit = refs.setupForm.querySelector("button[type='submit']");
    submit.disabled = true;
    submit.textContent = "Guardando...";
    try {
      const profile = await analytics.saveProfile(refs.nameIdInput.value);
      showApp(profile);
      void analytics.registerInstallation(profile);
      void analytics.queueEvent("profile_ready", { nameId: profile.nameId });
    } catch (error) {
      setError(error instanceof Error ? error.message : "No fue posible guardar el Name_ID.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Continuar";
    }
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
