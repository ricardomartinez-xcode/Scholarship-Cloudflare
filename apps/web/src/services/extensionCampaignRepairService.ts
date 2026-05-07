import { BusinessEventType, Prisma } from "@prisma/client";

import {
  getExtensionRunnerHealth,
  resolveExtensionCampaignCompletionStatus,
  type ExtensionRunnerHealth,
} from "@/lib/extension-automation";
import { writeBusinessEventSafe } from "@/lib/business-events";
import { logStructured } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

const DEFAULT_CLAIM_STALE_AFTER_MS = 20 * 60_000;
const RUNNER_CHANNELS = new Set(["extension_runner", "whatsapp_web"]);
const TERMINAL_STATUSES = new Set(["completed", "sent", "failed", "partial", "blocked"]);

export const EXTENSION_CAMPAIGN_REPAIR_ACTION_IDS = [
  "campaigns.release_stale_claimed",
  "campaigns.reconcile_status",
] as const;

export type ExtensionCampaignRepairActionId =
  (typeof EXTENSION_CAMPAIGN_REPAIR_ACTION_IDS)[number];

export type ExtensionCampaignRepairActionSeverity = "safe_auto_fix" | "review_required";
export type ExtensionCampaignRepairFindingSeverity = "critical" | "high" | "medium" | "info";
export type ExtensionCampaignRepairMode = "preview" | "apply";

export type ExtensionCampaignRepairFindingCode =
  | "stale_claimed_recipients"
  | "waiting_runner_stuck"
  | "processing_state_drift"
  | "terminal_state_drift"
  | "completed_with_issues";

export type ExtensionCampaignRepairFinding = {
  code: ExtensionCampaignRepairFindingCode;
  severity: ExtensionCampaignRepairFindingSeverity;
  campaignId: string;
  campaignName: string;
  message: string;
  recoverable: boolean;
  suggestedActions: ExtensionCampaignRepairActionId[];
  details?: Record<string, unknown>;
};

export type ExtensionCampaignRepairActionPreview = {
  key: string;
  actionId: ExtensionCampaignRepairActionId;
  name: string;
  description: string;
  severity: ExtensionCampaignRepairActionSeverity;
  campaignId: string;
  campaignName: string;
  preview: Record<string, unknown>;
};

export type ExtensionCampaignRepairReport = {
  requestId: string;
  generatedAt: string;
  runner: ExtensionRunnerHealth;
  findings: ExtensionCampaignRepairFinding[];
  actions: ExtensionCampaignRepairActionPreview[];
  summary: {
    campaignsAnalyzed: number;
    findings: number;
    safeActions: number;
    reviewActions: number;
    appliedActions: number;
    releasedClaimedRecipients: number;
    reconciledCampaigns: number;
  };
};

export type ExtensionCampaignRepairApplyResult = ExtensionCampaignRepairReport & {
  mode: "apply";
  applied: {
    appliedActions: number;
    releasedClaimedRecipients: number;
    reconciledCampaigns: number;
    updatedCampaignIds: string[];
  };
};

export type ExtensionCampaignRepairPreviewResult = ExtensionCampaignRepairReport & {
  mode: "preview";
};

type RepairCandidateCampaign = Prisma.ExtensionCampaignGetPayload<{
  include: {
    recipients: {
      select: {
        id: true;
        status: true;
        scheduledFor: true;
        attemptedAt: true;
        sentAt: true;
        lastError: true;
        contactName: true;
        contactValue: true;
      };
      orderBy: [{ createdAt: "asc" }];
    };
  };
}>;

type CandidateSnapshot = {
  queued: number;
  scheduled: number;
  claimed: number;
  sent: number;
  failed: number;
  total: number;
  pending: number;
  ready: number;
  staleClaimedRecipients: Array<{ id: string; scheduledFor: Date | null }>;
  completionStatus: "sent" | "failed" | "partial";
};

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function isRunnerChannel(channel: string | null | undefined) {
  return RUNNER_CHANNELS.has(normalizeStatus(channel));
}

function isTerminalStatus(status: string | null | undefined) {
  return TERMINAL_STATUSES.has(normalizeStatus(status));
}

export function resolveExpectedCampaignStatusForRepair(params: {
  currentStatus: string;
  channel: string | null | undefined;
  scheduleAt: Date | null;
  pendingRecipients: number;
  readyRecipients: number;
  claimedRecipients: number;
  totalRecipients: number;
  sentRecipients: number;
  failedRecipients: number;
  runnerAvailable: boolean;
  now: Date;
}) {
  const normalizedCurrentStatus = normalizeStatus(params.currentStatus) || "queued";
  if (params.pendingRecipients === 0) {
    return resolveExtensionCampaignCompletionStatus({
      totalRecipients: params.totalRecipients,
      sentRecipients: params.sentRecipients,
      failedRecipients: params.failedRecipients,
    });
  }
  if (
    normalizedCurrentStatus === "paused" ||
    normalizedCurrentStatus === "draft" ||
    normalizedCurrentStatus === "blocked"
  ) {
    return normalizedCurrentStatus;
  }

  if (
    params.scheduleAt &&
    params.scheduleAt.getTime() > params.now.getTime() &&
    params.readyRecipients === 0
  ) {
    return "scheduled";
  }

  if (!isRunnerChannel(params.channel)) {
    return normalizedCurrentStatus;
  }

  if (params.claimedRecipients > 0) return "processing";
  return params.runnerAvailable ? "queued" : "waiting_runner";
}

function resolvedExpectedCampaignStatus(params: {
  campaign: RepairCandidateCampaign;
  snapshot: CandidateSnapshot;
  runner: ExtensionRunnerHealth;
  now: Date;
}) {
  return resolveExpectedCampaignStatusForRepair({
    currentStatus: params.campaign.status,
    channel: params.campaign.channel,
    scheduleAt: params.campaign.scheduleAt,
    pendingRecipients: params.snapshot.pending,
    readyRecipients: params.snapshot.ready,
    claimedRecipients: params.snapshot.claimed,
    totalRecipients: params.snapshot.total,
    sentRecipients: params.snapshot.sent,
    failedRecipients: params.snapshot.failed,
    runnerAvailable: params.runner.available,
    now: params.now,
  });
}

function buildCandidateSnapshot(
  campaign: RepairCandidateCampaign,
  now: Date,
  staleBefore: Date,
): CandidateSnapshot {
  const counts = {
    queued: 0,
    scheduled: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
    total: campaign.recipients.length,
  };
  const staleClaimedRecipients: Array<{ id: string; scheduledFor: Date | null }> = [];
  let ready = 0;

  for (const recipient of campaign.recipients) {
    const status = normalizeStatus(recipient.status);
    if (status === "queued") {
      counts.queued += 1;
      ready += 1;
    } else if (status === "scheduled") {
      counts.scheduled += 1;
      if (!recipient.scheduledFor || recipient.scheduledFor <= now) ready += 1;
    } else if (status === "claimed") {
      counts.claimed += 1;
      if (!recipient.attemptedAt || recipient.attemptedAt <= staleBefore) {
        staleClaimedRecipients.push({
          id: recipient.id,
          scheduledFor: recipient.scheduledFor,
        });
      }
    } else if (status === "sent") {
      counts.sent += 1;
    } else if (status === "failed") {
      counts.failed += 1;
    }
  }

  const pending = counts.queued + counts.scheduled + counts.claimed;
  const completionStatus = resolveExtensionCampaignCompletionStatus({
    totalRecipients: counts.total,
    sentRecipients: counts.sent,
    failedRecipients: counts.failed,
  });

  return {
    ...counts,
    pending,
    ready,
    staleClaimedRecipients,
    completionStatus,
  };
}

async function fetchRepairCandidates(params: {
  userId: string;
  campaignId?: string | null;
}): Promise<RepairCandidateCampaign[]> {
  const campaignId = String(params.campaignId ?? "").trim();
  const campaigns = await prisma.extensionCampaign.findMany({
    where: campaignId
      ? {
          ownerUserId: params.userId,
          id: campaignId,
        }
      : {
          ownerUserId: params.userId,
          status: {
            in: [
              "queued",
              "scheduled",
              "running",
              "processing",
              "waiting_runner",
              "sent",
              "failed",
              "partial",
              "completed",
            ],
          },
        },
    orderBy: [{ updatedAt: "desc" }],
    take: campaignId ? undefined : 120,
    include: {
      recipients: {
        select: {
          id: true,
          status: true,
          scheduledFor: true,
          attemptedAt: true,
          sentAt: true,
          lastError: true,
          contactName: true,
          contactValue: true,
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (campaignId && campaigns.length === 0) {
    throw new Error("La campaña solicitada no existe o no pertenece a tu sesión.");
  }

  return campaigns;
}

function buildPreviewFromCandidates(params: {
  requestId: string;
  now: Date;
  staleClaimAfterMs: number;
  runner: ExtensionRunnerHealth;
  candidates: RepairCandidateCampaign[];
}): ExtensionCampaignRepairPreviewResult {
  const findings: ExtensionCampaignRepairFinding[] = [];
  const actions: ExtensionCampaignRepairActionPreview[] = [];

  for (const campaign of params.candidates) {
    const campaignStaleAfterMs = Math.max(
      params.staleClaimAfterMs,
      Math.max(250, campaign.messageDelayMs ?? 4_000) * Math.max(1, campaign.batchSize) * 2,
    );
    const staleBefore = new Date(params.now.getTime() - campaignStaleAfterMs);
    const currentStatus = normalizeStatus(campaign.status) || "queued";
    const snapshot = buildCandidateSnapshot(campaign, params.now, staleBefore);
    const expectedStatus = resolvedExpectedCampaignStatus({
      campaign,
      snapshot,
      runner: params.runner,
      now: params.now,
    });
    const expectsTerminal = isTerminalStatus(expectedStatus);
    const needsCompletionAtFix =
      (expectsTerminal && !campaign.completedAt) || (!expectsTerminal && Boolean(campaign.completedAt));
    const needsStatusReconcile = expectedStatus !== currentStatus || needsCompletionAtFix;

    if (snapshot.staleClaimedRecipients.length > 0) {
      findings.push({
        code: "stale_claimed_recipients",
        severity: "high",
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        message:
          "Hay destinatarios en claimed sin progreso reciente. Esto puede atascar el runner en processing/waiting_runner.",
        recoverable: true,
        suggestedActions: ["campaigns.release_stale_claimed"],
        details: {
          staleClaimedRecipients: snapshot.staleClaimedRecipients.length,
          pendingRecipients: snapshot.pending,
        },
      });
      actions.push({
        key: `campaigns.release_stale_claimed:${campaign.id}`,
        actionId: "campaigns.release_stale_claimed",
        name: "Liberar claimed atascados",
        description:
          "Regresa recipients claimed sin progreso a queued/scheduled según su programación.",
        severity: "safe_auto_fix",
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        preview: {
          staleClaimedRecipients: snapshot.staleClaimedRecipients.length,
          staleAfterMs: campaignStaleAfterMs,
        },
      });
    }

    if (needsStatusReconcile) {
      const code: ExtensionCampaignRepairFindingCode =
        currentStatus === "waiting_runner" && expectedStatus === "queued"
          ? "waiting_runner_stuck"
          : currentStatus === "processing" && expectedStatus !== "processing"
            ? "processing_state_drift"
            : !snapshot.pending
              ? "terminal_state_drift"
              : "processing_state_drift";

      findings.push({
        code,
        severity: code === "waiting_runner_stuck" ? "high" : "medium",
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        message:
          code === "waiting_runner_stuck"
            ? "La campaña está en waiting_runner, pero ya hay runner activo y destinatarios listos."
            : !snapshot.pending
              ? "La campaña terminó operativamente, pero su estado persistido no coincide."
              : "La campaña tiene drift de estado operativo frente a sus recipients reales.",
        recoverable: true,
        suggestedActions: ["campaigns.reconcile_status"],
        details: {
          currentStatus,
          expectedStatus,
          pendingRecipients: snapshot.pending,
          readyRecipients: snapshot.ready,
          hasCompletedAt: Boolean(campaign.completedAt),
        },
      });

      actions.push({
        key: `campaigns.reconcile_status:${campaign.id}`,
        actionId: "campaigns.reconcile_status",
        name: "Reconciliar estado operativo",
        description:
          "Ajusta status/completedAt según recipients, programación y disponibilidad de runner.",
        severity: "safe_auto_fix",
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        preview: {
          fromStatus: currentStatus,
          toStatus: expectedStatus,
          pendingRecipients: snapshot.pending,
          readyRecipients: snapshot.ready,
          hasCompletedAt: Boolean(campaign.completedAt),
        },
      });
    }

    if (!snapshot.pending && snapshot.failed > 0) {
      findings.push({
        code: "completed_with_issues",
        severity: "info",
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        message:
          "La campaña ya terminó y tiene fallidos. Debe mostrarse como completada con incidencias y reporte descargable.",
        recoverable: false,
        suggestedActions: [],
        details: {
          failedRecipients: snapshot.failed,
          sentRecipients: snapshot.sent,
          completionStatus: snapshot.completionStatus,
        },
      });
    }
  }

  const safeActions = actions.filter((action) => action.severity === "safe_auto_fix").length;
  const reviewActions = actions.filter((action) => action.severity === "review_required").length;

  return {
    mode: "preview",
    requestId: params.requestId,
    generatedAt: params.now.toISOString(),
    runner: params.runner,
    findings,
    actions,
    summary: {
      campaignsAnalyzed: params.candidates.length,
      findings: findings.length,
      safeActions,
      reviewActions,
      appliedActions: 0,
      releasedClaimedRecipients: 0,
      reconciledCampaigns: 0,
    },
  };
}

async function releaseStaleClaimedRecipients(params: {
  userId: string;
  campaignId: string;
  now: Date;
  staleClaimAfterMs: number;
}) {
  const campaign = await prisma.extensionCampaign.findFirst({
    where: {
      id: params.campaignId,
      ownerUserId: params.userId,
    },
    select: {
      id: true,
      campaignName: true,
      batchSize: true,
      messageDelayMs: true,
      recipients: {
        where: {
          status: "claimed",
        },
        select: {
          id: true,
          scheduledFor: true,
          attemptedAt: true,
        },
      },
    },
  });

  if (!campaign || campaign.recipients.length === 0) {
    return { released: 0, queued: 0, scheduled: 0, campaignName: campaign?.campaignName ?? null };
  }

  const effectiveStaleClaimAfterMs = Math.max(
    params.staleClaimAfterMs,
    Math.max(250, campaign.messageDelayMs ?? 4_000) * Math.max(1, campaign.batchSize) * 2,
  );
  const staleBefore = new Date(params.now.getTime() - effectiveStaleClaimAfterMs);
  const staleRecipients = campaign.recipients.filter(
    (recipient) => !recipient.attemptedAt || recipient.attemptedAt <= staleBefore,
  );
  if (!staleRecipients.length) {
    return { released: 0, queued: 0, scheduled: 0, campaignName: campaign.campaignName };
  }

  const queuedIds = staleRecipients
    .filter((recipient) => !recipient.scheduledFor || recipient.scheduledFor <= params.now)
    .map((recipient) => recipient.id);
  const scheduledIds = staleRecipients
    .filter((recipient) => recipient.scheduledFor && recipient.scheduledFor > params.now)
    .map((recipient) => recipient.id);

  await prisma.$transaction([
    ...(queuedIds.length
      ? [
          prisma.extensionCampaignRecipient.updateMany({
            where: { id: { in: queuedIds } },
            data: {
              status: "queued",
              attemptedAt: null,
              lastError: null,
            },
          }),
        ]
      : []),
    ...(scheduledIds.length
      ? [
          prisma.extensionCampaignRecipient.updateMany({
            where: { id: { in: scheduledIds } },
            data: {
              status: "scheduled",
              attemptedAt: null,
              lastError: null,
            },
          }),
        ]
      : []),
  ]);

  return {
    released: staleRecipients.length,
    queued: queuedIds.length,
    scheduled: scheduledIds.length,
    campaignName: campaign.campaignName,
  };
}

async function reconcileCampaignStatus(params: {
  userId: string;
  campaignId: string;
  now: Date;
  staleClaimAfterMs: number;
  runner: ExtensionRunnerHealth;
}) {
  const staleBefore = new Date(params.now.getTime() - params.staleClaimAfterMs);
  const campaign = await prisma.extensionCampaign.findFirst({
    where: {
      id: params.campaignId,
      ownerUserId: params.userId,
    },
    include: {
      recipients: {
        select: {
          id: true,
          status: true,
          scheduledFor: true,
          attemptedAt: true,
          sentAt: true,
          lastError: true,
          contactName: true,
          contactValue: true,
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!campaign) {
    return {
      changed: false,
      campaignName: null,
      fromStatus: null,
      toStatus: null,
    };
  }

  const snapshot = buildCandidateSnapshot(campaign, params.now, staleBefore);
  const currentStatus = normalizeStatus(campaign.status) || "queued";
  const expectedStatus = resolvedExpectedCampaignStatus({
    campaign,
    snapshot,
    runner: params.runner,
    now: params.now,
  });
  const expectsTerminal = isTerminalStatus(expectedStatus);
  const needsCompletionAtFix =
    (expectsTerminal && !campaign.completedAt) || (!expectsTerminal && Boolean(campaign.completedAt));
  const needsStatusReconcile = expectedStatus !== currentStatus || needsCompletionAtFix;

  if (!needsStatusReconcile) {
    return {
      changed: false,
      campaignName: campaign.campaignName,
      fromStatus: currentStatus,
      toStatus: expectedStatus,
    };
  }

  await prisma.extensionCampaign.update({
    where: { id: campaign.id },
    data: {
      status: expectedStatus,
      completedAt: expectsTerminal ? campaign.completedAt ?? params.now : null,
    },
  });

  return {
    changed: true,
    campaignName: campaign.campaignName,
    fromStatus: currentStatus,
    toStatus: expectedStatus,
  };
}

async function reportCampaignRepairEvent(params: {
  userId: string;
  campaignId: string;
  requestId: string;
  actionId: ExtensionCampaignRepairActionId;
  campaignName: string | null;
  details: Record<string, unknown>;
}) {
  await writeBusinessEventSafe({
    type: BusinessEventType.EXTENSION_RUN_EVENT,
    userId: params.userId,
    subjectType: "extension_campaign",
    subjectId: params.campaignId,
    metadata: {
      eventType: "campaign_repair_applied",
      requestId: params.requestId,
      actionId: params.actionId,
      campaignName: params.campaignName,
      ...params.details,
    },
  });
}

export async function previewExtensionCampaignRepair(params: {
  userId: string;
  requestId: string;
  campaignId?: string | null;
  now?: Date;
  staleClaimAfterMs?: number;
}): Promise<ExtensionCampaignRepairPreviewResult> {
  const now = params.now ?? new Date();
  const staleClaimAfterMs = Math.min(
    Math.max(Math.round(params.staleClaimAfterMs ?? DEFAULT_CLAIM_STALE_AFTER_MS), 60_000),
    12 * 60 * 60_000,
  );

  const [runner, candidates] = await Promise.all([
    getExtensionRunnerHealth(params.userId, { now }),
    fetchRepairCandidates({ userId: params.userId, campaignId: params.campaignId }),
  ]);

  const preview = buildPreviewFromCandidates({
    requestId: params.requestId,
    now,
    staleClaimAfterMs,
    runner,
    candidates,
  });

  logStructured("info", "Extension campaign repair preview generated", {
    module: "extension-campaign-repair",
    action: "preview",
    result: "ok",
    requestId: params.requestId,
    actorUserId: params.userId,
    subjectType: "extension_campaign",
    subjectId: params.campaignId ?? null,
    metadata: {
      campaignId: params.campaignId ?? null,
      campaignsAnalyzed: preview.summary.campaignsAnalyzed,
      findings: preview.summary.findings,
      safeActions: preview.summary.safeActions,
    },
  });

  return preview;
}

export async function applyExtensionCampaignRepair(params: {
  userId: string;
  requestId: string;
  campaignId?: string | null;
  now?: Date;
  staleClaimAfterMs?: number;
}): Promise<ExtensionCampaignRepairApplyResult> {
  const now = params.now ?? new Date();
  const staleClaimAfterMs = Math.min(
    Math.max(Math.round(params.staleClaimAfterMs ?? DEFAULT_CLAIM_STALE_AFTER_MS), 60_000),
    12 * 60 * 60_000,
  );

  const preview = await previewExtensionCampaignRepair({
    userId: params.userId,
    requestId: params.requestId,
    campaignId: params.campaignId,
    now,
    staleClaimAfterMs,
  });

  const actionMap = new Map<string, Set<ExtensionCampaignRepairActionId>>();
  for (const action of preview.actions) {
    const set = actionMap.get(action.campaignId) ?? new Set<ExtensionCampaignRepairActionId>();
    set.add(action.actionId);
    actionMap.set(action.campaignId, set);
  }

  let appliedActions = 0;
  let releasedClaimedRecipients = 0;
  let reconciledCampaigns = 0;
  const updatedCampaignIds = new Set<string>();
  const runner = await getExtensionRunnerHealth(params.userId, { now });

  for (const [campaignId, campaignActions] of actionMap.entries()) {
    if (campaignActions.has("campaigns.release_stale_claimed")) {
      const released = await releaseStaleClaimedRecipients({
        userId: params.userId,
        campaignId,
        now,
        staleClaimAfterMs,
      });
      if (released.released > 0) {
        appliedActions += 1;
        releasedClaimedRecipients += released.released;
        updatedCampaignIds.add(campaignId);
        await reportCampaignRepairEvent({
          userId: params.userId,
          campaignId,
          requestId: params.requestId,
          actionId: "campaigns.release_stale_claimed",
          campaignName: released.campaignName,
          details: {
            releasedClaimedRecipients: released.released,
            queuedRecipients: released.queued,
            scheduledRecipients: released.scheduled,
          },
        });
      }
    }

    if (campaignActions.has("campaigns.reconcile_status")) {
      const reconciled = await reconcileCampaignStatus({
        userId: params.userId,
        campaignId,
        now,
        staleClaimAfterMs,
        runner,
      });
      if (reconciled.changed) {
        appliedActions += 1;
        reconciledCampaigns += 1;
        updatedCampaignIds.add(campaignId);
        await reportCampaignRepairEvent({
          userId: params.userId,
          campaignId,
          requestId: params.requestId,
          actionId: "campaigns.reconcile_status",
          campaignName: reconciled.campaignName,
          details: {
            fromStatus: reconciled.fromStatus,
            toStatus: reconciled.toStatus,
          },
        });
      }
    }
  }

  const postPreview = await previewExtensionCampaignRepair({
    userId: params.userId,
    requestId: params.requestId,
    campaignId: params.campaignId,
    staleClaimAfterMs,
  });

  const result: ExtensionCampaignRepairApplyResult = {
    ...postPreview,
    mode: "apply",
    summary: {
      ...postPreview.summary,
      appliedActions,
      releasedClaimedRecipients,
      reconciledCampaigns,
    },
    applied: {
      appliedActions,
      releasedClaimedRecipients,
      reconciledCampaigns,
      updatedCampaignIds: Array.from(updatedCampaignIds),
    },
  };

  logStructured("info", "Extension campaign repair applied", {
    module: "extension-campaign-repair",
    action: "apply",
    result: "ok",
    requestId: params.requestId,
    actorUserId: params.userId,
    subjectType: "extension_campaign",
    subjectId: params.campaignId ?? null,
    metadata: {
      campaignId: params.campaignId ?? null,
      appliedActions,
      releasedClaimedRecipients,
      reconciledCampaigns,
      updatedCampaignIds: result.applied.updatedCampaignIds,
    },
  });

  return result;
}

