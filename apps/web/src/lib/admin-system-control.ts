import fs from "node:fs/promises";
import path from "node:path";

import { AdminConfigModule, BusinessEventType, Prisma } from "@prisma/client";

import { buildEnvPresence } from "@/lib/admin-control-api";
import { normalizeBusinessLine, normalizeCanonicalModality } from "@/lib/pricing-normalize";
import { prisma } from "@/lib/prisma";
import { resolveCanonicalQuote } from "@relead/domain/calculator/quote-service";

const ENV_GROUPS = {
  database: ["DATABASE_URL", "DIRECT_URL"],
  auth: ["NEON_AUTH_BASE_URL", "NEON_AUTH_COOKIE_SECRET"],
  github: ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"],
  vercel: ["VERCEL", "VERCEL_ENV", "VERCEL_GIT_COMMIT_SHA"],
} as const;

async function readVersion() {
  try {
    return (await fs.readFile(path.join(process.cwd(), "VERSION"), "utf8")).trim() || null;
  } catch {
    return null;
  }
}

function currentBranch() {
  return (
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.GITHUB_REF_NAME ||
    process.env.GIT_BRANCH ||
    null
  );
}

export function getAdminEnvCheck() {
  return Object.fromEntries(
    Object.entries(ENV_GROUPS).map(([group, names]) => [
      group,
      {
        ok: buildEnvPresence([...names]).every((entry) => entry.present),
        vars: buildEnvPresence([...names]),
      },
    ]),
  );
}

export async function getAdminSystemHealth() {
  const startedAt = Date.now();
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    await prisma.$queryRaw(Prisma.sql`SELECT 1`);
    checks.database = { ok: true, detail: "Prisma/Postgres responde SELECT 1." };
  } catch (error) {
    checks.database = {
      ok: false,
      detail: error instanceof Error ? error.message : "Error de conexión a base de datos.",
    };
  }

  checks.service = { ok: true, detail: "Servicio Next.js activo." };
  checks.authenticatedAdmin = { ok: true, detail: "Solicitud autenticada por capa admin." };

  return {
    ok: Object.values(checks).every((check) => check.ok),
    durationMs: Date.now() - startedAt,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    checks,
  };
}

export async function getImporterStatus() {
  const lastSession = await prisma.adminImportSession.findFirst({
    where: { module: AdminConfigModule.OFFER },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      fileName: true,
      summary: true,
      warnings: true,
      errors: true,
      result: true,
      createdByEmail: true,
      appliedByEmail: true,
      createdAt: true,
      appliedAt: true,
      updatedAt: true,
    },
  });

  const summary =
    lastSession?.summary && typeof lastSession.summary === "object"
      ? (lastSession.summary as Record<string, unknown>)
      : {};

  return {
    lastImport: lastSession
      ? {
          id: lastSession.id,
          status: lastSession.status,
          fileName: lastSession.fileName,
          cycle: summary.cycle ?? null,
          rowsProcessed: summary.campusesProcessed ?? null,
          rowsValid: summary.campusesProcessed ?? null,
          rowsInvalid: Array.isArray(lastSession.errors) ? lastSession.errors.length : 0,
          user: lastSession.appliedByEmail ?? lastSession.createdByEmail,
          createdAt: lastSession.createdAt.toISOString(),
          appliedAt: lastSession.appliedAt?.toISOString() ?? null,
          updatedAt: lastSession.updatedAt.toISOString(),
          warnings: lastSession.warnings ?? [],
          errors: lastSession.errors ?? [],
          result: lastSession.result ?? null,
        }
      : null,
  };
}

export async function getAdminSystemStatus() {
  const [version, importer, latestQuote] = await Promise.all([
    readVersion(),
    getImporterStatus(),
    prisma.businessEvent.findFirst({
      where: { type: BusinessEventType.QUOTE_GENERATED },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, createdAt: true, metadata: true },
    }),
  ]);

  return {
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    commitSha:
      process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null,
    branch: currentBranch(),
    version,
    importer: importer.lastImport,
    quoteEngine: latestQuote
      ? {
          lastGeneratedAt: latestQuote.createdAt.toISOString(),
          lastEventId: latestQuote.id,
          status: "seen",
        }
      : {
          lastGeneratedAt: null,
          lastEventId: null,
          status: "no_recent_events",
        },
    integrations: {
      github: {
        configured: Boolean(
          process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO,
        ),
      },
      vercel: {
        configured: Boolean(process.env.VERCEL || process.env.VERCEL_ENV),
      },
    },
  };
}

function getOfferingModality(offering: {
  delivery: string;
  escolarizado: boolean;
  ejecutivo: boolean;
}) {
  if (offering.delivery === "ONLINE") return "online";
  if (offering.ejecutivo) return "mixta";
  if (offering.escolarizado) return "presencial";
  return "presencial";
}

export async function getQuoteEngineStatus() {
  const offering = await prisma.programOffering.findFirst({
    where: { isActive: true, campus: { isActive: true } },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      cycle: true,
      delivery: true,
      escolarizado: true,
      ejecutivo: true,
      pricingPlans: true,
      track: true,
      lineOfBusiness: true,
      campus: { select: { metaKey: true, code: true, name: true } },
      program: {
        select: {
          id: true,
          name: true,
          businessLine: true,
          level: true,
          category: true,
        },
      },
    },
  });

  if (!offering) {
    return {
      ok: false,
      status: "no_active_offering",
      error: "No hay oferta académica activa para probar el motor.",
    };
  }

  const businessLine =
    normalizeBusinessLine(offering.lineOfBusiness) ??
    normalizeBusinessLine(offering.program.businessLine) ??
    normalizeBusinessLine(offering.program.level) ??
    normalizeBusinessLine(offering.program.category);
  const modality = normalizeCanonicalModality(getOfferingModality(offering));
  const plan = offering.pricingPlans[0] ?? 9;

  if (!businessLine || !modality) {
    return {
      ok: false,
      status: "fixture_unresolvable",
      error: "No fue posible derivar línea o modalidad desde la oferta activa.",
      offeringId: offering.id,
    };
  }

  const result = await resolveCanonicalQuote({
    enrollmentType: "nuevo_ingreso",
    businessLine,
    modality,
    plan,
    campus: modality === "online" ? "ONLINE" : offering.campus.metaKey || offering.campus.code,
    average: 9,
    module: offering.track,
    selectedProgramId: offering.program.id,
    selectedProgramName: offering.program.name,
    offeringId: offering.id,
    offerCycle: offering.cycle,
  });

  return {
    ok: result.ok,
    status: result.ok ? "ready" : "quote_failed",
    offeringId: offering.id,
    cycle: offering.cycle,
    result,
  };
}
