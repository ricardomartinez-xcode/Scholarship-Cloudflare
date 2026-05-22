import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { resolveAdditionalBenefits } from "@/lib/additional-benefits";
import {
  normalizeBusinessLine,
  normalizeCanonicalModality,
  normalizeEnrollmentType,
} from "@/lib/pricing-normalize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getSessionUser();
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (auth.status === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const benefits = await resolveAdditionalBenefits({
      campus: (searchParams.get("plantel") ?? "").trim() || null,
      businessLine: normalizeBusinessLine(searchParams.get("businessLine")),
      modality: normalizeCanonicalModality(searchParams.get("modality")),
      enrollmentType: normalizeEnrollmentType(searchParams.get("enrollmentType")),
    });

    return NextResponse.json({
      benefit: benefits.percentageBenefit,
      fixedScholarshipBenefit: benefits.fixedScholarshipBenefit,
      firstPaymentBenefit: benefits.firstPaymentBenefit,
    });
  } catch {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
