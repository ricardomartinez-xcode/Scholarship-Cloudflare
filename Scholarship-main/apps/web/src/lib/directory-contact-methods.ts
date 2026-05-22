import { normalizeEmail } from "@/lib/normalize";
import { normalizeKey } from "@/lib/text-normalize";

export const DIRECTORY_CONTACT_METHOD_TYPES = [
  "EMAIL",
  "PHONE",
  "WHATSAPP",
  "URL",
  "OTHER",
] as const;

export type DirectoryContactMethodValue =
  (typeof DIRECTORY_CONTACT_METHOD_TYPES)[number];

export type DirectoryContactMethodRecord = {
  type: DirectoryContactMethodValue;
  value: string;
  normalizedValue: string;
  isPrimary: boolean;
  sortOrder: number;
};

export function splitDirectoryContactValues(
  value: string | null | undefined,
): string[] {
  return String(value ?? "")
    .split(/\r?\n|[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function classifyDirectoryContactValue(
  value: string,
): DirectoryContactMethodValue {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "EMAIL";
  }
  if (
    lower.includes("wa.me/") ||
    lower.includes("whatsapp") ||
    lower.startsWith("https://wa.me/") ||
    lower.startsWith("http://wa.me/")
  ) {
    return "WHATSAPP";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return "URL";
  }
  if (digitsOnly(trimmed).length >= 7) {
    return "PHONE";
  }
  return "OTHER";
}

export function normalizeDirectoryContactValue(
  type: DirectoryContactMethodValue,
  value: string,
) {
  if (type === "EMAIL") return normalizeEmail(value);
  if (type === "PHONE" || type === "WHATSAPP") return digitsOnly(value);
  if (type === "URL") return value.trim().toLowerCase();
  return normalizeKey(value);
}

export function parseDirectoryContactMethods(
  rawValue: string | null | undefined,
): DirectoryContactMethodRecord[] {
  const values = splitDirectoryContactValues(rawValue);
  const unique = new Set<string>();
  const parsed: DirectoryContactMethodRecord[] = [];

  values.forEach((value, index) => {
    const type = classifyDirectoryContactValue(value);
    const normalizedValue = normalizeDirectoryContactValue(type, value);
    const dedupeKey = `${type}:${normalizedValue}`;
    if (!normalizedValue || unique.has(dedupeKey)) return;
    unique.add(dedupeKey);
    parsed.push({
      type,
      value,
      normalizedValue,
      isPrimary: parsed.length === 0,
      sortOrder: index,
    });
  });

  return parsed;
}

export function buildDirectoryContactHref(
  method: Pick<DirectoryContactMethodRecord, "type" | "value">,
) {
  if (method.type === "EMAIL") {
    return `mailto:${method.value}`;
  }
  if (method.type === "WHATSAPP") {
    const digits = digitsOnly(method.value);
    return digits ? `https://wa.me/${digits}` : null;
  }
  if (method.type === "PHONE") {
    const digits = digitsOnly(method.value);
    return digits ? `tel:${digits}` : null;
  }
  if (method.type === "URL") {
    return method.value;
  }
  return null;
}

export function stringifyDirectoryContactMethods(
  methods: Array<Pick<DirectoryContactMethodRecord, "value">>,
) {
  return methods.map((method) => method.value.trim()).filter(Boolean).join(" | ");
}
