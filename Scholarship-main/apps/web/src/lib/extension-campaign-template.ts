const CAMPAIGN_TEMPLATE_TOKEN = /\{\{\s*(nombre|name|numero|number|contacto|contact)\s*\}\}/gi;

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

export function renderCampaignMessageTemplate(
  template: string | null | undefined,
  recipient: {
    contactName?: string | null;
    contactValue: string;
  },
) {
  const normalizedTemplate = normalizeMultilineText(template);
  if (!normalizedTemplate) return "";

  return normalizedTemplate.replace(CAMPAIGN_TEMPLATE_TOKEN, (_match, rawToken) => {
    const token = String(rawToken ?? "").trim().toLowerCase();
    if (token === "nombre" || token === "name") {
      return normalizeText(recipient.contactName) || "prospecto";
    }
    return normalizeContactValue(recipient.contactValue);
  });
}
