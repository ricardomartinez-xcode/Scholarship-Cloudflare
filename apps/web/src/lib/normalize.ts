/**
 * Shared string normalization utilities.
 * Centralizes email normalization to avoid drift across modules.
 */

export const normalizeEmail = (email?: string | null): string =>
  (email ?? "").trim().toLowerCase();
