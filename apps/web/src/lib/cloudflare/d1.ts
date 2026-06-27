import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { AppD1Database } from "@/lib/d1/contracts";

export type D1Value = string | number | boolean | null;

export type D1DatabaseBinding = AppD1Database;

type CloudflareD1Env = {
  DB: D1DatabaseBinding;
};

export function getD1() {
  const { env } = getCloudflareContext();
  const db = (env as unknown as CloudflareD1Env).DB;
  if (!db) {
    throw new Error("Cloudflare D1 binding DB is not configured.");
  }
  return db;
}

export async function d1All<T = unknown>(sql: string, params: D1Value[] = []) {
  const statement = getD1().prepare(sql);
  const { results } = params.length
    ? await statement.bind(...params).all<T>()
    : await statement.all<T>();
  return results;
}

export async function d1First<T = unknown>(sql: string, params: D1Value[] = []) {
  const statement = getD1().prepare(sql);
  return params.length ? statement.bind(...params).first<T>() : statement.first<T>();
}

export async function d1Run(sql: string, params: D1Value[] = []) {
  const statement = getD1().prepare(sql);
  return params.length ? statement.bind(...params).run() : statement.run();
}

export function parseD1Json<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
