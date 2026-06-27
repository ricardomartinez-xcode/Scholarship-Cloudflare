import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import {
  getAcademicOfferVisibleCycles,
  saveAcademicOfferVisibleCycles,
} from "@/lib/academic-offer-config";
import {
  ACADEMIC_OFFER_CYCLES,
  normalizeAcademicOfferCycle,
} from "@/config/academicOffer";
import { PUBLIC_ROUTE_CACHE_TAGS } from "@/lib/public-route-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdminCapabilityUser(AdminCapability.manage_offers);
  const visibleCycles = await getAcademicOfferVisibleCycles();
  return NextResponse.json({
    ok: true,
    validCycles: ACADEMIC_OFFER_CYCLES,
    visibleCycles,
  });
}

export async function POST(request: Request) {
  const admin = await requireAdminCapabilityUser(AdminCapability.manage_offers);
  const body = (await request.json().catch(() => null)) as
    | { visibleCycles?: unknown }
    | null;

  const visibleCycles = Array.isArray(body?.visibleCycles)
    ? body.visibleCycles
        .map((value) => normalizeAcademicOfferCycle(value))
        .filter(
          (value): value is (typeof ACADEMIC_OFFER_CYCLES)[number] => Boolean(value),
        )
    : [];

  if (!visibleCycles.length) {
    return NextResponse.json(
      { ok: false, error: "Debes mantener al menos un ciclo visible." },
      { status: 400 },
    );
  }

  await saveAcademicOfferVisibleCycles(visibleCycles, admin.email);
  revalidateTag(PUBLIC_ROUTE_CACHE_TAGS.oferta, "max");

  return NextResponse.json({
    ok: true,
    validCycles: ACADEMIC_OFFER_CYCLES,
    visibleCycles,
  });
}
