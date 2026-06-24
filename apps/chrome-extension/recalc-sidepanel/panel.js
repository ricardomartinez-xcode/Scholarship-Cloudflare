document.addEventListener("DOMContentLoaded", () => {
  const APP_BASE_URL = "https://recalc.relead.com.mx";
  const PANEL_CONFIG_REFRESH_MS = 20 * 1000;
  const DATA_REFRESH_MS = 60 * 1000;
  const EXTENSION_SESSION_TOKEN_HEADER = "x-extension-session-token";
  const EXTENSION_SESSION_TOKEN_KEY = "recalc.extensionSessionToken";
  const ACTIVE_TAB_KEY = "recalc.extensionActiveTab";
  const DEFAULT_PANEL_CONFIG = {
    sessionRequiredLabel: "Sesión requerida",
    openSiteLabel: "Abrir sitio completo",
    openSitePath: "/unidep",
    openWhatsAppLabel: "Abrir WhatsApp Web",
  };

  const currency = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  });

  const refs = {
    loadingView: document.getElementById("loading-view"),
    authView: document.getElementById("auth-view"),
    appView: document.getElementById("app-view"),
    statusPill: document.getElementById("status-pill"),
    heroSession: document.getElementById("hero-session"),
    openWebApp: document.getElementById("open-webapp"),
    refreshData: document.getElementById("refresh-data"),
    openWebAppInline: document.getElementById("open-webapp-inline"),
    openWhatsAppDirect: document.getElementById("open-whatsapp-direct"),
    authForm: document.getElementById("auth-form"),
    authEmail: document.getElementById("auth-email"),
    authPassword: document.getElementById("auth-password"),
    authSubmit: document.getElementById("auth-submit"),
    authError: document.getElementById("auth-error"),
    openSignup: document.getElementById("open-signup"),
    openReset: document.getElementById("open-reset"),
    authLogout: document.getElementById("auth-logout"),
    sessionEmail: document.getElementById("session-email"),
    syncTime: document.getElementById("sync-time"),
    runtimeMode: document.getElementById("runtime-mode"),
    tipoSelect: document.getElementById("tipo-select"),
    nivelSelect: document.getElementById("nivel-select"),
    modalidadSelect: document.getElementById("modalidad-select"),
    planSelect: document.getElementById("plan-select"),
    plantelField: document.getElementById("plantel-field"),
    plantelSelect: document.getElementById("plantel-select"),
    materiasField: document.getElementById("materias-field"),
    materiasSelect: document.getElementById("materias-select"),
    promedioInput: document.getElementById("promedio-input"),
    benefitSummary: document.getElementById("benefit-summary"),
    extraEnabled: document.getElementById("extra-enabled"),
    extraFields: document.getElementById("extra-fields"),
    feeSelect: document.getElementById("fee-select"),
    feeAmount: document.getElementById("fee-amount"),
    resetForm: document.getElementById("reset-form"),
    sendQuote: document.getElementById("send-quote"),
    calculateBtn: document.getElementById("calculate-btn"),
    quoteError: document.getElementById("quote-error"),
    resultEmpty: document.getElementById("result-empty"),
    resultPanel: document.getElementById("result-panel"),
    resultTotal: document.getElementById("result-total"),
    resultSummary: document.getElementById("result-summary"),
    resultBase: document.getElementById("result-base"),
    resultScholarship: document.getElementById("result-scholarship"),
    resultBenefit: document.getElementById("result-benefit"),
    resultSubtotal: document.getElementById("result-subtotal"),
    resultExtra: document.getElementById("result-extra"),
    resultFirstPayment: document.getElementById("result-first-payment"),
    resultFirstPaymentCard: document.getElementById("result-first-payment-card"),
    resultFirstPaymentHero: document.getElementById("result-first-payment-hero"),
    resultFirstPaymentCopy: document.getElementById("result-first-payment-copy"),
    resultFinalTotalLine: document.getElementById("result-final-total-line"),
    resultFinalTotal: document.getElementById("result-final-total"),
    resultMeta: document.getElementById("result-meta"),
    quoteSource: document.getElementById("quote-source"),
    quoteMessagePreview: document.getElementById("quote-message-preview"),
    quoteTemplateStatus: document.getElementById("quote-template-status"),
    tabButtons: Array.from(document.querySelectorAll("[data-tab-target]")),
    tabPanels: Array.from(document.querySelectorAll(".tab-panel")),
  };

  const state = {
    email: "",
    pricingOptions: [],
    campuses: [],
    fees: [],
    lastSyncAt: null,
    panelConfig: { ...DEFAULT_PANEL_CONFIG },
    statusKey: "",
    extensionSessionToken: "",
    extensionBootstrap: null,
    lastQuote: null,
    lastDraft: null,
    currentBenefits: { benefit: null, firstPaymentBenefit: null },
  };
  const enhancedSelects = new Map();
  let openEnhancedSelect = null;

  const enrollmentOptions = [
    { value: "nuevo_ingreso", label: "Nuevo ingreso" },
    { value: "regreso", label: "Regreso" },
    { value: "reingreso", label: "Reingreso" },
  ];
  const subjectOptions = Array.from({ length: 7 }, (_, index) => {
    const value = String(index + 1);
    return { value, label: `${value} ${index === 0 ? "materia" : "materias"}` };
  });
  const businessLineLabels = {
    prepa: "Bachillerato",
    licenciatura: "Licenciatura",
    maestria: "Maestría",
    posgrado: "Posgrado",
    salud: "Salud",
  };
  const modalityLabels = {
    presencial: "Presencial",
    mixta: "Mixta",
    online: "Online",
  };
  const businessLineOrder = ["prepa", "licenciatura", "posgrado", "maestria", "salud"];
  const modalityOrder = ["presencial", "mixta", "online"];

  const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const money = (value) => currency.format(Math.round((Number(value) || 0) * 100) / 100);
  const percent = (value) => `${Number(value) || 0}%`;
  const normalizeKey = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  const normalizeSessionToken = (value) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return "";
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  };
  const decimal = (value) => {
    const parsed = Number(String(value ?? "").trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const uniq = (items) => Array.from(new Set(items.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), "es"));
  const canonBusinessLine = (value) => {
    const key = normalizeKey(value);
    if (["prepa", "preparatoria", "bachillerato", "bachiller"].includes(key)) return "prepa";
    if (["maestria", "maestrias", "posgrado", "doctorado"].includes(key)) return "posgrado";
    if (["lic", "licenciatura", "licenciaturas"].includes(key)) return "licenciatura";
    if (key === "salud") return "salud";
    return key;
  };
  const canonModality = (value) => {
    const key = normalizeKey(value);
    if (["ejecutivo", "mixto", "mixta"].includes(key)) return "mixta";
    if (["en_linea", "en linea", "virtual", "online"].includes(key)) return "online";
    if (["presencial", "escolarizado"].includes(key)) return "presencial";
    return key;
  };
  const labelBusinessLine = (value) => businessLineLabels[canonBusinessLine(value)] ?? String(value ?? "");
  const labelModality = (value) => modalityLabels[canonModality(value)] ?? String(value ?? "");
  const compareByOrder = (order) => (a, b) => {
    const left = order.indexOf(a);
    const right = order.indexOf(b);
    if (left !== -1 || right !== -1) return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
    return String(a).localeCompare(String(b), "es");
  };
  const optionMatches = (option, enrollmentType, businessLine, modality = null) => {
    if (option.enrollmentType !== enrollmentType) return false;
    if (businessLine && canonBusinessLine(option.businessLine) !== canonBusinessLine(businessLine)) return false;
    if (modality && canonModality(option.modality) !== canonModality(modality)) return false;
    return true;
  };
  const requiresCampus = (businessLine, modality) =>
    ["prepa", "licenciatura", "posgrado", "salud"].includes(canonBusinessLine(businessLine)) &&
    Boolean(canonModality(modality)) &&
    canonModality(modality) !== "online";
  const needsSubjects = (type, businessLine) => type === "regreso" && canonBusinessLine(businessLine) === "licenciatura";

  function closeEnhancedSelect(instance) {
    if (!instance) return;
    instance.wrapper.classList.remove("is-open");
    if (openEnhancedSelect === instance) openEnhancedSelect = null;
  }

  function refreshEnhancedSelect(select) {
    const instance = enhancedSelects.get(select);
    if (!instance) return;
    const options = Array.from(select.options);
    const selectedOption = options.find((option) => option.value === select.value) ?? options[0] ?? null;
    const triggerText = instance.trigger.querySelector(".enhanced-select__trigger-text");
    if (triggerText) triggerText.textContent = selectedOption?.textContent || "Selecciona";
    instance.trigger.disabled = Boolean(select.disabled);
    instance.menu.innerHTML = "";
    const actionableOptions = options.filter((option, index) => index > 0 && option.value !== "");
    if (!actionableOptions.length) {
      const empty = document.createElement("div");
      empty.className = "enhanced-select__empty";
      empty.textContent = options[0]?.textContent || "Sin opciones disponibles";
      instance.menu.appendChild(empty);
      return;
    }
    actionableOptions.forEach((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "enhanced-select__option";
      if (option.value === select.value) item.classList.add("is-selected");
      item.textContent = option.textContent || option.value;
      item.dataset.value = option.value;
      item.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refreshEnhancedSelect(select);
        closeEnhancedSelect(instance);
      });
      instance.menu.appendChild(item);
    });
  }

  function buildEnhancedSelect(select) {
    if (!select || enhancedSelects.has(select)) return;
    const field = select.closest(".field");
    if (!field) return;
    field.classList.add("field--enhanced");
    select.classList.add("native-select");

    const wrapper = document.createElement("div");
    wrapper.className = "enhanced-select";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "enhanced-select__trigger";
    trigger.innerHTML = '<span class="enhanced-select__trigger-text"></span><span class="ui-select-icon" aria-hidden="true">▾</span>';
    const menu = document.createElement("div");
    menu.className = "enhanced-select__menu ui-scrollbar";
    wrapper.append(trigger, menu);
    select.insertAdjacentElement("afterend", wrapper);

    const instance = { select, field, wrapper, trigger, menu };
    enhancedSelects.set(select, instance);

    trigger.addEventListener("click", () => {
      if (select.disabled) return;
      if (openEnhancedSelect && openEnhancedSelect !== instance) {
        closeEnhancedSelect(openEnhancedSelect);
      }
      const willOpen = !wrapper.classList.contains("is-open");
      wrapper.classList.toggle("is-open", willOpen);
      openEnhancedSelect = willOpen ? instance : null;
    });

    select.addEventListener("change", () => refreshEnhancedSelect(select));
    refreshEnhancedSelect(select);
  }

  function initializeEnhancedSelects() {
    [refs.tipoSelect, refs.nivelSelect, refs.modalidadSelect, refs.planSelect, refs.plantelSelect, refs.materiasSelect, refs.feeSelect].forEach((select) => buildEnhancedSelect(select));
  }

  document.addEventListener("click", (event) => {
    if (!openEnhancedSelect) return;
    if (openEnhancedSelect.wrapper.contains(event.target)) return;
    closeEnhancedSelect(openEnhancedSelect);
  });

  function canUseChromeStorage() {
    return Boolean(chrome?.storage?.local);
  }

  function canUseLocalStorage() {
    try {
      return typeof window !== "undefined" && Boolean(window.localStorage);
    } catch {
      return false;
    }
  }

  function getStoredActiveTab() {
    if (!canUseLocalStorage()) return "";
    return String(window.localStorage.getItem(ACTIVE_TAB_KEY) ?? "").trim();
  }

  function setStoredActiveTab(tabId) {
    if (!canUseLocalStorage()) return;
    window.localStorage.setItem(ACTIVE_TAB_KEY, String(tabId ?? "").trim());
  }

  function activateTab(targetId) {
    const nextTarget = String(targetId ?? "").trim();
    if (!nextTarget) return;

    refs.tabButtons.forEach((button) => {
      const active = button.dataset.tabTarget === nextTarget;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    refs.tabPanels.forEach((panel) => {
      const active = panel.id === nextTarget;
      panel.classList.toggle("hidden", !active);
      panel.classList.toggle("is-active", active);
    });

    setStoredActiveTab(nextTarget);
  }

  async function getStoredSessionToken() {
    if (!canUseChromeStorage()) return "";
    const data = await chrome.storage.local.get([EXTENSION_SESSION_TOKEN_KEY]);
    return normalizeSessionToken(data?.[EXTENSION_SESSION_TOKEN_KEY] ?? "");
  }

  async function setStoredSessionToken(token) {
    state.extensionSessionToken = normalizeSessionToken(token);
    if (!canUseChromeStorage()) {
      throw new Error("El almacenamiento seguro de Chrome no está disponible.");
    }
    await chrome.storage.local.set({ [EXTENSION_SESSION_TOKEN_KEY]: state.extensionSessionToken });
  }

  async function clearStoredSessionToken() {
    state.extensionSessionToken = "";
    if (canUseChromeStorage()) {
      await chrome.storage.local.remove([EXTENSION_SESSION_TOKEN_KEY]);
    }
  }

  function setView(name) {
    refs.loadingView.classList.toggle("hidden", name !== "loading");
    refs.authView.classList.toggle("hidden", name !== "auth");
    refs.appView.classList.toggle("hidden", name !== "app");
    refs.heroSession?.classList.toggle("hidden", name !== "app");
    refs.refreshData.classList.toggle("hidden", name !== "app");
    refs.openWebApp.classList.toggle("hidden", name === "app");
    refs.openWhatsAppDirect?.classList.toggle("hidden", name !== "app");
    refs.openWebAppInline?.classList.add("hidden");
    refs.authLogout?.classList.toggle("hidden", name !== "app");
  }

  function setStatus(kind, label, statusKey = "") {
    state.statusKey = statusKey;
    refs.statusPill.textContent = label;
    refs.statusPill.className = "pill";
    if (kind) refs.statusPill.classList.add(kind);
  }

  function applyPanelConfig() {
    refs.openWebApp.textContent = state.panelConfig.openSiteLabel;
    if (refs.openWhatsAppDirect) refs.openWhatsAppDirect.textContent = "WhatsApp";
    if (state.statusKey === "session_required") {
      setStatus("warning", state.panelConfig.sessionRequiredLabel, "session_required");
    }
  }

  async function loadPanelConfig() {
    try {
      const { response, data } = await fetchJson("/api/extension/panel-config");
      if (!response.ok || !data) return;
      state.panelConfig = {
        ...DEFAULT_PANEL_CONFIG,
        sessionRequiredLabel: String(data.sessionRequiredLabel ?? DEFAULT_PANEL_CONFIG.sessionRequiredLabel),
        openSiteLabel: String(data.openSiteLabel ?? DEFAULT_PANEL_CONFIG.openSiteLabel),
        openSitePath: String(data.openSitePath ?? DEFAULT_PANEL_CONFIG.openSitePath),
        openWhatsAppLabel: String(data.openWhatsAppLabel ?? DEFAULT_PANEL_CONFIG.openWhatsAppLabel),
      };
      applyPanelConfig();
    } catch {
      state.panelConfig = { ...DEFAULT_PANEL_CONFIG };
      applyPanelConfig();
    }
  }

  function setSessionRequiredStatus() {
    setStatus("warning", state.panelConfig.sessionRequiredLabel, "session_required");
  }


  function setQuoteTemplateStatus(kind, label) {
    if (!refs.quoteTemplateStatus) return;
    refs.quoteTemplateStatus.className = "pill";
    if (kind) refs.quoteTemplateStatus.classList.add(kind);
    refs.quoteTemplateStatus.textContent = label;
  }

  function updateSendQuoteState() {
    if (!refs.sendQuote) return;
    const hasQuote = Boolean(state.lastQuote);
    const hasText = Boolean(String(refs.quoteMessagePreview?.value || state.lastDraft?.messageText || "").trim());
    refs.sendQuote.disabled = !hasQuote || !hasText;
  }

  function resetQuoteMessagePreview(message = "") {
    state.lastDraft = null;
    if (refs.quoteMessagePreview) refs.quoteMessagePreview.value = message;
    setQuoteTemplateStatus("", message ? "Editable" : "Sin preparar");
    updateSendQuoteState();
  }

  function showError(element, message) {
    element.textContent = message;
    element.classList.remove("hidden");
  }

  function clearError(element) {
    element.textContent = "";
    element.classList.add("hidden");
  }

  function openUrl(path) {
    const url = path.startsWith("http") ? path : `${APP_BASE_URL}${path}`;
    if (chrome?.tabs?.create) chrome.tabs.create({ url });
    else window.open(url, "_blank", "noopener");
  }

  async function fetchJson(path, options = {}) {
    const headers = new Headers(options.headers ?? {});
    if (state.extensionSessionToken) {
      headers.set(EXTENSION_SESSION_TOKEN_HEADER, state.extensionSessionToken);
      if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${state.extensionSessionToken}`);
    }
    headers.set("x-extension-client", "chrome-sidepanel");
    headers.set("x-extension-version", chrome?.runtime?.getManifest?.().version || "unknown");
    const response = await fetch(`${APP_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    return { response, data };
  }

  async function validateSession() {
    const { response, data } = await fetchJson("/api/extension/auth/session");
    if (!response.ok || !data?.authenticated) {
      if (response.status === 401 || response.status === 403) {
        await clearStoredSessionToken();
      }
      return null;
    }
    return { email: String(data.email ?? "") };
  }

  async function validateSessionRetry() {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const session = await validateSession();
      if (session) return session;
      await delay(250);
    }
    return null;
  }

  async function loadExtensionBootstrap() {
    const { response, data } = await fetchJson("/api/ext/bootstrap", {
      headers: {
        Authorization: state.extensionSessionToken
          ? `Bearer ${state.extensionSessionToken}`
          : "",
      },
    });

    if (!response.ok || !data?.ok) {
      state.extensionBootstrap = null;
      return null;
    }

    state.extensionBootstrap = data;
    if (refs.runtimeMode) {
      const quoteMode = String(data.quoteMode || "canonical").toLowerCase();
      refs.runtimeMode.textContent = quoteMode === "canonical" ? "Backend canónico" : quoteMode;
    }
    return data;
  }

  function applyQuoteRuntime(quoteRuntime) {
    if (!quoteRuntime || typeof quoteRuntime !== "object") {
      throw new Error("quote_runtime_missing");
    }
    state.pricingOptions = Array.isArray(quoteRuntime.combinations) ? quoteRuntime.combinations : [];
    state.campuses = Array.isArray(quoteRuntime.campuses) ? quoteRuntime.campuses : [];
    state.lastSyncAt = Date.now();
    refs.syncTime.textContent = new Date(state.lastSyncAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    renderSelectors();
  }

  function populate(select, options, placeholder, forceValue) {
    const current = forceValue ?? select.value;
    const fragment = document.createDocumentFragment();
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    fragment.appendChild(empty);
    options.forEach((item) => {
      const option = document.createElement("option");
      option.value = String(item.value ?? item);
      option.textContent = String(item.label ?? item);
      fragment.appendChild(option);
    });
    select.replaceChildren(fragment);
    const exists = Array.from(select.options).some((option) => option.value === String(current ?? ""));
    select.value = exists ? String(current ?? "") : "";
    select.disabled = options.length === 0;
    refreshEnhancedSelect(select);
  }

  function renderSelectors() {
    populate(refs.tipoSelect, enrollmentOptions, "Selecciona tipo", refs.tipoSelect.value || "nuevo_ingreso");
    const enrollmentType = refs.tipoSelect.value || "nuevo_ingreso";
    const businessLines = uniq(state.pricingOptions
      .filter((option) => option.enrollmentType === enrollmentType)
      .map((option) => canonBusinessLine(option.businessLine)))
      .sort(compareByOrder(businessLineOrder))
      .map((value) => ({ value, label: labelBusinessLine(value) }));
    populate(refs.nivelSelect, businessLines, "Selecciona línea");
    const modalities = uniq(state.pricingOptions
      .filter((option) => optionMatches(option, enrollmentType, refs.nivelSelect.value))
      .map((option) => canonModality(option.modality)))
      .sort(compareByOrder(modalityOrder))
      .map((value) => ({ value, label: labelModality(value) }));
    populate(refs.modalidadSelect, modalities, "Selecciona modalidad");
    const plans = Array.from(new Set(state.pricingOptions
      .filter((option) => optionMatches(option, enrollmentType, refs.nivelSelect.value, refs.modalidadSelect.value))
      .map((option) => Number(option.plan)))).sort((a, b) => a - b);
    populate(refs.planSelect, plans.map((value) => ({ value: String(value), label: `${value} cuatrimestres` })), "Selecciona plan");
    const campusRequired = requiresCampus(refs.nivelSelect.value, refs.modalidadSelect.value);
    refs.plantelField.classList.toggle("hidden", !campusRequired);
    if (campusRequired) populate(refs.plantelSelect, state.campuses, "Selecciona plantel");
    else populate(refs.plantelSelect, [], "No aplica", "");
    const subjectsRequired = needsSubjects(refs.tipoSelect.value, refs.nivelSelect.value);
    refs.materiasField.classList.toggle("hidden", !subjectsRequired);
    if (subjectsRequired) populate(refs.materiasSelect, subjectOptions, "Selecciona materias");
    else populate(refs.materiasSelect, [], "No aplica", "");
  }

  function describeQuoteSelection(businessLine, modality, plan) {
    return [
      labelBusinessLine(businessLine),
      labelModality(modality),
      plan ? `${plan} cuatrimestres` : "",
    ].filter(Boolean).join(" · ");
  }

  function resetQuote(message = "Completa los campos para ver el resultado.", options = {}) {
    const { preserveError = false } = options;
    const safeMessage =
      typeof message === "string" && message.trim()
        ? message
        : "Completa los campos para ver el resultado.";
    if (!preserveError) clearError(refs.quoteError);
    refs.resultPanel.classList.add("hidden");
    refs.resultEmpty.textContent = safeMessage;
    refs.resultEmpty.classList.remove("hidden");
    state.lastQuote = null;
    resetQuoteMessagePreview("");
  }

  async function loadBootstrap() {
    applyQuoteRuntime(state.extensionBootstrap?.quoteRuntime);
  }

  async function syncLiveRuntime({ silent = false } = {}) {
    try {
      await loadExtensionBootstrap();
      await loadBootstrap();
      await loadBenefits();
      await loadFees();
      return true;
    } catch (error) {
      if (!silent) throw error;
      return false;
    }
  }

  async function loadBenefits() {
    const params = new URLSearchParams();
    const businessLine = refs.nivelSelect.value;
    const modality = refs.modalidadSelect.value;
    const plan = refs.planSelect.value;
    if (!businessLine || !modality || !plan) {
      state.currentBenefits = { benefit: null, firstPaymentBenefit: null };
      refs.benefitSummary.textContent = "Selecciona la combinación para consultar beneficios activos.";
      resetQuoteMessagePreview("");
      return;
    }
    if (refs.plantelSelect.value) params.set("plantel", refs.plantelSelect.value);
    params.set("businessLine", canonBusinessLine(businessLine));
    params.set("modality", canonModality(modality));
    params.set("enrollmentType", refs.tipoSelect.value);
    try {
      const { response, data } = await fetchJson(`/api/data/benefits?${params.toString()}`);
      if (!response.ok) {
        state.currentBenefits = { benefit: null, firstPaymentBenefit: null };
        refs.benefitSummary.textContent = "No fue posible consultar beneficios para esta combinación.";
        return;
      }
      const benefit = data?.benefit ?? null;
      const firstPayment = data?.firstPaymentBenefit ?? null;
      state.currentBenefits = { benefit, firstPaymentBenefit: firstPayment };
      const parts = [];
      if (benefit?.extraPercent) parts.push(`Aplica ${percent(benefit.extraPercent)} adicional.`);
      if (benefit?.duration) parts.push(`Duración: ${benefit.duration}.`);
      if (firstPayment?.firstPaymentAmount) parts.push(`Primer pago: ${money(firstPayment.firstPaymentAmount)}.`);
      refs.benefitSummary.textContent = parts.length ? parts.join(" ") : "No hay beneficios adicionales activos.";
    } catch {
      state.currentBenefits = { benefit: null, firstPaymentBenefit: null };
      refs.benefitSummary.textContent = "No fue posible consultar beneficios para esta combinación.";
    }
  }

  async function loadFees() {
    state.fees = [];
    populate(refs.feeSelect, [], "Sin cargos disponibles", "");
    refs.feeAmount.value = "";
    if (!refs.plantelSelect.value) return;
    try {
      const { response, data } = await fetchJson(`/api/public/costos?campus=${encodeURIComponent(refs.plantelSelect.value)}`);
      if (!response.ok) return;
      state.fees = Array.isArray(data?.fees) ? data.fees : [];
      populate(refs.feeSelect, state.fees.map((fee) => ({ value: fee.id, label: `${fee.concept} · ${money(fee.costMxn)}` })), "Selecciona cargo");
    } catch {
      state.fees = [];
      populate(refs.feeSelect, [], "Sin cargos disponibles", "");
    }
  }

  function selectedFeeAmount() {
    const fee = state.fees.find((item) => item.id === refs.feeSelect.value);
    return fee ? Number(fee.costMxn) : 0;
  }

  async function resolveQuoteWithFallback(payload) {
    let primary = null;

    try {
      primary = await fetchJson("/api/ext/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (primary.response.ok && primary.data?.ok) return primary.data;
    } catch (error) {
      primary = {
        response: { ok: false },
        data: {
          ok: false,
          error: error instanceof Error ? error.message : "No fue posible conectar con ReCalc.",
          source: "remote_error",
        },
      };
    }

    try {
      const canonical = await fetchJson("/api/data/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, clientSurface: "chrome_side_panel_fallback" }),
      });
      if (canonical.response.ok && canonical.data?.ok) {
        return {
          ...canonical.data,
          source: canonical.data.source ?? "recalc_canonical_fallback",
          modeUsed: canonical.data.modeUsed ?? "recalc_canonical_fallback",
        };
      }
    } catch {
      // La cotización ya no usa fallback local; se devuelve el error remoto.
    }

    return primary?.data ?? {
      ok: false,
      error: "No fue posible calcular la cotización.",
      source: "quote_unavailable",
      modeUsed: "quote_unavailable",
    };
  }

  async function calculateQuote() {
    clearError(refs.quoteError);
    const businessLine = refs.nivelSelect.value;
    const modality = refs.modalidadSelect.value;
    const plan = Number(refs.planSelect.value || 0);
    const average = decimal(refs.promedioInput.value);
    const subjects = refs.materiasSelect.value ? Number(refs.materiasSelect.value) : null;
    const extraCharge = refs.extraEnabled.checked ? selectedFeeAmount() : 0;
    if (!businessLine || !modality || !plan || average === null) {
      showError(refs.quoteError, "Completa tipo, línea, modalidad, plan y promedio.");
      resetQuote("Completa los campos requeridos y vuelve a calcular.", { preserveError: true });
      return;
    }
    if (requiresCampus(businessLine, modality) && !refs.plantelSelect.value) {
      showError(refs.quoteError, "Selecciona el plantel.");
      resetQuote("Selecciona el plantel para continuar.", { preserveError: true });
      return;
    }
    if (needsSubjects(refs.tipoSelect.value, businessLine) && !subjects) {
      showError(refs.quoteError, "Selecciona las materias inscritas.");
      resetQuote("Selecciona las materias inscritas y vuelve a calcular.", { preserveError: true });
      return;
    }
    refs.resultEmpty.textContent = "Consultando cotización...";
    refs.resultEmpty.classList.remove("hidden");
    refs.resultPanel.classList.add("hidden");
    refs.calculateBtn.disabled = true;
    refs.calculateBtn.textContent = "Consultando...";
    try {
      const quotePayload = {
        enrollmentType: refs.tipoSelect.value,
        businessLine: canonBusinessLine(businessLine),
        modality: canonModality(modality),
        plan,
        campus: refs.plantelSelect.value || null,
        average,
        subjectCount: subjects,
        extraCharge,
        clientSurface: "chrome_side_panel",
      };
      const data = await resolveQuoteWithFallback(quotePayload);
      if (!data?.ok) {
        const backendMessage = [data?.error, data?.hint, Array.isArray(data?.ranges) ? `Rangos válidos: ${data.ranges.join(", ")}` : ""]
          .filter(Boolean)
          .join(" ");
        showError(refs.quoteError, backendMessage || "No fue posible calcular la cotización.");
        resetQuote("Ajusta la combinación y vuelve a calcular.", { preserveError: true });
        return;
      }
      const scholarshipPercent = Number(data.scholarshipPercent || 0);
      const scholarshipAmount = Number(data.scholarshipAmountMxn || 0);
      const additionalBenefitPercent = Number(data.additionalBenefitPercent || 0);
      const additionalBenefitAmount = Number(data.additionalBenefitAmountMxn || 0);
      const subtotal = Number(data.subtotalMxn || 0);
      const finalTotal = Number(data.totalMxn || 0);
      const primaryTotal = extraCharge > 0 ? subtotal : finalTotal;
      refs.resultTotal.textContent = money(primaryTotal);
      if (data.sinAccessToScholarship) {
        refs.resultSummary.textContent = additionalBenefitPercent > 0
          ? `Sin acceso a beca. Sí aplica beneficio adicional de ${percent(additionalBenefitPercent)}.`
          : "Sin acceso a beca con el promedio capturado.";
      } else if (additionalBenefitPercent > 0) {
        refs.resultSummary.textContent = `Incluye beca de ${percent(scholarshipPercent)}. También aplica beneficio adicional de ${percent(additionalBenefitPercent)}.`;
      } else {
        refs.resultSummary.textContent = `Incluye beca de ${percent(scholarshipPercent)}.`;
      }
      refs.resultBase.textContent = money(data.basePriceMxn);
      refs.resultScholarship.textContent = `-${money(scholarshipAmount)}`;
      refs.resultSubtotal.textContent = money(subtotal);
      refs.resultBenefit.textContent = `-${money(additionalBenefitAmount)}`;
      refs.resultExtra.textContent = money(extraCharge);
      refs.resultFirstPayment.textContent = money(data.firstPaymentAmountMxn);
      if (refs.resultFirstPaymentCard) {
        const hasFirstPayment = Number(data.firstPaymentAmountMxn || 0) > 0;
        refs.resultFirstPaymentCard.classList.toggle("hidden", !hasFirstPayment);
        if (refs.resultFirstPaymentHero) refs.resultFirstPaymentHero.textContent = money(data.firstPaymentAmountMxn);
        if (refs.resultFirstPaymentCopy) {
          refs.resultFirstPaymentCopy.textContent = [
            data.firstPaymentNotes ?? "",
          ].filter(Boolean).join(" · ");
        }
      }
      if (refs.resultFinalTotalLine) {
        refs.resultFinalTotalLine.classList.toggle("hidden", !(extraCharge > 0));
        if (refs.resultFinalTotal) refs.resultFinalTotal.textContent = money(finalTotal);
      }
      refs.resultMeta.textContent = [
        "Backend Scholarship en vivo",
        describeQuoteSelection(businessLine, modality, plan),
        refs.plantelSelect.value || (canonModality(modality) === "online" ? "Online" : ""),
        data.tier ? `Tier ${data.tier}` : "",
        data.additionalBenefitDuration ? `Beneficio: ${data.additionalBenefitDuration}` : "",
        data.firstPaymentDuration ? `Primer pago: ${data.firstPaymentDuration}` : "",
      ].filter(Boolean).join(" · ") || "Resultado sincronizado con el backend oficial.";
      if (refs.quoteSource) {
        refs.quoteSource.textContent = data.modeUsed === "canonical"
          ? "Backend canónico"
          : "Backend en vivo";
      }
      state.lastQuote = {
        enrollmentType: refs.tipoSelect.value,
        businessLine: canonBusinessLine(businessLine),
        modality: canonModality(modality),
        plan,
        campus: refs.plantelSelect.value || null,
        totalMxn: finalTotal,
        subtotalMxn: subtotal,
        basePriceMxn: data.basePriceMxn,
        scholarshipPercent: data.scholarshipPercent,
        scholarshipAmountMxn: scholarshipAmount,
        additionalBenefitPercent,
        additionalBenefitAmountMxn: additionalBenefitAmount,
        firstPaymentAmountMxn: data.firstPaymentAmountMxn,
        firstPaymentDuration: data.firstPaymentDuration ?? null,
        firstPaymentNotes: data.firstPaymentNotes ?? null,
        additionalBenefitDuration: data.additionalBenefitDuration ?? null,
        additionalBenefitNotes: data.additionalBenefitNotes ?? null,
      };
      refs.resultEmpty.classList.add("hidden");
      refs.resultPanel.classList.remove("hidden");
      try {
        await refreshQuoteMessagePreview();
      } catch {
        // No bloquear la visualización de la cotización si el template falla.
      }
    } catch {
      showError(refs.quoteError, "No fue posible consultar la cotización con el backend.");
      resetQuote("Revisa tu sesión o la combinación capturada y vuelve a intentar.", {
        preserveError: true,
      });
    } finally {
      refs.calculateBtn.disabled = false;
      refs.calculateBtn.textContent = "Calcular beca";
    }
  }

  async function signIn(event) {
    event.preventDefault();
    clearError(refs.authError);
    refs.authSubmit.disabled = true;
    refs.authSubmit.textContent = "Entrando...";
    setStatus("warning", "Autenticando", "authenticating");
    const { response, data } = await fetchJson("/api/extension/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: refs.authEmail.value.trim().toLowerCase(),
        password: refs.authPassword.value,
        next: "/extension",
      }),
    });
    if (!response.ok || !data?.ok) {
      refs.authSubmit.disabled = false;
      refs.authSubmit.textContent = "Entrar";
      setStatus("danger", "Error de acceso", "auth_error");
      showError(refs.authError, data?.error ?? "No fue posible iniciar sesión.");
      return;
    }
    if (data?.extensionSessionToken) {
      await setStoredSessionToken(data.extensionSessionToken);
    }
    const session = await validateSessionRetry();
    refs.authSubmit.disabled = false;
    refs.authSubmit.textContent = "Entrar";
    if (!session) {
      setStatus("danger", "Sesión inválida", "invalid_session");
      showError(refs.authError, "No fue posible validar la sesión dentro de la extensión.");
      return;
    }
    state.email = session.email;
    refs.sessionEmail.textContent = session.email;
    setView("loading");
    setStatus("success", "Sincronizando", "syncing");
    try {
      await syncLiveRuntime();
      setStatus("success", "Conectado", "connected");
      setView("app");
    } catch {
      setStatus("danger", "Fallo de API", "api_error");
      showError(refs.authError, "La sesión se creó, pero no fue posible sincronizar datos del backend.");
      setView("auth");
    }
  }

  async function signOut() {
    try {
      await fetchJson("/api/extension/auth/sign-out", { method: "POST" });
    } catch {
      // Ignore remote sign-out failures.
    }
    await clearStoredSessionToken();
    state.email = "";
    state.extensionBootstrap = null;
    state.lastQuote = null;
    refs.authPassword.value = "";
    refs.sessionEmail.textContent = "Sin correo";
    refs.syncTime.textContent = "Pendiente";
    refs.benefitSummary.textContent = "Selecciona la combinación para consultar beneficios activos.";
    resetQuoteMessagePreview("");
    refs.extraEnabled.checked = false;
    refs.extraFields.classList.add("hidden");
    renderSelectors();
    resetQuote();
    setSessionRequiredStatus();
    setView("auth");
  }

  async function bootstrap() {
    setView("loading");
    state.extensionSessionToken = await getStoredSessionToken();
    await loadPanelConfig();
    setStatus("warning", "Validando sesión", "validating");
    renderSelectors();
    initializeEnhancedSelects();
    const session = await validateSession();
    if (!session) {
      setSessionRequiredStatus();
      setView("auth");
      return;
    }
    state.email = session.email;
    refs.sessionEmail.textContent = session.email;
    try {
      await syncLiveRuntime();
      refs.syncTime.textContent = state.lastSyncAt
        ? new Date(state.lastSyncAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
        : "Pendiente";
      setStatus("success", "Conectado", "connected");
      setView("app");
    } catch {
      setStatus("danger", "Fallo de API", "api_error");
      showError(refs.authError, "No fue posible sincronizar el panel con Scholarship.");
      setView("auth");
    }
  }

  async function refreshDependents() {
    renderSelectors();
    refs.extraFields.classList.toggle("hidden", !refs.extraEnabled.checked);
    refs.feeAmount.value = refs.extraEnabled.checked ? refs.feeAmount.value : "";
    resetQuote();
    await loadBenefits();
    await loadFees();
  }

  async function createExtensionRun(payload) {
    const { response, data } = await fetchJson("/api/ext/runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: state.extensionSessionToken
          ? `Bearer ${state.extensionSessionToken}`
          : "",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !data?.ok || !data?.runId) {
      throw new Error(data?.error || "No fue posible crear el run de extensión.");
    }

    return data.runId;
  }

  async function logExtensionRunEvent(runId, payload) {
    const { response, data } = await fetchJson(`/api/ext/runs/${encodeURIComponent(runId)}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: state.extensionSessionToken
          ? `Bearer ${state.extensionSessionToken}`
          : "",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "No fue posible registrar el evento de extensión.");
    }
  }

  async function fetchWhatsappDraft(quoteOverride = state.lastQuote) {
    const { response, data } = await fetchJson("/api/ext/whatsapp/draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: state.extensionSessionToken
          ? `Bearer ${state.extensionSessionToken}`
          : "",
      },
      body: JSON.stringify({
        quote: quoteOverride,
      }),
    });

    if (!response.ok || !data?.ok || !data?.messageText) {
      throw new Error(data?.error || "No fue posible preparar el borrador de WhatsApp.");
    }

    return data;
  }

  async function refreshQuoteMessagePreview() {
    if (!state.lastQuote) {
      resetQuoteMessagePreview("");
      return null;
    }

    setQuoteTemplateStatus("warning", "Preparando");
    try {
      const draft = await fetchWhatsappDraft(state.lastQuote);
      state.lastDraft = draft;
      if (refs.quoteMessagePreview) {
        refs.quoteMessagePreview.value = draft.messageText || "";
      }
      setQuoteTemplateStatus("success", draft.template?.name ? `Template: ${draft.template.name}` : "Editable");
      updateSendQuoteState();
      return draft;
    } catch (error) {
      setQuoteTemplateStatus("danger", "Sin template");
      if (refs.quoteMessagePreview) {
        refs.quoteMessagePreview.value = "";
      }
      updateSendQuoteState();
      throw error;
    }
  }

  async function sendQuoteToWhatsApp() {
    if (!state.lastQuote) {
      showError(refs.quoteError, "Primero calcula la beca para preparar la cotización.");
      return;
    }

    refs.sendQuote.disabled = true;
    const originalLabel = refs.sendQuote.textContent;
    refs.sendQuote.textContent = "Mandando...";

    try {
      let draft = state.lastDraft;
      if (!draft) {
        draft = await refreshQuoteMessagePreview();
      }
      const draftText = String(refs.quoteMessagePreview?.value || draft?.messageText || "").trim();
      if (!draftText) {
        throw new Error("No hay texto listo para enviar a WhatsApp.");
      }

      const runId = await createExtensionRun({
        campaignName: "WhatsApp handoff",
        status: "requested",
        meta: {
          source: "chrome_side_panel",
          userEmail: state.email,
          templateId: draft?.template?.id ?? null,
          templateName: draft?.template?.name ?? null,
        },
      });

      await logExtensionRunEvent(runId, {
        eventType: "whatsapp_draft_prepared",
        message: "La cotización quedó preparada desde el side panel.",
        metaJson: {
          source: "chrome_side_panel",
          panelConfig: state.extensionBootstrap?.panelConfig ?? null,
          quote: state.lastQuote,
          template: draft?.template ?? null,
        },
      });

      if (chrome?.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({
          type: "OPEN_WHATSAPP",
          appBaseUrl: APP_BASE_URL,
          extensionSessionToken: state.extensionSessionToken,
          runId,
          draftText,
          selectorPack: state.extensionBootstrap?.selectorPack ?? null,
        });

        if (!response?.ok) {
          throw new Error(response?.error || "No fue posible abrir WhatsApp Web.");
        }
      } else {
        openUrl("https://web.whatsapp.com/");
      }
    } catch (error) {
      showError(
        refs.quoteError,
        error instanceof Error
          ? error.message
          : "No fue posible mandar la cotización desde la extensión.",
      );
    } finally {
      updateSendQuoteState();
      refs.sendQuote.textContent = originalLabel || "Mandar cotización";
    }
  }

  refs.openWebApp.addEventListener("click", () => openUrl(state.panelConfig.openSitePath));
  refs.openWebAppInline?.addEventListener("click", () => openUrl(state.panelConfig.openSitePath));
  refs.openWhatsAppDirect?.addEventListener("click", () => openUrl("https://web.whatsapp.com/"));
  refs.openSignup.addEventListener("click", () => openUrl("/auth/sign-up"));
  refs.openReset.addEventListener("click", () => openUrl("/auth/forgot-password"));
  refs.authForm.addEventListener("submit", (event) => void signIn(event));
  refs.authLogout.addEventListener("click", () => void signOut());
  refs.refreshData.addEventListener("click", async () => {
    refs.refreshData.disabled = true;
    refs.refreshData.textContent = "Sincronizando...";
    try {
      await syncLiveRuntime();
      await loadPanelConfig();
      setStatus("success", "Conectado", "connected");
    } catch {
      setStatus("danger", "Fallo de API", "api_error");
      showError(refs.quoteError, "No fue posible refrescar los datos del panel.");
    } finally {
      refs.refreshData.disabled = false;
      refs.refreshData.textContent = "Sync";
    }
  });
  refs.sendQuote.addEventListener("click", () => void sendQuoteToWhatsApp());
  refs.calculateBtn.addEventListener("click", () => void calculateQuote());
  refs.resetForm.addEventListener("click", () => {
    refs.tipoSelect.value = "nuevo_ingreso";
    refs.nivelSelect.value = "";
    refs.modalidadSelect.value = "";
    refs.planSelect.value = "";
    refs.plantelSelect.value = "";
    refs.materiasSelect.value = "";
    refs.promedioInput.value = "";
    refs.extraEnabled.checked = false;
    refs.extraFields.classList.add("hidden");
    refs.feeSelect.value = "";
    refs.feeAmount.value = "";
    refs.benefitSummary.textContent = "Selecciona la combinación para consultar beneficios activos.";
    resetQuoteMessagePreview("");
    renderSelectors();
    resetQuote();
  });
  [refs.tipoSelect, refs.nivelSelect, refs.modalidadSelect, refs.planSelect, refs.plantelSelect, refs.materiasSelect].forEach((element) => {
    element.addEventListener("change", () => void refreshDependents());
  });
  refs.extraEnabled.addEventListener("change", () => {
    refs.extraFields.classList.toggle("hidden", !refs.extraEnabled.checked);
    refs.feeAmount.value = refs.extraEnabled.checked ? refs.feeAmount.value : "";
    resetQuote();
  });
  refs.feeSelect.addEventListener("change", () => {
    refs.feeAmount.value = refs.feeSelect.value ? money(selectedFeeAmount()) : "";
    resetQuote();
  });
  refs.promedioInput.addEventListener("input", () => resetQuote());

  refs.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tabTarget || "quote-panel");
    });
  });

  refs.quoteMessagePreview?.addEventListener("input", () => {
    if (!refs.quoteMessagePreview.value.trim()) {
      setQuoteTemplateStatus("warning", "Sin texto");
      updateSendQuoteState();
      return;
    }
    setQuoteTemplateStatus("success", "Editable");
    updateSendQuoteState();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void loadPanelConfig();
      if (!refs.appView?.classList.contains("hidden")) {
        void syncLiveRuntime({ silent: true });
      }
    }
  });

  window.setInterval(() => {
    void loadPanelConfig();
  }, PANEL_CONFIG_REFRESH_MS);

  window.setInterval(() => {
    if (document.hidden) return;
    if (refs.appView?.classList.contains("hidden")) return;
    void syncLiveRuntime({ silent: true });
  }, DATA_REFRESH_MS);

  activateTab(getStoredActiveTab() || "quote-panel");
  void bootstrap();
});
