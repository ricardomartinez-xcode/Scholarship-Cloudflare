import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DIRECT_URL);

const stmts = [
  `CREATE TYPE "recalc_admin"."UserCapability" AS ENUM ('access_admin_cta','user_vip','view_audit','manage_templates','manage_communications','owner_permissions')`,
  `CREATE TABLE IF NOT EXISTS "recalc_admin"."user_capability_assignment" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"userId" UUID NOT NULL REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE,"capability" "recalc_admin"."UserCapability" NOT NULL,"grantedBy" TEXT,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY ("id"),CONSTRAINT "user_capability_assignment_user_capability_key" UNIQUE ("userId","capability"))`,
  `CREATE INDEX IF NOT EXISTS "user_capability_assignment_capability_idx" ON "recalc_admin"."user_capability_assignment"("capability")`,
  `ALTER TABLE "recalc_admin"."admin_public_cta" ADD COLUMN IF NOT EXISTS "requiredCapability" "recalc_admin"."UserCapability"`,
];

for (const stmt of stmts) {
  try {
    await sql.query(stmt);
    console.log("OK:", stmt.slice(0, 70));
  } catch (e) {
    if (e.message?.includes("already exists")) {
      console.log("SKIP (already exists):", stmt.slice(0, 50));
    } else {
      console.error("ERR:", e.message, "|", stmt.slice(0, 60));
    }
  }
}
