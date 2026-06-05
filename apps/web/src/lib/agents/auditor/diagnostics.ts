import "server-only";

import { Prisma } from "@prisma/client";

import { buildEnvPresence } from "@/lib/admin-control-api";
import { getQuoteEngineStatus } from "@/lib/admin-system-control";
import {
  EXTENSION_SESSION_TTL_PRESETS,
  type ExtensionSessionTtlPreset,
} from "@/lib/extension-session-tokens";
import { isGoogleOAuthTemporarilyDisabled } from "@/lib/google-oauth-disabled";
import { getRateLimitStoreState } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

import { getGitHubStatus } from "./github";
import type {
  AuditorDiagnosis,
  AuditorFinding,
  AuditorSeverity,
  EnvGroupStatus,
} from "./types";

const ENV_GROUPS = {
  database: ["DATABASE_URL", "DIRECT_URL"],
  auth: ["NEON_AUTH_BASE_URL", "NEON_AUTH_COOKIE_SECRET"],
  github: ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"],
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  openai: ["OPENAI_API_KEY", "OPENAI_MODEL"],
  vercel: ["VERCEL", "VERCEL_ENV", "VERCEL_GIT_COMMIT_SHA"],
  rateLimit: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
} as const;

type DiagnosticsOptions = {
  env?: Record<string, string | undefined>;
  now?: Date;
};

function buildEnvGroups(env: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(ENV_GROUPS).map(([group, names]) => {
      const vars = buildEnvPresence([...names], env);
      return [
        group,
        {
          ok: vars.every((entry) => entry.present),
          vars,
        } satisfies EnvGroupStatus,
      ];
    }),
  );
}

function summarize(findings: AuditorFinding[]) {
  const count = (severity: AuditorSeverity) =>
    findings.filter((finding) => finding.severity === severity).length;
  return {
    total: findings.length,
    info: count("info"),
    warning: count("warning"),
    error: count("error"),
    critical: count("critical"),
    repairable: findings.filter((finding) => finding.repairable).length,
  };
}

function missingEnvFinding(group: string, status: EnvGroupStatus): AuditorFinding | null {
  const missing = status.vars.filter((entry) => !entry.present).map((entry) => entry.name);
  if (!missing.length) return null;
  const severity: AuditorSeverity = group === "database" || group === "auth" ? "error" : "warning";
  return {
    id: `env.${group}.missing`,
    module: group === "github" ? "github" : group === "google" ? "oauth" : "system",
    severity,
    title: `Variables ${group} incompletas`,
    summary: `Faltan ${missing.length} variables requeridas u operativas para ${group}.`,
    evidence: {
      missing,
      checked: status.vars.map((entry) => ({ name: entry.name, present: entry.present })),
    },
    suggestedAction: "Configurar las variables en Vercel/CI sin exponer valores en logs.",
    repairable: group === "github" || group === "google" || group === "openai",
    repairActionId: group === "github" ? "document_github_env" : "document_env_gap",
  };
}

async function diagnoseDatabase(findings: AuditorFinding[]) {
  try {
    await prisma.$queryRaw(Prisma.sql`select 1`);
    findings.push({
      id: "system.database.reachable",
      module: "system",
      severity: "info",
      title: "Base de datos disponible",
      summary: "Prisma/Postgres responde a SELECT 1.",
      evidence: { prisma: "available", query: "select 1" },
      repairable: false,
    });
  } catch (error) {
    findings.push({
      id: "system.database.unreachable",
      module: "system",
      severity: "critical",
      title: "Base de datos no disponible",
      summary: "No fue posible ejecutar un SELECT 1 con Prisma.",
      evidence: { reason: error instanceof Error ? error.message : String(error) },
      suggestedAction: "Validar DATABASE_URL/DIRECT_URL y estado de Neon antes de reparar otros modulos.",
      repairable: false,
    });
  }
}

async function diagnoseTokens(findings: AuditorFinding[]) {
  const presets = Object.keys(EXTENSION_SESSION_TTL_PRESETS) as ExtensionSessionTtlPreset[];
  findings.push({
    id: "tokens.issuer.available",
    module: "tokens",
    severity: "info",
    title: "Emisor de tokens localizado",
    summary: "El emisor interno issueExtensionSessionToken esta disponible.",
    evidence: {
      defaultPreset: "7d",
      maxPreset: "365d",
      presets,
      secretsExposed: false,
    },
    repairable: false,
  });

  if (presets.includes("never")) {
    findings.push({
      id: "tokens.never.preset.allowed",
      module: "tokens",
      severity: "warning",
      title: "Preset sin expiracion detectable",
      summary:
        "El catalogo de TTL conserva el preset never; las rutas actuales deben impedirlo salvo excepcion explicita.",
      evidence: { presetPresent: true, exposedTokenValues: false },
      suggestedAction:
        "Mantener TTL maximo operativo y documentar que never no se usa en emision publica/admin.",
      repairable: true,
      repairActionId: "document_token_ttl_policy",
    });
  }

  try {
    const rows = await prisma.$queryRaw<
      Array<{ active: number; expired: number; revoked: number }>
    >`
      select
        count(*) filter (where "revokedAt" is null and "expiresAt" > now())::int as active,
        count(*) filter (where "revokedAt" is null and "expiresAt" <= now())::int as expired,
        count(*) filter (where "revokedAt" is not null)::int as revoked
      from recalc_admin.extension_session_token
    `;
    const counts = rows[0] ?? { active: 0, expired: 0, revoked: 0 };
    findings.push({
      id: "tokens.inventory.summary",
      module: "tokens",
      severity: "info",
      title: "Inventario de tokens calculado",
      summary: "Se revisaron tokens activos, expirados y revocados sin leer secretos.",
      evidence: {
        active: Number(counts.active),
        expired: Number(counts.expired),
        revoked: Number(counts.revoked),
        tokenValuesExposed: false,
      },
      repairable: false,
    });
  } catch (error) {
    findings.push({
      id: "tokens.inventory.failed",
      module: "tokens",
      severity: "error",
      title: "No fue posible contar tokens",
      summary: "La tabla extension_session_token no pudo consultarse.",
      evidence: { reason: error instanceof Error ? error.message : String(error) },
      repairable: false,
    });
  }
}

async function diagnoseOAuth(findings: AuditorFinding[]) {
  const connectDisabled = isGoogleOAuthTemporarilyDisabled();
  const callbackDisabled = isGoogleOAuthTemporarilyDisabled();

  findings.push({
    id: "oauth.google.routes.state",
    module: "oauth",
    severity: connectDisabled || callbackDisabled ? "warning" : "info",
    title: "Estado de rutas Google OAuth",
    summary:
      connectDisabled || callbackDisabled
        ? "Las rutas Google OAuth estan deshabilitadas temporalmente."
        : "No se detecto bloqueo estatico en rutas Google OAuth.",
    evidence: {
      connectDisabled,
      callbackDisabled,
      valuesExposed: false,
    },
    suggestedAction:
      connectDisabled || callbackDisabled
        ? "Crear plan de reactivacion con access_type=offline, conservacion de refresh token y manejo invalid_grant."
        : undefined,
    repairable: Boolean(connectDisabled || callbackDisabled),
    repairActionId: connectDisabled || callbackDisabled ? "document_google_oauth_reactivation" : undefined,
  });

  try {
    const rows = await prisma.$queryRaw<
      Array<{ total: number; with_refresh_token: number; with_access_token: number }>
    >`
      select
        count(*)::int as total,
        count(*) filter (where "encryptedRefreshToken" is not null)::int as with_refresh_token,
        count(*) filter (where "encryptedAccessToken" is not null)::int as with_access_token
      from recalc_admin.user_google_connection
    `;
    const counts = rows[0] ?? { total: 0, with_refresh_token: 0, with_access_token: 0 };
    findings.push({
      id: "oauth.google.connection.model",
      module: "oauth",
      severity: "info",
      title: "Modelo UserGoogleConnection disponible",
      summary: "El modelo conserva access token y refresh token cifrados cuando existen.",
      evidence: {
        totalConnections: Number(counts.total),
        withRefreshToken: Number(counts.with_refresh_token),
        withAccessToken: Number(counts.with_access_token),
        secretValuesExposed: false,
      },
      repairable: false,
    });
  } catch (error) {
    findings.push({
      id: "oauth.google.connection.unavailable",
      module: "oauth",
      severity: "warning",
      title: "No se pudo consultar UserGoogleConnection",
      summary: "El diagnostico no confirmo conexiones Google persistidas.",
      evidence: { reason: error instanceof Error ? error.message : String(error) },
      repairable: false,
    });
  }
}

async function diagnoseUsers(findings: AuditorFinding[]) {
  try {
    const [users, invites] = await Promise.all([
      prisma.$queryRaw<Array<{ without_auth_user_id: number; inactive: number }>>`
        select
          count(*) filter (where "authUserId" is null)::int as without_auth_user_id,
          count(*) filter (where "isActive" = false)::int as inactive
        from recalc_admin.user
      `,
      prisma.$queryRaw<
        Array<{ expired_open: number; cancelled: number; used: number; open: number }>
      >`
        select
          count(*) filter (where "usedAt" is null and "cancelledAt" is null and "expiresAt" <= now())::int as expired_open,
          count(*) filter (where "cancelledAt" is not null)::int as cancelled,
          count(*) filter (where "usedAt" is not null)::int as used,
          count(*) filter (where "usedAt" is null and "cancelledAt" is null and "expiresAt" > now())::int as open
        from recalc_admin.invite
      `,
    ]);
    const userCounts = users[0] ?? { without_auth_user_id: 0, inactive: 0 };
    const inviteCounts = invites[0] ?? { expired_open: 0, cancelled: 0, used: 0, open: 0 };
    findings.push({
      id: "users.invites.summary",
      module: "users",
      severity: Number(userCounts.without_auth_user_id) > 0 ? "warning" : "info",
      title: "Usuarios e invitaciones revisados",
      summary:
        Number(userCounts.without_auth_user_id) > 0
          ? "Existen usuarios sin authUserId; no se corrigen automaticamente."
          : "No se detectaron usuarios sin authUserId en el resumen.",
      evidence: {
        usersWithoutAuthUserId: Number(userCounts.without_auth_user_id),
        inactiveUsers: Number(userCounts.inactive),
        invites: {
          open: Number(inviteCounts.open),
          expiredOpen: Number(inviteCounts.expired_open),
          cancelled: Number(inviteCounts.cancelled),
          used: Number(inviteCounts.used),
        },
      },
      suggestedAction:
        Number(userCounts.without_auth_user_id) > 0
          ? "Revisar caso por caso antes de vincular authUserId o recrear cuenta."
          : undefined,
      repairable: Number(userCounts.without_auth_user_id) > 0,
      repairActionId:
        Number(userCounts.without_auth_user_id) > 0 ? "document_user_auth_reconciliation" : undefined,
    });
  } catch (error) {
    findings.push({
      id: "users.invites.failed",
      module: "users",
      severity: "error",
      title: "No fue posible diagnosticar usuarios/invitaciones",
      summary: "La consulta de resumen de usuarios e invitaciones fallo.",
      evidence: { reason: error instanceof Error ? error.message : String(error) },
      repairable: false,
    });
  }
}

async function diagnoseOffersAndQuote(findings: AuditorFinding[]) {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ active_offerings: number; active_cycles: number; active_campuses: number }>
    >`
      select
        count(*) filter (where po."isActive" = true)::int as active_offerings,
        count(distinct po.cycle) filter (where po."isActive" = true)::int as active_cycles,
        count(distinct po."campusId") filter (where po."isActive" = true and c."isActive" = true)::int as active_campuses
      from recalc_admin.program_offering po
      left join recalc_admin.campus c on c.id = po."campusId"
    `;
    const counts = rows[0] ?? { active_offerings: 0, active_cycles: 0, active_campuses: 0 };
    findings.push({
      id: "offers.active.summary",
      module: "offers",
      severity: Number(counts.active_offerings) > 0 ? "info" : "warning",
      title: "Oferta academica activa",
      summary:
        Number(counts.active_offerings) > 0
          ? "Hay oferta activa disponible para diagnosticos."
          : "No hay oferta activa visible para cotizaciones.",
      evidence: {
        activeOfferings: Number(counts.active_offerings),
        activeCycles: Number(counts.active_cycles),
        activeCampuses: Number(counts.active_campuses),
      },
      suggestedAction:
        Number(counts.active_offerings) > 0
          ? undefined
          : "Validar importaciones y visibilidad de ciclos/ofertas antes de usar el cotizador.",
      repairable: Number(counts.active_offerings) === 0,
      repairActionId:
        Number(counts.active_offerings) === 0 ? "document_offer_visibility_gap" : undefined,
    });
  } catch (error) {
    findings.push({
      id: "offers.active.failed",
      module: "offers",
      severity: "error",
      title: "No fue posible consultar oferta",
      summary: "La consulta de ProgramOffering fallo.",
      evidence: { reason: error instanceof Error ? error.message : String(error) },
      repairable: false,
    });
  }

  try {
    const quoteEngine = await getQuoteEngineStatus();
    findings.push({
      id: "quote.engine.status",
      module: "quote",
      severity: quoteEngine.ok ? "info" : "warning",
      title: "Motor de cotizacion",
      summary: quoteEngine.ok
        ? "El motor de cotizacion resolvio un fixture de oferta activa."
        : "El motor de cotizacion no quedo listo con el fixture activo.",
      evidence: {
        status: quoteEngine.status,
        offeringId: "offeringId" in quoteEngine ? quoteEngine.offeringId : null,
        cycle: "cycle" in quoteEngine ? quoteEngine.cycle : null,
      },
      suggestedAction: quoteEngine.ok
        ? undefined
        : "Revisar oferta activa, modalidad, linea de negocio y reglas canonical.",
      repairable: !quoteEngine.ok,
      repairActionId: quoteEngine.ok ? undefined : "document_quote_engine_gap",
    });
  } catch (error) {
    findings.push({
      id: "quote.engine.failed",
      module: "quote",
      severity: "error",
      title: "Diagnostico de cotizador fallo",
      summary: "No fue posible ejecutar getQuoteEngineStatus.",
      evidence: { reason: error instanceof Error ? error.message : String(error) },
      repairable: false,
    });
  }
}

function diagnoseRateLimit(findings: AuditorFinding[]) {
  const state = getRateLimitStoreState();
  const suggestedAction = state.sharedStoreConfigured
    ? "Requiere triage operativo."
    : "Configurar UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN en Vercel.";
  findings.push({
    id: "security.rate-limit.store",
    module: "security",
    severity: state.sharedStoreConfigured ? "info" : "warning",
    title: "Rate limit operativo",
    summary: state.sharedStoreConfigured
      ? "El rate limiter detecta store compartido Upstash."
      : "El rate limiter usara fallback local si Upstash no esta configurado.",
    evidence: state,
    suggestedAction,
    repairable: !state.sharedStoreConfigured,
    repairActionId: state.sharedStoreConfigured ? undefined : "document_rate_limit_env",
  });
}

export async function runAuditorDiagnostics(
  options: DiagnosticsOptions = {},
): Promise<AuditorDiagnosis> {
  const startedAt = Date.now();
  const env = options.env ?? process.env;
  const envGroups = buildEnvGroups(env);
  const findings: AuditorFinding[] = [];

  for (const [group, status] of Object.entries(envGroups)) {
    const finding = missingEnvFinding(group, status);
    if (finding) findings.push(finding);
  }

  const github = getGitHubStatus(env);
  findings.push({
    id: github.configured ? "github.integration.ready" : "github.integration.missing",
    module: "github",
    severity: github.configured ? "info" : "warning",
    title: github.configured ? "GitHub integration configurada" : "GitHub integration incompleta",
    summary: github.configured
      ? "Las variables GitHub requeridas estan presentes."
      : "Faltan variables para crear issues, ramas, commits y PRs.",
    evidence: github,
    suggestedAction: github.configured
      ? "Sin accion requerida; hallazgo informativo."
      : "Configurar GITHUB_TOKEN, GITHUB_OWNER y GITHUB_REPO con permisos minimos.",
    repairable: !github.configured,
    repairActionId: github.configured ? undefined : "document_github_env",
  });

  diagnoseRateLimit(findings);
  await diagnoseDatabase(findings);
  await Promise.all([
    diagnoseTokens(findings),
    diagnoseOAuth(findings),
    diagnoseUsers(findings),
    diagnoseOffersAndQuote(findings),
  ]);

  return {
    generatedAt: (options.now ?? new Date()).toISOString(),
    durationMs: Date.now() - startedAt,
    summary: summarize(findings),
    findings,
    env: envGroups,
    architecture: {
      app: "Next.js App Router en apps/web con monorepo npm workspaces.",
      framework: "Next.js 16, React 19, TypeScript, Prisma y Neon/PostgreSQL.",
      auth: "Neon Auth/Better Auth resuelto por authz.ts y admin-session.ts.",
      permissions: "AdminCapability con requireAdminApiCapability para APIs admin.",
      auditLog: "AdminAuditLog via writeAdminAuditLog para acciones sensibles.",
      rateLimit: "checkRateLimit con Upstash REST opcional y fallback local.",
      github: "admin-github-control.ts usa GitHub REST API con env vars.",
      training: "TrainingRoom/TrainingChat/TrainingMessage existen para roleplay futuro.",
    },
  };
}
