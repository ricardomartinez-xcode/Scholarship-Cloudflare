import { NextResponse } from "next/server";
import { BusinessEventType } from "@prisma/client";

import { getSessionUser } from "@/lib/authz";
import { writeBusinessEventSafe } from "@/lib/business-events";
import { addObservabilityBreadcrumb, captureException, logStructured } from "@/lib/observability";
import {
  normalizeBusinessLine,
  normalizeCanonicalModality,
  normalizeEnrollmentType,
} from "@/lib/pricing-normalize";
import { resolveCanonicalQuote } from "@relead/domain/calculator/quote-service";
import { resolveScholarshipQuote } from "@/lib/scholarship-quote-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QuotePayload = {
  enrollmentType?: string;
  businessLine?: string;
  modality?: string;
  plan?: number | string;
  campus?: string | null;
  average?: number | string;
  subjectCount?: number | string | null;
  extraCharge?: number | string | { amount?: number | string } | null;
  selectedProgramId?: string | null;
  clientSurface?: string;
};

function buildRequestId() {
  return `quote_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "amount" in value) {
    return toOptionalNumber((value as { amount?: unknown }).amount);
  }
  return null;
}

async function recordQuoteGeneratedEvent(params: {
  userId: string;
  requestId: string;
  input: {
    enrollmentType: string;
    businessLine: string;
    modality: string;
    plan: number;
    campus: string | null;
    average: number;
    subjectCount: number | null;
    extraChargeAmount: number;
    selectedProgramId: string | null;
    clientSurface: string;
  };
  result: Extract<
    Awaited<ReturnType<typeof resolveScholarshipQuote>>,
    { ok: true }
  >;
}) {
  await writeBusinessEventSafe({
    type: BusinessEventType.QUOTE_GENERATED,
    userId: params.userId,
    subjectType: "QuoteRequest",
    subjectId: params.requestId,
    metadata: {
      enrollmentType: params.input.enrollmentType,
      businessLine: params.input.businessLine,
      modality: params.input.modality,
      plan: params.input.plan,
      campus: params.input.campus,
      average: params.input.average,
      subjectCount: params.input.subjectCount,
      extraChargeAmount: params.input.extraChargeAmount,
      selectedProgramId: params.input.selectedProgramId,
      clientSurface: params.input.clientSurface,
      source: params.result.source,
      tier: params.result.tier,
      totalMxn: params.result.totalMxn,
      scholarshipPercent: params.result.scholarshipPercent,
      additionalBenefitPercent: params.result.additionalBenefitPercent,
      additionalBenefitDuration: params.result.additionalBenefitDuration,
      firstPaymentAmountMxn: params.result.firstPaymentAmountMxn,
      firstPaymentDuration: params.result.firstPaymentDuration,
      compareMode: false,
      mismatchCount: 0,
    },
  });
}

export async function POST(request: Request) {
  const requestId = buildRequestId();
  const startedAt = Date.now();
  let statusCode = 200;
  let actorUserId: string | null = null;
  let actorEmail: string | null = null;

  try {
    const auth = await getSessionUser();
    if (auth.status === "unauthenticated") {
      statusCode = 401;
      return NextResponse.json({ error: "unauthenticated", requestId }, { status: statusCode });
    }
    if (auth.status === "forbidden") {
      statusCode = 403;
      return NextResponse.json({ error: "forbidden", requestId }, { status: statusCode });
    }
    if (auth.status === "inactive") {
      statusCode = 403;
      return NextResponse.json({ error: "inactive", requestId }, { status: statusCode });
    }

    actorUserId = auth.user.id;
    actorEmail = auth.email;

    let payload: QuotePayload;
    try {
      payload = (await request.json()) as QuotePayload;
    } catch {
      statusCode = 400;
      return NextResponse.json(
        { ok: false, error: "invalid_json", source: "canonical", requestId },
        { status: statusCode },
      );
    }

    const enrollmentType = normalizeEnrollmentType(payload.enrollmentType);
    const businessLine = normalizeBusinessLine(payload.businessLine);
    const modality = normalizeCanonicalModality(payload.modality);
    const plan = toOptionalNumber(payload.plan);
    const average = toOptionalNumber(payload.average);
    const subjectCount = toOptionalNumber(payload.subjectCount);
    const extraChargeAmount = toOptionalNumber(payload.extraCharge) ?? 0;
    const selectedProgramId =
      typeof payload.selectedProgramId === "string" && payload.selectedProgramId.trim()
        ? payload.selectedProgramId.trim()
        : null;
    const clientSurface = String(payload.clientSurface ?? "web_app").trim() || "web_app";

    const missing = [
      !enrollmentType ? "enrollmentType" : null,
      !businessLine ? "businessLine" : null,
      !modality ? "modality" : null,
      plan === null ? "plan" : null,
      average === null ? "average" : null,
    ].filter((value): value is string => Boolean(value));

    if (missing.length) {
      statusCode = 400;
      return NextResponse.json(
        {
          ok: false,
          error: "missing_fields",
          missing,
          source: "canonical",
          requestId,
        },
        { status: statusCode },
      );
    }

    const invalid: string[] = [];
    if (plan !== null && (!Number.isInteger(plan) || plan <= 0)) invalid.push("plan");
    if (average !== null && (average < 0 || average > 10)) invalid.push("average");
    if (
      subjectCount !== null &&
      (!Number.isInteger(subjectCount) || subjectCount <= 0)
    ) {
      invalid.push("subjectCount");
    }
    if (extraChargeAmount < 0) invalid.push("extraCharge");
    if (enrollmentType === "regreso" && subjectCount === null) {
      invalid.push("subjectCount");
    }

    if (invalid.length) {
      logStructured("warn", "Rejected quote payload", {
        module: "quote-api",
        action: "validate",
        result: "failure",
        requestId,
        actorUserId: auth.user.id,
        actorEmail: auth.email,
        metadata: { invalid, clientSurface },
      });
      statusCode = 400;
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_payload",
          invalid,
          source: "canonical",
          requestId,
        },
        { status: statusCode },
      );
    }

    const requestInput = {
      enrollmentType,
      businessLine,
      modality,
      plan,
      campus: payload.campus ?? null,
      average,
      subjectCount,
      extraChargeAmount,
      selectedProgramId,
      clientSurface,
    } as {
      enrollmentType: NonNullable<typeof enrollmentType>;
      businessLine: NonNullable<typeof businessLine>;
      modality: NonNullable<typeof modality>;
      plan: NonNullable<typeof plan>;
      campus: string | null;
      average: NonNullable<typeof average>;
      subjectCount: number | null;
      extraChargeAmount: number;
      selectedProgramId: string | null;
      clientSurface: string;
    };

    addObservabilityBreadcrumb("Resolving scholarship quote", {
      module: "quote-api",
      action: "resolve",
      result: "started",
      requestId,
      actorUserId: auth.user.id,
      metadata: {
        enrollmentType: requestInput.enrollmentType,
        businessLine: requestInput.businessLine,
        modality: requestInput.modality,
        plan: requestInput.plan,
        clientSurface: requestInput.clientSurface,
      },
    });

    let canonicalResult: Awaited<ReturnType<typeof resolveScholarshipQuote>>;
    try {
      canonicalResult = await resolveCanonicalQuote(requestInput);
    } catch (error) {
      captureException(error, {
        module: "quote-api",
        action: "resolve",
        result: "failure",
        requestId,
        actorUserId: auth.user.id,
        actorEmail: auth.email,
        metadata: {
          enrollmentType: requestInput.enrollmentType,
          businessLine: requestInput.businessLine,
          modality: requestInput.modality,
          plan: requestInput.plan,
          clientSurface: requestInput.clientSurface,
        },
      }, "Scholarship quote resolution failed");
      statusCode = 500;
      return NextResponse.json(
        { ok: false, error: "quote_resolution_failed", source: "canonical", requestId },
        { status: statusCode },
      );
    }

    if (canonicalResult.ok) {
      await recordQuoteGeneratedEvent({
        userId: auth.user.id,
        requestId,
        input: requestInput,
        result: canonicalResult,
      });
    }

    statusCode = canonicalResult.ok ? 200 : 422;
    return NextResponse.json(
      { ...canonicalResult, requestId },
      { status: statusCode },
    );
  } catch (error) {
    statusCode = 500;
    throw error;
  } finally {
    logStructured("info", "Quote request handled", {
      module: "quote-api",
      action: "POST",
      result:
        statusCode >= 500 ? "error" : statusCode >= 400 ? "rejected" : "success",
      requestId,
      actorUserId,
      actorEmail,
      metadata: {
        route: "/api/data/quote",
        statusCode,
        duration_ms: Date.now() - startedAt,
      },
    });
  }
}
