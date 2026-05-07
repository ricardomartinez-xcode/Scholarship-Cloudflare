export function normalizeColumnName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}
