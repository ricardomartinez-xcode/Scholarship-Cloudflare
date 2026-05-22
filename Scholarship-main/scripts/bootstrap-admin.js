// Bootstrap (or promote) the protected owner user in recalc_admin.user.
//
// This script ensures the specified email exists in the recalc_admin.user table
// with role=owner and isActive=true. It does NOT create a Neon Auth account —
// the user must first sign up through the app; this script only sets their role.
//
// Keep ADMIN_EMAIL=<email> only as a bootstrap/protection reference. The app no
// longer auto-promotes this email during login.
//
// Usage:
//   BOOTSTRAP_ADMIN_EMAIL="admin@example.com" npm run admin:bootstrap

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const resolveDatabaseUrl = () =>
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  null;

async function main() {
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();

  if (!email) {
    throw new Error(
      "Missing BOOTSTRAP_ADMIN_EMAIL env var.\n" +
        "Usage: BOOTSTRAP_ADMIN_EMAIL=\"admin@example.com\" npm run admin:bootstrap"
    );
  }

  const url = resolveDatabaseUrl();
  if (!url) throw new Error("Missing DATABASE_URL. Set it in .env.local or env vars.");
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = url;
  // DIRECT_URL required by schema.prisma directUrl
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL_UNPOOLED ||
      url;
  }

  const prisma = new PrismaClient();
  try {
    // Upsert the user in recalc_admin.user with ADMIN role.
    // If the user already exists (from a previous sign-in), promote them to ADMIN.
    // If not, create a placeholder — they will be linked to their Neon Auth account
    // automatically on their next sign-in (syncUserRecord in authz.ts).
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: "owner", isActive: true },
      create: {
        email,
        role: "owner",
        isActive: true,
      },
    });
    console.log(`✓ Owner user ready: ${user.email} (id=${user.id})`);
    console.log(`  Keep ADMIN_EMAIL=${email} only as bootstrap/protection metadata if you still use it.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("bootstrap-admin failed:", err.message ?? err);
  process.exitCode = 1;
});
