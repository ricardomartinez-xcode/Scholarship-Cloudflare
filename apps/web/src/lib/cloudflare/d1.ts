import "server-only";

import { prisma } from "@/lib/prisma";
import type { AppD1Database, D1PreparedStatement, D1Result } from "@/lib/d1/contracts";

export type D1Value = string | number | boolean | null;

export type D1DatabaseBinding = AppD1Database;

function postgresPlaceholders(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function sqliteMasterTableName(sql: string) {
  const match = /\bname\s*=\s*'([^']+)'/i.exec(sql);
  return match?.[1] ?? null;
}

class PostgresD1PreparedStatement implements D1PreparedStatement {
  constructor(
    private readonly sql: string,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new PostgresD1PreparedStatement(this.sql, values);
  }

  async first<T = Record<string, unknown>>() {
    const rows = await this.all<T>();
    return rows.results[0] ?? null;
  }

  async all<T = Record<string, unknown>>() {
    if (/^\s*PRAGMA\s+foreign_key_check/i.test(this.sql)) {
      return { results: [] as T[], success: true };
    }

    if (/\bFROM\s+sqlite_master\b/i.test(this.sql)) {
      const literalName = sqliteMasterTableName(this.sql);
      const names = this.values.length ? this.values : literalName ? [literalName] : [];
      const filters = names.length
        ? `AND table_name IN (${names.map((_, index) => `$${index + 1}`).join(", ")})`
        : "";
      const rows = await prisma.$queryRawUnsafe<T[]>(
        `SELECT table_name AS name
           FROM information_schema.tables
          WHERE table_schema IN ('recalc_admin', 'public')
            AND table_type = 'BASE TABLE'
            ${filters}`,
        ...names,
      );
      return { results: rows, success: true };
    }

    const rows = await prisma.$queryRawUnsafe<T[]>(
      postgresPlaceholders(this.sql),
      ...this.values,
    );
    return { results: rows, success: true };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const changes = await prisma.$executeRawUnsafe(
      postgresPlaceholders(this.sql),
      ...this.values,
    );
    return {
      success: true,
      meta: {
        changes,
        rows_written: changes,
      },
    };
  }
}

class PostgresD1CompatDatabase implements AppD1Database {
  prepare(query: string) {
    return new PostgresD1PreparedStatement(query);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]) {
    const results: D1Result<T>[] = [];
    for (const statement of statements) {
      results.push(await statement.run<T>());
    }
    return results;
  }
}

const d1Compat = new PostgresD1CompatDatabase();

export function getD1() {
  return d1Compat;
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
