import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { AdminConfigModule, BenefitBusinessLine } from "@prisma/client";

import { getAcademicOfferVisibleCycles } from "@/lib/academic-offer-config";
import { getPublishedConfigSnapshot, type OfferDraftSnapshot } from "@/lib/admin-config-snapshots";
import { getSessionUser } from "@/lib/authz";
import {
  normalizeAcademicOfferCycle,
  type AcademicOfferCycle,
} from "@/config/academicOffer";
import { prisma } from "@/lib/prisma";
import {
  buildPublicRequestId,
  logPublicRouteTiming,
  normalizePublicCacheKeyPart,
  PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS,
  PUBLIC_ROUTE_CACHE_TAGS,
} from "@/lib/public-route-cache";
import { normalizeKey } from "@/lib/text-normalize";

export const dynamic = "force-dynamic";

const VALID_LINES = ["salud", "licenciatura", "prepa", "posgrado"] as const;

function getModalityLabel(offering: {
  delivery: "CAMPUS" | "ONLINE";
  escolarizado: boolean;
  ejecutivo: boolean;
}) {
  if (offering.delivery === "ONLINE") return "Online";
  if (offering.escolarizado && offering.ejecutivo) return "Escolarizado / Ejecutivo";
  if (offering.ejecutivo) return "Ejecutivo";
  if (offering.escolarizado) return "Escolarizado";
  return "Presencial";
}

type OfertaPayload = {
  availableCycles: string[];
  selectedCycle: string | null;
  programs: Array<{
    programId: string;
    name: string;
    category: string | null;
    businessLine: string | null;
    brochurePdfUrl: string | null;
    planPdfUrl: string | null;
  }>;
  offerings: Array<{
    id: string;
    modality: string;
    schedule: string | null;
    planLink: string | null;
    program: { id: string; name: string };
  }>;
};

type OfertaProgramPayload = OfertaPayload["programs"][number];
type OfertaOfferingPayload = OfertaPayload["offerings"][number];

function resolveRequestedCycle(
  cycleRaw: string,
  availableCycles: AcademicOfferCycle[],
): AcademicOfferCycle | null {
  const normalized = normalizeAcademicOfferCycle(cycleRaw);
  if (normalized) return normalized;
  if (cycleRaw) return null;
  return availableCycles[0] ?? null;
}

async function loadOfertaPayload(
  campusRaw: string,
  lineRaw: string,
  cycleRaw: string,
): Promise<OfertaPayload> {
  const published = await getPublishedConfigSnapshot(AdminConfigModule.OFFER);
  if (published) {
    const snapshot = published.snapshot as OfferDraftSnapshot;
    const availableCycles = (Array.isArray(snapshot.visibleCycles)
      ? snapshot.visibleCycles
      : await getAcademicOfferVisibleCycles()) satisfies AcademicOfferCycle[];
    const requestedCycle = resolveRequestedCycle(cycleRaw, availableCycles);
    if (!requestedCycle) {
      return { availableCycles, selectedCycle: null, programs: [], offerings: [] };
    }
    if (!availableCycles.includes(requestedCycle)) {
      return { availableCycles, selectedCycle: null, programs: [], offerings: [] };
    }
    const normalizedCampus = normalizeKey(campusRaw);
    const selectedCampus = campusRaw
      ? snapshot.campuses.find(
          (campus) =>
            normalizeKey(campus.code) === normalizedCampus ||
            normalizeKey(campus.metaKey) === normalizedCampus ||
            normalizeKey(campus.name) === normalizedCampus ||
            normalizeKey(campus.slug) === normalizedCampus,
        ) ?? null
      : null;

    if (campusRaw && !selectedCampus) {
      return { availableCycles, selectedCycle: requestedCycle, programs: [], offerings: [] };
    }

    const lineEnum = VALID_LINES.includes(lineRaw as (typeof VALID_LINES)[number])
      ? (lineRaw as BenefitBusinessLine)
      : null;

    const programMap = new Map(snapshot.programs.map((program) => [program.id, program]));
    const campusMap = new Map(snapshot.campuses.map((campus) => [campus.id, campus]));

    const filteredOfferings = snapshot.offerings.filter((offering) => {
      if (!offering.isActive) return false;
      if (offering.cycle !== requestedCycle) return false;
      if (selectedCampus && offering.campusId !== selectedCampus.id) return false;
      if (!lineRaw) return true;
      const program = programMap.get(offering.programId);
      if (!program) return false;
      return (
        (offering.lineOfBusiness ?? "").toLowerCase() === lineRaw.toLowerCase() ||
        (lineEnum !== null && program.businessLine === lineEnum) ||
        (program.level ?? "").toLowerCase() === lineRaw.toLowerCase() ||
        (program.category ?? "").toLowerCase().includes(lineRaw.toLowerCase())
      );
    });

    const seenPrograms = new Set<string>();
    const programs = filteredOfferings
      .map((offering) => {
        const program = programMap.get(offering.programId);
        if (!program || seenPrograms.has(program.id)) return null;
        seenPrograms.add(program.id);
        return {
          programId: program.id,
          name: program.name,
          category: program.category,
          businessLine: program.businessLine ? String(program.businessLine) : null,
          brochurePdfUrl: program.brochurePdfUrl,
          planPdfUrl:
            program.planPdfUrl ?? program.planDriveLink ?? program.planUrl ?? null,
        };
      })
      .filter((program): program is OfertaProgramPayload => Boolean(program))
      .sort((left, right) => left!.name.localeCompare(right!.name, "es"));

    const offerings = filteredOfferings
      .map((offering) => {
        const program = programMap.get(offering.programId);
        if (!program || !campusMap.has(offering.campusId)) return null;
        return {
          id: offering.id,
          modality: getModalityLabel(offering),
          schedule: offering.escolarizadoSchedule ?? offering.ejecutivoSchedule ?? null,
          planLink: program.planPdfUrl ?? program.planDriveLink ?? program.planUrl ?? null,
          program: { id: program.id, name: program.name },
        };
      })
      .filter((offering): offering is OfertaOfferingPayload => Boolean(offering));

    return { availableCycles, selectedCycle: requestedCycle, programs, offerings };
  }

  const availableCycles = await getAcademicOfferVisibleCycles();
  const requestedCycle = resolveRequestedCycle(cycleRaw, availableCycles);
  if (!requestedCycle) {
    return { availableCycles, selectedCycle: null, programs: [], offerings: [] };
  }
  if (!availableCycles.includes(requestedCycle)) {
    return { availableCycles, selectedCycle: null, programs: [], offerings: [] };
  }

  let campusId: string | null = null;
  if (campusRaw) {
    const campus = await prisma.campus.findFirst({
      where: {
        isActive: true,
        OR: [
          { code: { equals: campusRaw, mode: "insensitive" } },
          { metaKey: { equals: campusRaw, mode: "insensitive" } },
          { name: { equals: campusRaw, mode: "insensitive" } },
          { slug: { equals: campusRaw, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (campus) {
      campusId = campus.id;
    } else {
      const normalized = normalizeKey(campusRaw);
      const all = await prisma.campus.findMany({
        where: { isActive: true },
        select: { id: true, code: true, metaKey: true, name: true, slug: true },
      });
      const match = all.find(
        (item) =>
          normalizeKey(item.code) === normalized ||
          normalizeKey(item.metaKey) === normalized ||
          normalizeKey(item.name) === normalized ||
          normalizeKey(item.slug) === normalized,
      );
      if (match) campusId = match.id;
    }
  }

  const lineEnum = VALID_LINES.includes(lineRaw as (typeof VALID_LINES)[number])
    ? (lineRaw as BenefitBusinessLine)
    : null;

  const offeringWhere = {
    isActive: true,
    cycle: requestedCycle,
    ...(campusId ? { campusId } : {}),
    ...(lineRaw
      ? {
          OR: [
            { lineOfBusiness: { equals: lineRaw, mode: "insensitive" as const } },
            ...(lineEnum ? [{ program: { businessLine: lineEnum } }] : []),
            {
              program: {
                level: { equals: lineRaw, mode: "insensitive" as const },
              },
            },
            {
              program: {
                category: { contains: lineRaw, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };

  const offeringsRaw = await prisma.programOffering.findMany({
    where: offeringWhere,
    orderBy: [{ program: { name: "asc" } }],
    select: {
      id: true,
      programId: true,
      delivery: true,
      escolarizado: true,
      ejecutivo: true,
      escolarizadoSchedule: true,
      ejecutivoSchedule: true,
      program: {
        select: {
          id: true,
          name: true,
          category: true,
          businessLine: true,
          brochurePdfUrl: true,
          planPdfUrl: true,
          planDriveLink: true,
          planUrl: true,
        },
      },
    },
  });

  const seen = new Set<string>();
  const programs: Array<{
    programId: string;
    name: string;
    category: string | null;
    businessLine: string | null;
    brochurePdfUrl: string | null;
    planPdfUrl: string | null;
  }> = [];

  for (const offering of offeringsRaw) {
    if (seen.has(offering.programId)) continue;
    seen.add(offering.programId);
    programs.push({
      programId: offering.program.id,
      name: offering.program.name,
      category: offering.program.category,
      businessLine: offering.program.businessLine,
      brochurePdfUrl: offering.program.brochurePdfUrl ?? null,
      planPdfUrl:
        offering.program.planPdfUrl ??
        offering.program.planDriveLink ??
        offering.program.planUrl ??
        null,
    });
  }

  programs.sort((left, right) => left.name.localeCompare(right.name, "es"));

  const offerings = offeringsRaw.map((offering) => ({
    id: offering.id,
    modality: getModalityLabel(offering),
    schedule: offering.escolarizadoSchedule ?? offering.ejecutivoSchedule ?? null,
    planLink:
      offering.program.planPdfUrl ??
      offering.program.planDriveLink ??
      offering.program.planUrl ??
      null,
    program: { id: offering.program.id, name: offering.program.name },
  }));

  return { availableCycles, selectedCycle: requestedCycle, programs, offerings };
}

function getCachedOfertaPayload(campusRaw: string, lineRaw: string, cycleRaw: string) {
  return unstable_cache(
    () => loadOfertaPayload(campusRaw, lineRaw, cycleRaw),
    [
      "public-oferta",
      normalizePublicCacheKeyPart(campusRaw),
      normalizePublicCacheKeyPart(lineRaw),
      normalizePublicCacheKeyPart(cycleRaw),
    ],
    {
      revalidate: PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS,
      tags: [PUBLIC_ROUTE_CACHE_TAGS.oferta],
    },
  )();
}

export async function GET(request: Request) {
  const requestId = buildPublicRequestId("/api/public/oferta");
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const campusRaw = (searchParams.get("campus") ?? "").trim();
  const lineRaw = (searchParams.get("line") ?? "").trim();
  const cycleRaw = (searchParams.get("cycle") ?? "").trim();

  let statusCode = 200;
  let actorUserId: string | null = null;
  let actorEmail: string | null = null;

  try {
    const auth = await getSessionUser();
    if (auth.status === "unauthenticated") {
      statusCode = 401;
      return NextResponse.json({ error: "unauthenticated" }, { status: statusCode });
    }
    if (auth.status === "forbidden") {
      statusCode = 403;
      return NextResponse.json({ error: "forbidden" }, { status: statusCode });
    }

    actorUserId = auth.user.id;
    actorEmail = auth.email;

    const payload = await getCachedOfertaPayload(campusRaw, lineRaw, cycleRaw);
    return NextResponse.json(payload);
  } catch (error) {
    statusCode = 500;
    throw error;
  } finally {
    logPublicRouteTiming({
      route: "/api/public/oferta",
      requestId,
      startedAt,
      statusCode,
      actorUserId,
      actorEmail,
      metadata: {
        campus: campusRaw || null,
        line: lineRaw || null,
        cycle: cycleRaw || null,
      },
    });
  }
}
