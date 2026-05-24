import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(projectRoot, ".env.local") });

const databaseUrl =
  process.env.DIRECT_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL_UNPOOLED ??
  (process.env.DATABASE_URL?.startsWith("prisma+postgres://")
    ? null
    : process.env.DATABASE_URL) ??
  null;

if (!databaseUrl) {
  console.error(
    "Se requiere DIRECT_URL, POSTGRES_URL_NON_POOLING, o DATABASE_URL (postgres://).",
  );
  process.exit(1);
}

const sql = neon(databaseUrl);

const main = async () => {
  console.log("Preparing canonical Neon schema...");
  await sql`CREATE SCHEMA IF NOT EXISTS recalc_admin`;
  console.log("Canonical schema ready. Run `npm run db:migrate:deploy` or the Vercel build to sync Prisma tables.");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
