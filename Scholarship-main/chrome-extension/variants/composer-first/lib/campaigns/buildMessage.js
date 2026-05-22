(function attachRecalcBuildMessage(globalScope) {
  function normalizeKey(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  function cleanText(value) {
    return String(value ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function buildVariableMap(recipient, variables) {
    const map = {
      nombre: recipient?.contactName || recipient?.name || "",
      telefono: recipient?.contactValue || recipient?.phone || "",
      numero: recipient?.contactValue || recipient?.phone || "",
      contactname: recipient?.contactName || recipient?.name || "",
      contactvalue: recipient?.contactValue || recipient?.phone || "",
    };

    const sources = [recipient?.payload, recipient, variables];
    sources.forEach((source) => {
      if (!source || typeof source !== "object") return;
      Object.entries(source).forEach(([key, value]) => {
        map[normalizeKey(key)] = value == null ? "" : String(value);
      });
    });

    return map;
  }

  function interpolateTemplate(template, recipient, variables) {
    const normalizedTemplate = String(template ?? "");
    if (!normalizedTemplate.trim()) return "";

    const map = buildVariableMap(recipient, variables);
    return normalizedTemplate.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, token) => {
      const key = normalizeKey(token);
      return key in map ? String(map[key] ?? "") : "";
    });
  }

  function buildMessage(template, recipient, variables, options) {
    const text = cleanText(interpolateTemplate(template, recipient, variables));
    if (!options || typeof options !== "object") return text;

    if (options.textAsCaption) {
      return text;
    }

    return text;
  }

  globalScope.RecalcBuildMessage = {
    cleanText,
    interpolateTemplate,
    buildMessage,
  };
})(typeof self !== "undefined" ? self : window);
