import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrl } from "./db-url";

ensureDatabaseUrl();

const PRICE_IMPORT_TRANSACTION_TIMEOUT_MS = 30_000;

const createPrismaClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    transactionOptions: {
      timeout: PRICE_IMPORT_TRANSACTION_TIMEOUT_MS,
    },
  });

declare global {
  var __releadPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__releadPrisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__releadPrisma = prisma;
export type { PrismaClient } from "@prisma/client";
