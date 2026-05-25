import {
  BusinessEventType,
  Prisma,
  QuoteScenarioKind,
  type QuoteScenario,
  type QuoteSession,
} from "@prisma/client";

import {
  buildQuoteHistoryFingerprint,
  type QuoteHistoryEventPayload,
  type QuoteHistoryRecentSession,
  type QuoteHistorySavePayload,
  type QuoteHistorySaveResponse,
  type QuoteHistoryScenarioRecord,
  type QuoteHistorySessionRecord,
} from "@/lib/quote-history-types";
import { prisma } from "@/lib/prisma";
import { resolveCampus } from "@/lib/campus-resolver";
import { writeBusinessEventSafe } from "@/lib/business-events";
import { getQuoteMode, type RuntimeMode } from "@/lib/runtime-modes";
const GENERIC_DRAFT_LABELS = new Set(["escenario actual", "escenario en curso"]);

const BUSINESS_LINE_LABELS: Record<string, string> = {
  salud: "Salud",
  licenciatura: "Licenciatura",
  lic: "Licenciatura",
  prepa: "Bachillerato",
  preparatoria: "Bachillerato",
  bachillerato: "Bachillerato",
  bachiller: "Bachillerato",
  maestria: "Posgrado",
  "maestría": "Posgrado",
  doctorado: "Posgrado",
  posgrado: "Posgrado",
};

const MODALITY_LABELS: Record<string, string> = {
  presencial: "Presencial",
  mixta: "Mixta",
  online: "En línea",
};

const ENROLLMENT_TYPE_LABELS: Record<string, string> = {
  nuevo_ingreso: "Nuevo ingreso",
  regreso: "Regreso",
  reingreso: "Reingreso",
};

type SessionWithScenarios = QuoteSession & {
  scenarios: QuoteScenario[];
};

function normalizeRuntimeMode(value: string): RuntimeMode {
  void value;
  return getQuoteMode();
}

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

function toPlainJson<T>(value: T) {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeNumber(value: number) {
  return Number(value.toFixed(2));
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildDraftScenarioLabel(params: {
  label?: string | null;
  programNameSnapshot?: string | null;
  campusNameSnapshot?: string | null;
  businessLine?: string | null;
  modality?: string | null;
  enrollmentType?: string | null;
}) {
  const normalizedLabel = normalizeText(params.label);
  if (normalizedLabel && !GENERIC_DRAFT_LABELS.has(normalizedLabel.toLowerCase())) {
    return normalizedLabel;
  }

  const programLabel = normalizeText(params.programNameSnapshot);
  const businessLineLabel =
    BUSINESS_LINE_LABELS[normalizeText(params.businessLine).toLowerCase()] ??
    normalizeText(params.businessLine);
  const modalityLabel =
    MODALITY_LABELS[normalizeText(params.modality).toLowerCase()] ??
    normalizeText(params.modality);
  const campusLabel = normalizeText(params.campusNameSnapshot);
  const enrollmentLabel =
    ENROLLMENT_TYPE_LABELS[normalizeText(params.enrollmentType).toLowerCase()] || null;

  const primary = programLabel || businessLineLabel;
  const secondary =
    modalityLabel || (!programLabel ? campusLabel : null) || enrollmentLabel;

  const derived = [primary, secondary].filter(Boolean).join(" · ");
  return derived || "Cotización actual";
}

function resolveScenarioLabel(record: Pick<
  QuoteScenario,
  | "kind"
  | "label"
  | "programNameSnapshot"
  | "campusNameSnapshot"
  | "businessLine"
  | "modality"
  | "enrollmentType"
>) {
  if (record.kind !== QuoteScenarioKind.DRAFT) {
    return normalizeText(record.label) || "Escenario guardado";
  }

  return buildDraftScenarioLabel(record);
}

function serializeScenario(record: QuoteScenario): QuoteHistoryScenarioRecord {
  return {
    id: record.id,
    label: resolveScenarioLabel(record),
    kind: record.kind,
    campusNameSnapshot: record.campusNameSnapshot ?? null,
    programNameSnapshot: record.programNameSnapshot ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    input: toPlainJson(record.inputJson as QuoteHistoryScenarioRecord["input"]),
    result: toPlainJson(record.resultJson as QuoteHistoryScenarioRecord["result"]),
  };
}

function serializeSession(record: SessionWithScenarios): QuoteHistorySessionRecord {
  return {
    publicId: record.publicId,
    quoteMode: normalizeRuntimeMode(record.quoteMode),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastOpenedAt: toIsoString(record.lastOpenedAt),
    scenarios: record.scenarios
      .slice()
      .sort((left, right) => {
        if (left.kind !== right.kind) {
          return left.kind === QuoteScenarioKind.DRAFT ? -1 : 1;
        }
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      })
      .map(serializeScenario),
  };
}

export async function listRecentQuoteSessionsForUser(
  ownerUserId: string,
  limit = 8,
): Promise<QuoteHistoryRecentSession[]> {
  const sessions = await prisma.quoteSession.findMany({
    where: { ownerUserId },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
    select: {
      publicId: true,
      quoteMode: true,
      updatedAt: true,
      scenarios: {
        orderBy: [{ updatedAt: "desc" }],
        take: 1,
        select: {
          kind: true,
          label: true,
          enrollmentType: true,
          businessLine: true,
          modality: true,
          campusNameSnapshot: true,
          programNameSnapshot: true,
          totalMxn: true,
        },
      },
    },
  });

  return sessions.map((session) => {
    const latest = session.scenarios[0];
    return {
      publicId: session.publicId,
      quoteMode: normalizeRuntimeMode(session.quoteMode),
      updatedAt: session.updatedAt.toISOString(),
      latestScenarioLabel: latest ? resolveScenarioLabel(latest) : null,
      latestCampusName: latest?.campusNameSnapshot ?? null,
      latestProgramName: latest?.programNameSnapshot ?? null,
      latestTotalMxn:
        latest?.totalMxn === undefined || latest?.totalMxn === null
          ? null
          : Number(latest.totalMxn),
    };
  });
}

export async function getQuoteSessionForUser(
  ownerUserId: string,
  publicId: string,
  markOpened = false,
): Promise<QuoteHistorySessionRecord | null> {
  const session = await prisma.quoteSession.findFirst({
    where: { ownerUserId, publicId },
    include: {
      scenarios: {
        orderBy: [{ updatedAt: "desc" }],
      },
    },
  });

  if (!session) return null;

  if (markOpened) {
    const updated = await prisma.quoteSession.update({
      where: { id: session.id },
      data: { lastOpenedAt: new Date() },
      include: {
        scenarios: {
          orderBy: [{ updatedAt: "desc" }],
        },
      },
    });
    return serializeSession(updated);
  }

  return serializeSession(session);
}

function areJsonSnapshotsEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildSimulationMetadata(
  payload: QuoteHistorySavePayload,
  campusName: string | null,
  programName: string | null,
) {
  return {
    quoteMode: payload.quoteMode,
    enrollmentType: payload.input.enrollmentType,
    businessLine: payload.input.businessLine,
    modality: payload.input.modality,
    plan: payload.input.plan,
    campus: campusName,
    program: programName,
    average: normalizeNumber(payload.input.average),
    subjectCount: payload.input.subjectCount,
    extraChargeAmount: normalizeNumber(payload.input.extraChargeAmount),
    chargeType: payload.input.chargeType,
    totalMxn: normalizeNumber(payload.result.totalMxn),
    scholarshipPercent: normalizeNumber(payload.result.scholarshipPercent),
    additionalBenefitPercent: normalizeNumber(payload.result.additionalBenefitPercent),
    additionalBenefitNotes: payload.result.additionalBenefitNotes,
    additionalBenefitDuration: payload.result.additionalBenefitDuration,
    firstPaymentAmountMxn: normalizeNumber(payload.result.firstPaymentAmountMxn),
    firstPaymentNotes: payload.result.firstPaymentNotes,
    firstPaymentDuration: payload.result.firstPaymentDuration,
    source: payload.result.source,
  } satisfies Record<string, unknown>;
}

function isDraftUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function matchesDraftSnapshot(params: {
  draft: QuoteScenario;
  inputFingerprint: string;
  result: QuoteHistorySavePayload["result"];
  programId: string | null;
  campusId: string | null;
}) {
  return (
    params.draft.inputFingerprint === params.inputFingerprint &&
    areJsonSnapshotsEqual(params.draft.resultJson, params.result) &&
    params.draft.programId === params.programId &&
    params.draft.campusId === params.campusId
  );
}

async function findExistingDraft(quoteSessionId: string) {
  return prisma.quoteScenario.findFirst({
    where: {
      quoteSessionId,
      kind: QuoteScenarioKind.DRAFT,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function saveQuoteScenarioForUser(
  ownerUserId: string,
  payload: QuoteHistorySavePayload,
): Promise<QuoteHistorySaveResponse> {
  const inputFingerprint = buildQuoteHistoryFingerprint(payload.input);

  const [existingSession, campus, program] = await Promise.all([
    payload.sessionPublicId
      ? prisma.quoteSession.findFirst({
          where: { publicId: payload.sessionPublicId, ownerUserId },
          include: {
            scenarios: {
              orderBy: [{ updatedAt: "desc" }],
            },
          },
        })
      : Promise.resolve(null),
    payload.input.campus ? resolveCampus(payload.input.campus) : Promise.resolve(null),
    payload.input.selectedProgramId
      ? prisma.program.findUnique({
          where: { id: payload.input.selectedProgramId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  const session =
    existingSession ??
    (await prisma.quoteSession.create({
      data: {
        ownerUserId,
        quoteMode: payload.quoteMode,
      },
      include: {
        scenarios: {
          orderBy: [{ updatedAt: "desc" }],
        },
      },
    }));

  const campusName = campus?.name ?? (payload.input.campus?.trim() || null);
  const programName =
    program?.name ?? (payload.input.selectedProgramName?.trim() || null);
  const inputJson = toPlainJson(payload.input) as Prisma.InputJsonValue;
  const resultJson = toPlainJson(payload.result) as Prisma.InputJsonValue;
  const scenarioData = {
    quoteSessionId: session.id,
    label:
      payload.mode === "autosave"
        ? buildDraftScenarioLabel({
            programNameSnapshot: programName,
            campusNameSnapshot: campusName,
            businessLine: payload.input.businessLine,
            modality: payload.input.modality,
            enrollmentType: payload.input.enrollmentType,
          })
        : String(payload.label ?? "").trim() || "Escenario guardado",
    inputFingerprint,
    inputJson,
    resultJson,
    enrollmentType: payload.input.enrollmentType,
    businessLine: payload.input.businessLine,
    modality: payload.input.modality,
    plan: payload.input.plan,
    campusId: campus?.id ?? null,
    campusNameSnapshot: campusName,
    programId: program?.id ?? null,
    programNameSnapshot: programName,
    average: new Prisma.Decimal(payload.input.average),
    subjectCount: payload.input.subjectCount,
    extraChargeAmount: new Prisma.Decimal(payload.input.extraChargeAmount),
    basePriceMxn: new Prisma.Decimal(payload.result.basePriceMxn),
    scholarshipPercent: new Prisma.Decimal(payload.result.scholarshipPercent),
    scholarshipAmountMxn: new Prisma.Decimal(payload.result.scholarshipAmountMxn),
    additionalBenefitPercent: new Prisma.Decimal(payload.result.additionalBenefitPercent),
    additionalBenefitAmountMxn: new Prisma.Decimal(payload.result.additionalBenefitAmountMxn),
    firstPaymentAmountMxn: new Prisma.Decimal(payload.result.firstPaymentAmountMxn),
    subtotalMxn: new Prisma.Decimal(payload.result.subtotalMxn),
    totalMxn: new Prisma.Decimal(payload.result.totalMxn),
    sinAccessToScholarship: payload.result.sinAccessToScholarship,
  } satisfies Prisma.QuoteScenarioUncheckedCreateInput;

  let savedScenarioId = "";
  let changed = true;

  if (payload.mode === "autosave") {
    const saveDraft = async () => {
      const existingDraft = await findExistingDraft(session.id);

      if (
        existingDraft &&
        matchesDraftSnapshot({
          draft: existingDraft,
          inputFingerprint,
          result: payload.result,
          programId: program?.id ?? null,
          campusId: campus?.id ?? null,
        })
      ) {
        changed = false;
        savedScenarioId = existingDraft.id;
        return;
      }

      if (existingDraft) {
        const updated = await prisma.quoteScenario.update({
          where: { id: existingDraft.id },
          data: {
            ...scenarioData,
            kind: QuoteScenarioKind.DRAFT,
          },
          select: { id: true },
        });
        savedScenarioId = updated.id;
        return;
      }

      try {
        const created = await prisma.quoteScenario.create({
          data: {
            ...scenarioData,
            kind: QuoteScenarioKind.DRAFT,
          },
          select: { id: true },
        });
        savedScenarioId = created.id;
      } catch (error) {
        if (!isDraftUniqueConflict(error)) {
          throw error;
        }

        const conflictedDraft = await findExistingDraft(session.id);
        if (!conflictedDraft) {
          throw error;
        }

        if (
          matchesDraftSnapshot({
            draft: conflictedDraft,
            inputFingerprint,
            result: payload.result,
            programId: program?.id ?? null,
            campusId: campus?.id ?? null,
          })
        ) {
          changed = false;
          savedScenarioId = conflictedDraft.id;
          return;
        }

        const updated = await prisma.quoteScenario.update({
          where: { id: conflictedDraft.id },
          data: {
            ...scenarioData,
            kind: QuoteScenarioKind.DRAFT,
          },
          select: { id: true },
        });
        savedScenarioId = updated.id;
      }
    };

    await saveDraft();

    if (changed) {
      await writeBusinessEventSafe({
        type: BusinessEventType.QUOTE_SIMULATED,
        userId: ownerUserId,
        quoteSessionId: session.id,
        quoteScenarioId: savedScenarioId,
        metadata: buildSimulationMetadata(payload, campusName, programName),
      });

      if (
        payload.result.additionalBenefitPercent > 0 ||
        payload.result.firstPaymentAmountMxn > 0
      ) {
        await writeBusinessEventSafe({
          type: BusinessEventType.BENEFIT_APPLIED,
          userId: ownerUserId,
          quoteSessionId: session.id,
          quoteScenarioId: savedScenarioId,
          metadata: buildSimulationMetadata(payload, campusName, programName),
        });
      }
    }
  } else {
    const created = await prisma.quoteScenario.create({
      data: {
        ...scenarioData,
        kind: QuoteScenarioKind.SAVED,
      },
      select: { id: true },
    });
    savedScenarioId = created.id;

    await writeBusinessEventSafe({
      type: BusinessEventType.QUOTE_SCENARIO_SAVED,
      userId: ownerUserId,
      quoteSessionId: session.id,
      quoteScenarioId: created.id,
      metadata: {
        ...buildSimulationMetadata(payload, campusName, programName),
        label: scenarioData.label,
      },
    });
  }

  const refreshed = await prisma.quoteSession.findUniqueOrThrow({
    where: { id: session.id },
    include: {
      scenarios: {
        orderBy: [{ updatedAt: "desc" }],
      },
    },
  });

  return {
    changed,
    savedScenarioId,
    session: serializeSession(refreshed),
  };
}

export async function writeQuoteHistoryEvent(params: {
  ownerUserId: string | null;
  payload: QuoteHistoryEventPayload;
}) {
  let quoteSessionId: string | null = null;

  if (params.payload.sessionPublicId && params.ownerUserId) {
    const session = await prisma.quoteSession.findFirst({
      where: {
        publicId: params.payload.sessionPublicId,
        ownerUserId: params.ownerUserId,
      },
      select: { id: true },
    });
    quoteSessionId = session?.id ?? null;
  }

  const typeMap: Record<QuoteHistoryEventPayload["type"], BusinessEventType> = {
    CTA_CLICKED: BusinessEventType.CTA_CLICKED,
    QUOTE_SCENARIO_LOADED: BusinessEventType.QUOTE_SCENARIO_LOADED,
    QUOTE_COMPARISON_VIEWED: BusinessEventType.QUOTE_COMPARISON_VIEWED,
  };

  await writeBusinessEventSafe({
    type: typeMap[params.payload.type],
    userId: params.ownerUserId,
    quoteSessionId,
    quoteScenarioId: params.payload.scenarioId ?? null,
    metadata: (params.payload.metadata ?? null) as Prisma.InputJsonValue,
  });
}
