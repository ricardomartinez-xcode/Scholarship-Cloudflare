import type { JsonObject } from "./contracts";

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export function parseJsonObject(value: string | null | undefined): JsonObject {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : {};
  } catch {
    return {};
  }
}
