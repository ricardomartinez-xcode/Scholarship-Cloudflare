type CampaignTemplateRecipient = {
  contactName?: string | null;
  contactValue: string;
  payload?: Record<string, unknown> | null;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeMultilineText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function normalizeContactValue(value: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  const looksLikePhone = /^[+\d\s().-]+$/.test(normalized);
  if (!looksLikePhone) {
    return normalized.replace(/\s+/g, " ");
  }

  const hasPlus = normalized.startsWith("+");
  const digits = normalized.replace(/\D+/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

function normalizeVariableKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function normalizeVariableValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return normalizeText(String(value));
}

function buildTemplateVariables(recipient: CampaignTemplateRecipient) {
  const name = normalizeText(recipient.contactName) || "prospecto";
  const contactValue = normalizeContactValue(recipient.contactValue);
  const variables: Record<string, string> = {
    nombre: name,
    name,
    contacto: name,
    contact: name,
    nombre_completo: name,
    contact_name: name,
    numero: contactValue,
    number: contactValue,
    telefono: contactValue,
    phone: contactValue,
    contact_value: contactValue,
  };

  if (
    recipient.payload &&
    typeof recipient.payload === "object" &&
    !Array.isArray(recipient.payload)
  ) {
    for (const [key, value] of Object.entries(recipient.payload)) {
      const normalizedKey = normalizeVariableKey(key);
      if (normalizedKey) {
        variables[normalizedKey] = normalizeVariableValue(value);
      }
    }
  }

  return variables;
}

export function renderCampaignMessageTemplate(
  template: string | null | undefined,
  recipient: CampaignTemplateRecipient,
) {
  const normalizedTemplate = normalizeMultilineText(template);
  if (!normalizedTemplate) return "";

  const variables = buildTemplateVariables(recipient);
  return normalizedTemplate.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawToken) => {
    return variables[normalizeVariableKey(rawToken)] ?? "";
  });
}
