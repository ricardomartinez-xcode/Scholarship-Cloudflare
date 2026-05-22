import {
  BusinessEventType,
  WhatsappTemplateStatus,
} from "@prisma/client";

import { getExtensionPanelConfig } from "@/lib/extension-panel-config";
import { prisma } from "@/lib/prisma";

const EXTENSION_EVENT_TYPES = [
  BusinessEventType.EXTENSION_TOKEN_ISSUED,
  BusinessEventType.EXTENSION_RUN_CREATED,
  BusinessEventType.EXTENSION_RUN_EVENT,
  BusinessEventType.WHATSAPP_WEB_OPENED,
] as const;

type ExtensionMetricCard = {
  label: string;
  value: number;
  hint: string;
};

type ExtensionRecentEvent = {
  id: string;
  type: BusinessEventType;
  createdAt: string;
  userEmail: string | null;
  subjectId: string | null;
  summary: string;
};

export type ExtensionAdminDashboard = {
  metrics: ExtensionMetricCard[];
  recentEvents: ExtensionRecentEvent[];
  templateSummary: {
    officialCount: number;
    pendingReviewCount: number;
    defaultOfficialName: string | null;
  };
  config: Awaited<ReturnType<typeof getExtensionPanelConfig>>;
};

function subtractDays(days: number) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value;
}

function summarizeMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "Sin detalle adicional.";
  const source = metadata as Record<string, unknown>;
  const eventType = String(source.eventType ?? "").trim();
  const message = String(source.message ?? "").trim();
  const campaignName = String(source.campaignName ?? "").trim();

  if (message) return message;
  if (eventType) return `Evento: ${eventType}`;
  if (campaignName) return `Run: ${campaignName}`;
  return "Sin detalle adicional.";
}

export async function getExtensionAdminDashboard(): Promise<ExtensionAdminDashboard> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = subtractDays(7);

  const [
    config,
    tokens24h,
    runs7d,
    events7d,
    whatsappOpened7d,
    campaignQueued,
    campaignCompleted,
    recentEvents,
    officialCount,
    pendingReviewCount,
    defaultOfficial,
  ] = await Promise.all([
    getExtensionPanelConfig(),
    prisma.businessEvent.count({
      where: {
        type: BusinessEventType.EXTENSION_TOKEN_ISSUED,
        createdAt: { gte: since24h },
      },
    }),
    prisma.businessEvent.count({
      where: {
        type: BusinessEventType.EXTENSION_RUN_CREATED,
        createdAt: { gte: since7d },
      },
    }),
    prisma.businessEvent.count({
      where: {
        type: BusinessEventType.EXTENSION_RUN_EVENT,
        createdAt: { gte: since7d },
      },
    }),
    prisma.businessEvent.count({
      where: {
        type: BusinessEventType.WHATSAPP_WEB_OPENED,
        createdAt: { gte: since7d },
      },
    }),
    prisma.extensionCampaign.count({
      where: {
        status: { in: ["queued", "scheduled", "running", "processing", "waiting_runner"] },
      },
    }),
    prisma.extensionCampaign.count({
      where: {
        status: "completed",
        updatedAt: { gte: since7d },
      },
    }),
    prisma.businessEvent.findMany({
      where: {
        type: { in: [...EXTENSION_EVENT_TYPES] },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        type: true,
        userId: true,
        subjectId: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.whatsappTemplate.count({
      where: { status: WhatsappTemplateStatus.official },
    }),
    prisma.whatsappTemplate.count({
      where: { status: WhatsappTemplateStatus.submitted_for_review },
    }),
    prisma.whatsappTemplate.findFirst({
      where: {
        status: WhatsappTemplateStatus.official,
        isDefaultOfficial: true,
      },
      select: { name: true },
    }),
  ]);

  const userIds = Array.from(
    new Set(
      recentEvents
        .map((event) => event.userId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true },
      })
    : [];

  const userById = new Map(users.map((user) => [user.id, user.email]));

  return {
    metrics: [
      {
        label: "Tokens emitidos",
        value: tokens24h,
        hint: "Últimas 24 horas",
      },
      {
        label: "Runs creados",
        value: runs7d,
        hint: "Últimos 7 días",
      },
      {
        label: "Eventos de run",
        value: events7d,
        hint: "Últimos 7 días",
      },
      {
        label: "WhatsApp abierto",
        value: whatsappOpened7d,
        hint: "Últimos 7 días",
      },
      {
        label: "Campañas activas",
        value: campaignQueued,
        hint: "En cola, programadas o corriendo",
      },
      {
        label: "Campañas cerradas",
        value: campaignCompleted,
        hint: "Completadas en los últimos 7 días",
      },
    ],
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt.toISOString(),
      userEmail: event.userId ? userById.get(event.userId) ?? null : null,
      subjectId: event.subjectId,
      summary: summarizeMetadata(event.metadata),
    })),
    templateSummary: {
      officialCount,
      pendingReviewCount,
      defaultOfficialName: defaultOfficial?.name ?? null,
    },
    config,
  };
}
