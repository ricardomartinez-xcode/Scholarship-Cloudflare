import { normalizeEmail } from "@/lib/normalize";

export const ROOT_ADMIN_EMAIL = String(process.env.ADMIN_EMAIL ?? "")
  .trim()
  .toLowerCase();

const parseCsv = (value?: string | null) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const EXTRA_ALLOWED_EMAILS = new Set(parseCsv(process.env.ALLOWED_EMAILS));
const EXTRA_ALLOWED_DOMAINS = parseCsv(process.env.ALLOWED_EMAIL_DOMAINS).map(
  (domain) => domain.replace(/^\*@/, "@").replace(/^\./, "@")
);

export const isRootAdminEmail = (email?: string | null) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (!ROOT_ADMIN_EMAIL) return false;
  return normalized === ROOT_ADMIN_EMAIL;
};

export const isAdminEmail = isRootAdminEmail;

export const getRootAdminEmailOrNull = () => ROOT_ADMIN_EMAIL || null;

export const isAllowedUnidepEmail = (email?: string | null) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return (
    normalized.endsWith("@unidep.edu.mx") ||
    normalized.endsWith(".unidep.edu.mx")
  );
};

export const isAllowedByEnv = (email?: string | null) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (EXTRA_ALLOWED_EMAILS.has(normalized)) return true;
  return EXTRA_ALLOWED_DOMAINS.some((domain) => normalized.endsWith(domain));
};

export const isAllowedEmail = (email?: string | null) =>
  isRootAdminEmail(email) || isAllowedUnidepEmail(email) || isAllowedByEnv(email);
