import "server-only";

import {
  AdminAuditAction,
  AdminChangeSource,
  AdminConfigModule,
  Prisma,
} from "@prisma/client";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getQuoteEngineStatus } from "@/lib/admin-system-control";
import { generateAiText, type AiChatMessage } from "@/lib/ai/client";
import { prisma } from "@/lib/prisma";
import { getRateLimitStoreState } from "@/lib/rate-limit";

export type OperationsAssistantPriority = "alta" | "media" | "baja";

export type OperationsProcessImprovement = {
  id: string;
  priority: OperationsAssistantPriority;
  title: string;
  summary: string;
  nextAction: string;
};

type OperationsActor = {
  id?: string | null;
  email?: string | null;
};

export type OperationsActionId =
  | "create_audit_note"
  | "review_offer_imports"
  | "document_env_setup";

export type OperationsActionPayload = {
  note?: string;
  title?: string;
  target?: string;
  [key: string]: unknown;
};

export type OperationsAssistantContext = {
  generatedAt: string;
  rateLimit: ReturnType<typeof getRateLimitStoreState>;
  quoteEngine: Awaited<ReturnType<typeof getQuoteEngineStatus>>;
  imports: {
    last: {
      id: string;
      module: string;
      status: string;
      fileName: string | null;
      errorCount: number;
      warningCount: number;
      createdAt: string;
      updatedAt: string;
    } | null;
  };
  audit: {
    recent: Array<{
      id: string;
      module: string;
      action: string;
      actorEmail: string | null;
      message: string | null;
      createdAt: string;
    }>;
  };
  offers: {
    activeOfferings: number;
  };
};

function jsonArrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toJsonObject(value: OperationsActionPayload | undefined): Prisma.InputJsonObject {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      entry === undefined ? null : entry,
    ]),
  ) as Prisma.InputJsonObject;
}

export async function collectOperationsAssistantContext(): Promise<OperationsAssistantContext> {
  const [quoteEngine, lastImport, recentAudit, activeOfferings] = await Promise.all([
    getQuoteEngineStatus(),
    prisma.adminImportSession.findFirst({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        module: true,
        status: true,
        fileName: true,
        errors: true,
        warnings: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.adminAuditLog.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        module: true,
        action: true,
        actorEmail: true,
        message: true,
        createdAt: true,
      },
    }),
    prisma.programOffering.count({
      where: { isActive: true, campus: { isActive: true } },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    rateLimit: getRateLimitStoreState(),
    quoteEngine,
    imports: {
      last: lastImport
        ? {
            id: lastImport.id,
            module: String(lastImport.module),
            status: String(lastImport.status),
            fileName: lastImport.fileName,
            errorCount: jsonArrayLength(lastImport.errors),
            warningCount: jsonArrayLength(lastImport.warnings),
            createdAt: toIso(lastImport.createdAt),
            updatedAt: toIso(lastImport.updatedAt),
          }
        : null,
    },
    audit: {
      recent: recentAudit.map((entry) => ({
        id: entry.id,
        module: String(entry.module),
        action: String(entry.action),
        actorEmail: entry.actorEmail,
        message: entry.message,
        createdAt: toIso(entry.createdAt),
      })),
    },
    offers: {
      activeOfferings,
    },
  };
}

export function recommendOperationsProcessImprovements(
  context: OperationsAssistantContext,
) {
  const recommendations: OperationsProcessImprovement[] = [];

  if (!context.rateLimit.sharedStoreConfigured) {
    recommendations.push({
      id: "configure_shared_rate_limit",
      priority: "alta",
      title: "Configurar rate limit compartido",
      summary:
        "El rate limiter esta usando memoria local; en serverless no comparte estado entre instancias.",
      nextAction:
        "Configurar UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN en Vercel.",
    });
  }

  if (
    context.imports.last?.status === "failed" ||
    (context.imports.last?.errorCount ?? 0) > 0
  ) {
    recommendations.push({
      id: "stabilize_offer_imports",
      priority: "alta",
      title: "Estabilizar importaciones de oferta",
      summary:
        "La ultima importacion tiene errores o quedo fallida; conviene cerrar este bloqueo antes de publicar cambios.",
      nextAction:
        "Revisar la sesion de importacion mas reciente y crear issue si requiere correccion de plantilla.",
    });
  }

  if (!context.quoteEngine.ok || context.offers.activeOfferings === 0) {
    recommendations.push({
      id: "restore_quote_engine_readiness",
      priority: "alta",
      title: "Restaurar readiness del cotizador",
      summary:
        "El motor de cotizacion no esta listo o no hay oferta activa suficiente para simular.",
      nextAction:
        "Validar oferta activa, campus activo y fixture del cotizador antes de cambios de pricing.",
    });
  }

  if (context.audit.recent.length === 0) {
    recommendations.push({
      id: "establish_daily_audit_rhythm",
      priority: "media",
      title: "Establecer bitacora operativa",
      summary:
        "No hay eventos recientes de auditoria en el contexto consultado.",
      nextAction:
        "Registrar una nota operativa diaria al cerrar diagnosticos o importaciones.",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "daily_ops_review",
      priority: "baja",
      title: "Mantener revisión diaria",
      summary:
        "No se detectan bloqueos operativos inmediatos en el contexto resumido.",
      nextAction:
        "Revisar auditor, importaciones y último deploy antes del cierre del día.",
    });
  }

  return recommendations;
}

function buildContextSummary(context: OperationsAssistantContext) {
  return {
    rateLimitStore: context.rateLimit.store,
    rateLimitShared: context.rateLimit.sharedStoreConfigured,
    quoteEngineStatus: context.quoteEngine.status,
    activeOfferings: context.offers.activeOfferings,
    lastImportStatus: context.imports.last?.status ?? "none",
    lastImportErrors: context.imports.last?.errorCount ?? 0,
    recentAuditEvents: context.audit.recent.length,
  };
}

export function buildOperationsAssistantPrompt(input: {
  context: OperationsAssistantContext;
  recommendations: OperationsProcessImprovement[];
}) {
  const summary = buildContextSummary(input.context);
  const recs = input.recommendations
    .map((item) => `- ${item.priority}: ${item.title}. ${item.nextAction}`)
    .join("\n");

  return [
    "Eres un asistente operativo interno para administradores de Recalc.",
    "Responde en español, con pasos concretos y sin inventar datos.",
    "No incluyas secretos, tokens, variables con valores ni instrucciones destructivas.",
    `Contexto: ${JSON.stringify(summary)}.`,
    `Recomendaciones detectadas:\n${recs}`,
  ].join("\n");
}

function fallbackOperationsReply(recommendations: OperationsProcessImprovement[]) {
  const top = recommendations[0];
  return top
    ? `Prioridad ${top.priority}: ${top.title}. Siguiente accion: ${top.nextAction}`
    : "No hay bloqueos inmediatos. Revisa auditor, importaciones y deploy antes del cierre operativo.";
}

export async function runOperationsAssistantChat(input: {
  actor: OperationsActor;
  messages: AiChatMessage[];
}) {
  const context = await collectOperationsAssistantContext();
  const recommendations = recommendOperationsProcessImprovements(context);
  const generation = await generateAiText({
    system: buildOperationsAssistantPrompt({ context, recommendations }),
    messages: input.messages,
    maxMessages: 8,
    maxContentLength: 1_200,
  });

  return {
    reply: generation.ok ? generation.text : fallbackOperationsReply(recommendations),
    recommendations,
    context: buildContextSummary(context),
    ai: generation.ok
      ? { ok: true as const, model: generation.model }
      : { ok: false as const, code: generation.code, error: generation.error },
    actor: {
      id: input.actor.id ?? null,
      email: input.actor.email ?? null,
    },
  };
}

export function previewOperationsAction(input: {
  actionId: OperationsActionId;
  payload?: OperationsActionPayload;
}) {
  const payload = input.payload ?? {};
  const title =
    input.actionId === "create_audit_note"
      ? "Crear nota de auditoria"
      : input.actionId === "review_offer_imports"
        ? "Revisar importaciones de oferta"
        : "Documentar configuracion pendiente";

  return {
    actionId: input.actionId,
    title,
    summary:
      input.actionId === "create_audit_note"
        ? String(payload.note ?? "Registrar nota operativa.")
        : "Accion no destructiva pendiente de confirmacion.",
    risk: "baja" as const,
    requiresConfirmation: true,
    confirmationText: "CONFIRMAR",
    payload,
  };
}

export async function confirmOperationsAction(input: {
  actor: OperationsActor;
  actionId: OperationsActionId;
  confirmationText: string;
  payload?: OperationsActionPayload;
  requestId?: string | null;
}) {
  if (input.confirmationText !== "CONFIRMAR") {
    throw new Error("Escribe CONFIRMAR para ejecutar esta accion.");
  }

  const preview = previewOperationsAction({
    actionId: input.actionId,
    payload: input.payload,
  });

  if (input.actionId === "create_audit_note") {
    const message = String(
      input.payload?.note || input.payload?.title || "Nota operativa creada.",
    ).trim();
    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.CREATE,
      source: AdminChangeSource.SYSTEM,
      actor: input.actor,
      entityType: "OperationsAssistantAction",
      entityId: input.actionId,
      requestId: input.requestId ?? null,
      after: {
        actionId: input.actionId,
        payload: toJsonObject(input.payload),
      },
      message,
    });
  }

  return {
    confirmed: true,
    actionId: input.actionId,
    preview,
  };
}
