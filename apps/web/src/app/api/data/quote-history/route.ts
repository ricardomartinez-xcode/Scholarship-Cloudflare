import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  getQuoteSessionForUser,
  listRecentQuoteSessionsForUser,
  saveQuoteScenarioForUser,
} from "@/lib/quote-history";
import { type QuoteHistorySavePayload } from "@/lib/quote-history-types";
import { normalizeBusinessLine, normalizeCanonicalModality, normalizeEnrollmentType } from "@/lib/pricing-normalize";
import { getQuoteMode, type RuntimeMode } from "@/lib/runtime-modes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseRuntimeMode(value: unknown): RuntimeMode {
  void value;
  return getQuoteMode();
}

function parseSavePayload(payload: unknown): QuoteHistorySavePayload | null {
  if (!payload || typeof payload !== "object") return null;

  const raw = payload as Record<string, unknown>;
  const mode = raw.mode === "snapshot" ? "snapshot" : raw.mode === "autosave" ? "autosave" : null;
  if (!mode) return null;

  const input = raw.input;
  const result = raw.result;
  if (!input || typeof input !== "object" || !result || typeof result !== "object") {
    return null;
  }

  const inputRecord = input as Record<string, unknown>;
  const resultRecord = result as Record<string, unknown>;
  const enrollmentType = normalizeEnrollmentType(
    String(inputRecord.enrollmentType ?? ""),
  );
  const businessLine = normalizeBusinessLine(
    String(inputRecord.businessLine ?? ""),
  );
  const modality = normalizeCanonicalModality(
    String(inputRecord.modality ?? ""),
  );
  const plan = toOptionalNumber(inputRecord.plan);
  const average = toOptionalNumber(inputRecord.average);
  const extraChargeAmount = toOptionalNumber(inputRecord.extraChargeAmount) ?? 0;
  const subjectCount = toOptionalNumber(inputRecord.subjectCount);

  const basePriceMxn = toOptionalNumber(resultRecord.basePriceMxn);
  const scholarshipPercent = toOptionalNumber(resultRecord.scholarshipPercent);
  const scholarshipAmountMxn = toOptionalNumber(resultRecord.scholarshipAmountMxn);
  const additionalBenefitPercent = toOptionalNumber(resultRecord.additionalBenefitPercent);
  const additionalBenefitAmountMxn = toOptionalNumber(resultRecord.additionalBenefitAmountMxn);
  const firstPaymentAmountMxn = toOptionalNumber(resultRecord.firstPaymentAmountMxn) ?? 0;
  const subtotalMxn = toOptionalNumber(resultRecord.subtotalMxn);
  const totalMxn = toOptionalNumber(resultRecord.totalMxn);
  const source = resultRecord.source === "canonical" ? "canonical" : null;

  if (
    !enrollmentType ||
    !businessLine ||
    !modality ||
    plan === null ||
    average === null ||
    basePriceMxn === null ||
    scholarshipPercent === null ||
    scholarshipAmountMxn === null ||
    additionalBenefitPercent === null ||
    additionalBenefitAmountMxn === null ||
    subtotalMxn === null ||
    totalMxn === null ||
    !source
  ) {
    return null;
  }

  return {
    mode,
    sessionPublicId: String(raw.sessionPublicId ?? "").trim() || null,
    label: String(raw.label ?? "").trim() || null,
    quoteMode: parseRuntimeMode(raw.quoteMode),
    input: {
      enrollmentType,
      businessLine,
      modality,
      plan,
      campus: String(inputRecord.campus ?? "").trim() || null,
      average,
      subjectCount,
      extraChargeAmount,
      chargeType: String(inputRecord.chargeType ?? "").trim() || null,
      selectedProgramId: String(inputRecord.selectedProgramId ?? "").trim() || null,
      selectedProgramName: String(inputRecord.selectedProgramName ?? "").trim() || null,
    },
    result: {
      source,
      basePriceMxn,
      scholarshipPercent,
      scholarshipAmountMxn,
      additionalBenefitPercent,
      additionalBenefitNotes: String(resultRecord.additionalBenefitNotes ?? "").trim() || null,
      additionalBenefitDuration:
        String(resultRecord.additionalBenefitDuration ?? "").trim() || null,
      additionalBenefitAmountMxn,
      firstPaymentAmountMxn,
      firstPaymentNotes: String(resultRecord.firstPaymentNotes ?? "").trim() || null,
      firstPaymentDuration:
        String(resultRecord.firstPaymentDuration ?? "").trim() || null,
      subtotalMxn,
      totalMxn,
      tier: String(resultRecord.tier ?? "").trim() || null,
      sinAccessToScholarship: Boolean(resultRecord.sinAccessToScholarship),
    },
  };
}

function unauthorizedResponse(status: "unauthenticated" | "forbidden" | "inactive") {
  return NextResponse.json({ error: status }, { status: status === "unauthenticated" ? 401 : 403 });
}

export async function GET(request: Request) {
  const auth = await getSessionUser();
  if (auth.status !== "ok") {
    return unauthorizedResponse(auth.status);
  }

  const { searchParams } = new URL(request.url);
  const sessionId = String(searchParams.get("sessionId") ?? "").trim();
  if (sessionId) {
    const session = await getQuoteSessionForUser(auth.user.id, sessionId, true);
    if (!session) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(session);
  }

  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 8), 1), 20);
  const sessions = await listRecentQuoteSessionsForUser(auth.user.id, limit);
  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const auth = await getSessionUser();
  if (auth.status !== "ok") {
    return unauthorizedResponse(auth.status);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseSavePayload(payload);
  if (!parsed) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const session = await saveQuoteScenarioForUser(auth.user.id, parsed);
  return NextResponse.json(session);
}
