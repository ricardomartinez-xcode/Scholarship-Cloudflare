import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  computeLegacyScholarshipQuote,
  loadLegacyPricingSnapshot,
} from "@/lib/legacy-pricing";
import {
  normalizeBusinessLine,
  normalizeCanonicalModality,
  normalizeEnrollmentType,
} from "@/lib/pricing-normalize";
import { resolveScholarshipQuote } from "@/lib/scholarship-quote-service";
import { getQuoteMode } from "@/lib/runtime-modes";
import { checkRateLimit } from "@/lib/rate-limit";

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
  clientSurface?: string;
};

function statusCodeForSessionState(
  status: "unauthenticated" | "forbidden" | "inactive" | "ok",
) {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
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

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const quoteLimiter = checkRateLimit(`ext-quote:${session.user.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!quoteLimiter.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterMs: quoteLimiter.retryAfterMs },
      { status: 429 },
    );
  }

  let payload: QuotePayload;
  try {
    payload = (await request.json()) as QuotePayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", source: "extension" },
      { status: 400 },
    );
  }

  const enrollmentType = normalizeEnrollmentType(payload.enrollmentType);
  const businessLine = normalizeBusinessLine(payload.businessLine);
  const modality = normalizeCanonicalModality(payload.modality);
  const plan = toOptionalNumber(payload.plan);
  const average = toOptionalNumber(payload.average);
  const subjectCount = toOptionalNumber(payload.subjectCount);
  const extraChargeAmount = toOptionalNumber(payload.extraCharge) ?? 0;
  const clientSurface =
    String(payload.clientSurface ?? "chrome_side_panel").trim() || "chrome_side_panel";

  const missing = [
    !enrollmentType ? "enrollmentType" : null,
    !businessLine ? "businessLine" : null,
    !modality ? "modality" : null,
    plan === null ? "plan" : null,
    average === null ? "average" : null,
  ].filter((value): value is string => Boolean(value));

  if (missing.length) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_fields",
        missing,
        source: "extension",
      },
      { status: 400 },
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
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        invalid,
        source: "extension",
      },
      { status: 400 },
    );
  }

  const input = {
    enrollmentType,
    businessLine,
    modality,
    plan,
    campus: payload.campus ?? null,
    average,
    subjectCount,
    extraChargeAmount,
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
    clientSurface: string;
  };

  const quoteMode = getQuoteMode();

  if (quoteMode === "canonical") {
    const result = await resolveScholarshipQuote(input);
    return NextResponse.json(
      {
        ...result,
        modeUsed: "canonical",
      },
      { status: result.ok ? 200 : 422 },
    );
  }

  const snapshot = await loadLegacyPricingSnapshot();
  const result = await computeLegacyScholarshipQuote(input, snapshot);
  return NextResponse.json(
    {
      ...result,
      modeUsed: quoteMode,
    },
    { status: result.ok ? 200 : 422 },
  );
}
