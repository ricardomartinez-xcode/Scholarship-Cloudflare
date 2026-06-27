/**
 * Minimal D1 structural types. They work whether your project uses generated
 * Wrangler bindings or @cloudflare/workers-types.
 */
export interface D1Result<T = unknown> {
  success: boolean;
  results?: T[];
  meta?: {
    changed_db?: boolean;
    changes?: number;
    duration?: number;
    rows_read?: number;
    rows_written?: number;
  };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface AppD1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export type JsonObject = Record<string, unknown>;

export interface AppD1Env {
  DB: AppD1Database;
  GOOGLE_TOKEN_ENCRYPTION_KEY?: string;
  GOOGLE_TOKEN_KEY_VERSION?: string;
}
