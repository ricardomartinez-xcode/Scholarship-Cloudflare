import { Prisma, type BusinessEventType } from "@prisma/client";

import { writeD1BusinessEvent } from "@/lib/cloudflare/extension-runtime-d1";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import { captureException, sanitizeTelemetryObject } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

type JsonInput = Prisma.InputJsonValue | null | undefined;

export type WriteBusinessEventParams = {
  type: BusinessEventType;
  userId?: string | null;
  quoteSessionId?: string | null;
  quoteScenarioId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  metadata?: JsonInput;
};

function toOptionalJson(value: JsonInput) {
  if (value === undefined) return undefined;
  const sanitized = value === null ? null : sanitizeTelemetryObject(value);
  return sanitized === null ? Prisma.JsonNull : sanitized;
}

export async function writeBusinessEvent(params: WriteBusinessEventParams) {
  if (isCloudflareRuntime()) {
    await writeD1BusinessEvent({
      type: String(params.type),
      userId: params.userId ?? null,
      quoteSessionId: params.quoteSessionId ?? null,
      quoteScenarioId: params.quoteScenarioId ?? null,
      subjectType: params.subjectType ?? null,
      subjectId: params.subjectId ?? null,
      metadata: params.metadata ?? null,
    });
    return null;
  }

  return prisma.businessEvent.create({
    data: {
      type: params.type,
      userId: params.userId ?? null,
      quoteSessionId: params.quoteSessionId ?? null,
      quoteScenarioId: params.quoteScenarioId ?? null,
      subjectType: params.subjectType ?? null,
      subjectId: params.subjectId ?? null,
      metadata: toOptionalJson(params.metadata),
    },
  });
}

export async function writeBusinessEventSafe(params: WriteBusinessEventParams) {
  try {
    await writeBusinessEvent(params);
  } catch (error) {
    captureException(
      error,
      {
        module: "business-events",
        action: "write",
        result: "failure",
        actorUserId: params.userId ?? null,
        subjectType: params.subjectType ?? null,
        subjectId: params.subjectId ?? null,
        metadata: {
          type: params.type,
          quoteSessionId: params.quoteSessionId ?? null,
          quoteScenarioId: params.quoteScenarioId ?? null,
        },
      },
      "Business event write failed",
    );
  }
}
