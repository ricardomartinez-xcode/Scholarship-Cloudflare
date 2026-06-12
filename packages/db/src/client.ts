import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrl } from "./db-url";

ensureDatabaseUrl();

const createPrismaClient = () =>
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });

declare global {
  var __releadPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__releadPrisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__releadPrisma = prisma;
export type { PrismaClient } from "@prisma/client";
