"use client";

export const WEB_CAMPAIGN_SELECTION_STORAGE_KEY =
  "recalc.webCampaignContactSelection";

export type WebCampaignSelectableContact = {
  id: string;
  contactName: string;
  phone: string;
  normalizedPhone: string;
  email: string | null;
};

function isValidSelectionRow(value: unknown): value is WebCampaignSelectableContact {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.contactName === "string" &&
    typeof record.phone === "string" &&
    typeof record.normalizedPhone === "string" &&
    (typeof record.email === "string" || record.email === null)
  );
}

export function dedupeWebCampaignSelection(
  contacts: WebCampaignSelectableContact[],
) {
  const byPhone = new Map<string, WebCampaignSelectableContact>();

  for (const contact of contacts) {
    const key = String(contact.normalizedPhone || contact.phone).trim();
    if (!key || byPhone.has(key)) continue;
    byPhone.set(key, contact);
  }

  return Array.from(byPhone.values());
}

export function readWebCampaignSelection() {
  if (typeof window === "undefined") return [] as WebCampaignSelectableContact[];

  try {
    const raw = window.localStorage.getItem(WEB_CAMPAIGN_SELECTION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return dedupeWebCampaignSelection(parsed.filter(isValidSelectionRow));
  } catch {
    return [];
  }
}

export function writeWebCampaignSelection(
  contacts: WebCampaignSelectableContact[],
) {
  if (typeof window === "undefined") return;

  const normalized = dedupeWebCampaignSelection(contacts);
  window.localStorage.setItem(
    WEB_CAMPAIGN_SELECTION_STORAGE_KEY,
    JSON.stringify(normalized),
  );
}

export function buildRecipientsTextFromSelection(
  contacts: WebCampaignSelectableContact[],
) {
  return dedupeWebCampaignSelection(contacts)
    .map((contact) => `${contact.contactName || contact.phone}, ${contact.phone}`)
    .join("\n");
}
