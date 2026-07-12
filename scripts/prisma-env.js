// Helper to run Prisma CLI using DATABASE_URL resolved from local or Vercel
// Supabase integration aliases.

const { spawnSync } = require("node:child_process");

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DIRECT_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    null
  );
}

const url = resolveDatabaseUrl();
if (!url) {
  console.error("Missing DATABASE_URL. Set it in .env.local (see .env.local.example).");
  process.exit(1);
}
process.env.DATABASE_URL = url;

const prismaArgs = process.argv.slice(2);
if (!prismaArgs.length) {
  console.error("Usage: node scripts/prisma-env.js <prisma args...>");
  process.exit(1);
}

const isWin = process.platform === "win32";
const cmd = isWin ? "cmd.exe" : "npx";
const args = isWin ? ["/c", "npx", "prisma", ...prismaArgs] : ["prisma", ...prismaArgs];

const res = spawnSync(cmd, args, {
  stdio: "inherit",
  env: process.env,
});

if (res.error) {
  console.error(res.error);
  process.exit(1);
}

process.exit(res.status ?? 1);
