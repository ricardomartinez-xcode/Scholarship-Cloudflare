import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { resolveD1AdditionalBenefits } from "@/lib/cloudflare/additional-benefits";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
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
    const input = {
      campus: (searchParams.get("plantel") ?? "").trim() || null,
      businessLine: normalizeBusinessLine(searchParams.get("businessLine")),
      modality: normalizeCanonicalModality(searchParams.get("modality")),
      enrollmentType: normalizeEnrollmentType(searchParams.get("enrollmentType")),
    };
    const benefits = isCloudflareRuntime()
      ? await resolveD1AdditionalBenefits(input)
      : await (await import("@/lib/additional-benefits")).resolveAdditionalBenefits(input);

    return NextResponse.json({
      benefit: benefits.percentageBenefit,
      firstPaymentBenefit: benefits.firstPaymentBenefit,
    });
  } catch (error) {
    console.error("Benefits query failed", error);
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }
}
