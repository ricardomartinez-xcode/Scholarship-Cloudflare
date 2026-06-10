import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrl } from "./db-url";
import { normalizeAcademicProgramKey, normalizeAcademicProgramName } from "./program-name-normalization";

ensureDatabaseUrl();

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeProgramData(data: unknown): unknown {
  if (!isRecord(data)) return data;

  const next: AnyRecord = { ...data };
  if (typeof next.name === "string") {
    const normalized = normalizeAcademicProgramName(next.name);
    next.name = normalized.name;
    next.nameNormalized = normalized.nameNormalized;
  } else if (typeof next.nameNormalized === "string") {
    next.nameNormalized = normalizeAcademicProgramKey(next.nameNormalized);
  }

  return next;
}

function normalizeProgramWriteArgs<T>(args: T): T {
  if (!isRecord(args)) return args;

  const next: AnyRecord = { ...args };
  if ("data" in next) next.data = normalizeProgramData(next.data);
  if ("create" in next) next.create = normalizeProgramData(next.create);
  if ("update" in next) next.update = normalizeProgramData(next.update);
  return next as T;
}

function normalizeProgramCreateManyArgs<T>(args: T): T {
  if (!isRecord(args)) return args;

  const next: AnyRecord = { ...args };
  if (Array.isArray(next.data)) {
    next.data = next.data.map((item) => normalizeProgramData(item));
  } else {
    next.data = normalizeProgramData(next.data);
  }
  return next as T;
}

const createPrismaClient = () =>
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] }).$extends({
    name: "normalize-program-writes",
    query: {
      program: {
        create({ args, query }) {
          return query(normalizeProgramWriteArgs(args));
        },
        createMany({ args, query }) {
          return query(normalizeProgramCreateManyArgs(args));
        },
        update({ args, query }) {
          return query(normalizeProgramWriteArgs(args));
        },
        updateMany({ args, query }) {
          return query(normalizeProgramWriteArgs(args));
        },
        upsert({ args, query }) {
          return query(normalizeProgramWriteArgs(args));
        },
      },
    },
  });

type ReleadPrismaClient = ReturnType<typeof createPrismaClient>;

declare global {
  var __releadPrisma: ReleadPrismaClient | undefined;
}

export const prisma = globalThis.__releadPrisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__releadPrisma = prisma;
export type { PrismaClient } from "@prisma/client";
