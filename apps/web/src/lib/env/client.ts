import { parseClientEnv } from "./shared";

export type { ClientEnv } from "./shared";

let cachedClientEnv: ReturnType<typeof parseClientEnv> | null = null;

export function getClientEnv() {
  cachedClientEnv ??= parseClientEnv(process.env);
  return cachedClientEnv;
}
