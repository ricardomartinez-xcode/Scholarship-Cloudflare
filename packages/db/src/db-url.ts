export function resolveDatabaseUrl(): string | null {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? process.env.DIRECT_URL ?? null;
}
export function resolveDirectDatabaseUrl(): string | null {
  return process.env.DIRECT_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL_UNPOOLED ?? (() => {
    const url = resolveDatabaseUrl();
    return url && !url.startsWith("prisma+postgres://") ? url : null;
  })() ?? null;
}
export function ensureDatabaseUrl(): string {
  const url = resolveDatabaseUrl();
  if (!url) {
    if (!process.env.VERCEL) {
      const fallback = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
      process.env.DATABASE_URL ??= fallback;
      process.env.DIRECT_URL ??= fallback;
      return fallback;
    }
    throw new Error("DATABASE_URL is not set.");
  }
  process.env.DATABASE_URL ??= url;
  const direct = resolveDirectDatabaseUrl();
  if (direct) process.env.DIRECT_URL ??= direct;
  return url;
}
export function ensureDirectDatabaseUrl(): string {
  const url = resolveDirectDatabaseUrl();
  if (!url) {
    if (!process.env.VERCEL) return "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
    throw new Error("DIRECT_URL or POSTGRES_URL_NON_POOLING is not set.");
  }
  return url;
}
