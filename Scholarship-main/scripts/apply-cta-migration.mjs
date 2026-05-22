import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DIRECT_URL);

const stmts = [
  `ALTER TABLE "recalc_admin"."admin_public_cta" ADD COLUMN IF NOT EXISTS "organizationId" UUID REFERENCES "recalc_admin"."organization"("id") ON DELETE SET NULL`,
  `ALTER TABLE "recalc_admin"."admin_public_cta" ADD COLUMN IF NOT EXISTS "onlyNewUsers" BOOLEAN NOT NULL DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS "admin_public_cta_organization_idx" ON "recalc_admin"."admin_public_cta"("organizationId")`,
];

for (const stmt of stmts) {
  try {
    await sql.query(stmt);
    console.log("OK:", stmt.slice(0, 60));
  } catch (e) {
    console.error("ERR:", e.message, "|", stmt.slice(0, 60));
  }
}
