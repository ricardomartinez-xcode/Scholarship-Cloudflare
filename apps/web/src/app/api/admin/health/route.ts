import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import { getProgramAssetHealthSummary } from "@/lib/asset-health";
import { getGoogleIntegrationConfigState, getGoogleOAuthSetupSummary } from "@/lib/google-integration";
import { getSql } from "@/lib/neon";
import { prisma } from "@/lib/prisma";
import { getCrmWebhookProposal } from "@/lib/product-reporting";
import { getRateLimitStoreState } from "@/lib/rate-limit";
import { getWebPushConfigState } from "@/lib/web-push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/health
 *
 * Returns a comprehensive health check for all critical subsystems:
 *   - Neon Auth service (can we reach NEON_AUTH_BASE_URL?)
 *   - Database connectivity (Prisma + Neon serverless driver)
 *   - neon_auth.user table accessibility (DB grants configured?)
 *   - recalc_admin schema (tables present?)
 *   - Environment variables (all required vars set?)
 *
 * Does NOT require admin session — useful for verifying deployment.
 * Returns HTTP 200 always; check `ok` field and per-subsystem `status`.
 */
export async function GET() {
  const results: Record<string, { ok: boolean; detail?: string }> = {};
  let assetSummary:
    | Awaited<ReturnType<typeof getProgramAssetHealthSummary>>
    | null = null;
  const crmProposal = getCrmWebhookProposal();

  // ── 1. Environment variables ──────────────────────────────────────────────
  const requiredEnvVars = [
    "NEON_AUTH_BASE_URL",
    "NEON_AUTH_COOKIE_SECRET",
    "DATABASE_URL",
    "DIRECT_URL",
  ];
  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  results.env = {
    ok: missingVars.length === 0,
    detail:
      missingVars.length === 0
        ? "All required env vars set."
        : `Missing: ${missingVars.join(", ")}`,
  };

  // ── 1b. Google OAuth integration config ──────────────────────────────────
  try {
    const googleConfig = getGoogleIntegrationConfigState();
    const googleSummary = getGoogleOAuthSetupSummary();
    results.googleIntegration = {
      ok: googleConfig.ready,
      detail: googleConfig.ready
        ? `Google OAuth listo (${googleSummary.mode === "shared" ? "cliente compartido" : "cliente dedicado"}). Redirects esperados: ${googleSummary.expectedAuthorizedRedirectUris.join(" | ")}`
        : `Google OAuth incompleto. Faltan: ${googleConfig.missing.join(", ")}`,
    };
  } catch (err) {
    results.googleIntegration = {
      ok: false,
      detail: `Google integration error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // ── 1c. Web Push config ──────────────────────────────────────────────────
  try {
    const webPushConfig = getWebPushConfigState();
    results.webPush = {
      ok: webPushConfig.configured,
      detail: webPushConfig.configured
        ? `Web Push listo. Subject: ${webPushConfig.subject}`
        : `Web Push incompleto. Faltan: ${webPushConfig.missing.join(", ")}`,
    };
  } catch (err) {
    results.webPush = {
      ok: false,
      detail: `Web Push error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // ── 1d. Shared rate limiting store ───────────────────────────────────────
  const rateLimitStore = getRateLimitStoreState();
  results.rateLimitStore = {
    ok: rateLimitStore.sharedStoreConfigured,
    detail: rateLimitStore.sharedStoreConfigured
      ? "Rate limit productivo usando Upstash Redis."
      : `Rate limit usa fallback local. Faltan: ${rateLimitStore.missing.join(", ")}`,
  };

  // ── 2. Neon Auth service reachability ─────────────────────────────────────
  try {
    const { data: session, error } = await auth.getSession();
    // getSession with no cookie returns { data: null } — that's fine.
    // We just need to confirm the auth library doesn't throw.
    if (error && String(error).includes("fetch")) {
      results.neonAuth = {
        ok: false,
        detail: `Cannot reach NEON_AUTH_BASE_URL: ${error}`,
      };
    } else {
      results.neonAuth = {
        ok: true,
        detail: session?.user ? "Auth service reachable (session active)." : "Auth service reachable (no active session).",
      };
    }
  } catch (err) {
    results.neonAuth = {
      ok: false,
      detail: `Auth service error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // ── 3. Prisma (recalc_admin schema) ───────────────────────────────────────
  try {
    const count = await prisma.user.count();
    results.prisma = {
      ok: true,
      detail: `recalc_admin.user accessible. Row count: ${count}.`,
    };
  } catch (err) {
    results.prisma = {
      ok: false,
      detail: `Prisma error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // ── 4. Neon serverless driver + neon_auth.user table ─────────────────────
  try {
    const sql = getSql();
    // Test recalc_admin schema via direct driver
    await sql`SELECT 1 FROM recalc_admin."user" LIMIT 1`;
    results.neonDriver = {
      ok: true,
      detail: "Neon serverless driver connected. recalc_admin.user accessible.",
    };
  } catch (err) {
    results.neonDriver = {
      ok: false,
      detail: `Neon driver error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // ── 5. neon_auth.user table grants ───────────────────────────────────────
  try {
    const sql = getSql();
    await sql`SELECT id, email FROM neon_auth."user" LIMIT 1`;
    results.neonAuthTable = {
      ok: true,
      detail: "neon_auth.user accessible. Grants OK.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isPermission = /permission denied|does not exist|schema/i.test(msg);
    results.neonAuthTable = {
      ok: false,
      detail: isPermission
        ? `neon_auth.user not accessible (missing GRANT). Run: GRANT USAGE ON SCHEMA neon_auth TO neondb_owner; GRANT SELECT ON neon_auth."user" TO neondb_owner;`
        : `neon_auth.user error: ${msg}`,
    };
  }

  // ── 6. Reporting / asset health ────────────────────────────────────────────
  try {
    assetSummary = await getProgramAssetHealthSummary();
    const brokenCount =
      assetSummary.counts.broken +
      assetSummary.counts.timeout +
      assetSummary.counts.unauthorized;
    results.assetHealth = {
      ok: brokenCount === 0,
      detail: assetSummary.lastCheckedAt
        ? `Último check ${assetSummary.lastCheckedAt}. Alertas activas: ${brokenCount}.`
        : "Aún no se ha ejecutado ningún asset health check.",
    };
  } catch (err) {
    results.assetHealth = {
      ok: false,
      detail: `Asset health error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const proposalReady =
    !crmProposal.enabled ||
    (Boolean(process.env.PROPOSAL_WEBHOOK_URL) &&
      Boolean(process.env.PROPOSAL_WEBHOOK_SECRET));
  results.crmWebhook = {
    ok: proposalReady,
    detail: crmProposal.enabled
      ? "Webhook habilitado; verifica PROPOSAL_WEBHOOK_URL y PROPOSAL_WEBHOOK_SECRET."
      : "Webhook proposal-only; habilítalo con PROPOSAL_WEBHOOK_ENABLED=true.",
  };

  const allOk = Object.values(results).every((r) => r.ok);

  return NextResponse.json(
    {
      ok: allOk,
      timestamp: new Date().toISOString(),
      results,
      assetSummary,
      crmProposal: {
        enabled: crmProposal.enabled,
        featureFlag: crmProposal.featureFlag,
        endpointEnv: crmProposal.endpointEnv,
        secretEnv: crmProposal.secretEnv,
      },
    },
    { status: 200 }
  );
}
