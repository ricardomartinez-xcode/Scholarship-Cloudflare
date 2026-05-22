import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { AdminConfigModule } from "@prisma/client";

import { getPublishedConfigSnapshot, type DirectoryDraftSnapshot } from "@/lib/admin-config-snapshots";
import { getSessionUser } from "@/lib/authz";
import { projectDirectoryContact } from "@/lib/directory-projection";
import { prisma } from "@/lib/prisma";
import {
  buildPublicRequestId,
  logPublicRouteTiming,
  normalizePublicCacheKeyPart,
  PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS,
  PUBLIC_ROUTE_CACHE_TAGS,
} from "@/lib/public-route-cache";
import {
  createComparisonSummary,
  logComparisonReport,
  type ComparisonMismatch,
} from "@/lib/runtime-comparison";
import { getDirectoryReadMode } from "@/lib/runtime-modes";

export const dynamic = "force-dynamic";

function compareDirectoryContacts(
  legacy: Array<ReturnType<typeof projectDirectoryContact>>,
  canonical: Array<ReturnType<typeof projectDirectoryContact>>,
) {
  const mismatches: ComparisonMismatch[] = [];
  const canonicalMap = new Map(canonical.map((contact) => [contact.id, contact]));

  for (const legacyContact of legacy) {
    const canonicalContact = canonicalMap.get(legacyContact.id);
    if (!canonicalContact) {
      mismatches.push({
        key: legacyContact.id,
        field: "row",
        legacy: legacyContact,
        canonical: null,
        note: "missing_in_canonical",
      });
      continue;
    }

    const legacyMethods = legacyContact.methods.map((method) => method.value).join("|");
    const canonicalMethods = canonicalContact.methods.map((method) => method.value).join("|");

    if (legacyContact.contact !== canonicalContact.contact) {
      mismatches.push({
        key: legacyContact.id,
        field: "contact",
        legacy: legacyContact.contact,
        canonical: canonicalContact.contact,
      });
    }
    if (legacyMethods !== canonicalMethods) {
      mismatches.push({
        key: legacyContact.id,
        field: "methods",
        legacy: legacyMethods,
        canonical: canonicalMethods,
      });
    }
  }

  return mismatches;
}

async function loadDirectorioPayload(
  campusRaw: string,
  zoneRaw: string,
  roleRaw: string,
) {
  let campusId: string | null = null;
  if (campusRaw) {
    const campus = await prisma.campus.findFirst({
      where: {
        OR: [
          { code: { equals: campusRaw, mode: "insensitive" } },
          { metaKey: { equals: campusRaw, mode: "insensitive" } },
          { name: { equals: campusRaw, mode: "insensitive" } },
          { slug: { equals: campusRaw, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    campusId = campus?.id ?? null;
  }
  if (campusRaw && !campusId) {
    return { contacts: [] };
  }

  const published = await getPublishedConfigSnapshot(AdminConfigModule.DIRECTORY);
  if (published) {
    const campuses = await prisma.campus.findMany({
      where: campusId ? { id: campusId } : undefined,
      select: { id: true, code: true, metaKey: true, name: true, slug: true },
    });
    const campusMap = new Map(campuses.map((campus) => [campus.id, campus]));
    const contacts = (published.snapshot as DirectoryDraftSnapshot).contacts.filter(
      (contact) =>
        (!campusId || contact.campusId === campusId) &&
        (!zoneRaw || (contact.zone ?? "").toLowerCase().includes(zoneRaw.toLowerCase())) &&
        (!roleRaw || (contact.role ?? "").toLowerCase().includes(roleRaw.toLowerCase())) &&
        campusMap.has(contact.campusId),
    );

    const canonical = contacts.map((contact) =>
      projectDirectoryContact({
        ...contact,
        campus: campusMap.get(contact.campusId)!,
      }),
    );
    const legacy = contacts.map((contact) =>
      projectDirectoryContact({
        ...contact,
        methods: [],
        campus: campusMap.get(contact.campusId)!,
      }),
    );

    const directoryReadMode = getDirectoryReadMode();
    if (directoryReadMode === "compare") {
      const mismatches = compareDirectoryContacts(legacy, canonical);
      logComparisonReport({
        channel: "public-directorio",
        mode: "compare",
        summary: createComparisonSummary({
          read: legacy.length,
          conflicted: mismatches.length,
        }),
        mismatches,
      });
    }

    const projected = directoryReadMode === "canonical" ? canonical : legacy;
    return { contacts: projected };
  }

  const contacts = await prisma.directoryContact.findMany({
    where: {
      ...(campusId ? { campusId } : {}),
      ...(zoneRaw ? { zone: { contains: zoneRaw, mode: "insensitive" } } : {}),
      ...(roleRaw ? { role: { contains: roleRaw, mode: "insensitive" } } : {}),
    },
    orderBy: [{ campus: { name: "asc" } }, { role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      zone: true,
      role: true,
      name: true,
      email: true,
      phone: true,
      source: true,
      methods: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          type: true,
          value: true,
          normalizedValue: true,
          isPrimary: true,
          sortOrder: true,
        },
      },
      campus: {
        select: { id: true, code: true, metaKey: true, name: true, slug: true },
      },
    },
  });

  const canonical = contacts.map((contact) => projectDirectoryContact(contact));
  const legacy = contacts.map((contact) =>
    projectDirectoryContact({
      ...contact,
      methods: [],
    }),
  );

  const directoryReadMode = getDirectoryReadMode();
  if (directoryReadMode === "compare") {
    const mismatches = compareDirectoryContacts(legacy, canonical);
    logComparisonReport({
      channel: "public-directorio",
      mode: "compare",
      summary: createComparisonSummary({
        read: legacy.length,
        conflicted: mismatches.length,
      }),
      mismatches,
    });
  }

  const projected = directoryReadMode === "canonical" ? canonical : legacy;
  return { contacts: projected };
}

function getCachedDirectorioPayload(
  campusRaw: string,
  zoneRaw: string,
  roleRaw: string,
) {
  return unstable_cache(
    () => loadDirectorioPayload(campusRaw, zoneRaw, roleRaw),
    [
      "public-directorio",
      normalizePublicCacheKeyPart(campusRaw),
      normalizePublicCacheKeyPart(zoneRaw),
      normalizePublicCacheKeyPart(roleRaw),
    ],
    {
      revalidate: PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS,
      tags: [PUBLIC_ROUTE_CACHE_TAGS.directorio],
    },
  )();
}

export async function GET(request: Request) {
  const requestId = buildPublicRequestId("/api/public/directorio");
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const campusRaw = (searchParams.get("campus") ?? "").trim();
  const zoneRaw = (searchParams.get("zone") ?? "").trim();
  const roleRaw = (searchParams.get("role") ?? "").trim();

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

    const payload = await getCachedDirectorioPayload(campusRaw, zoneRaw, roleRaw);
    return NextResponse.json(payload);
  } catch (error) {
    statusCode = 500;
    throw error;
  } finally {
    logPublicRouteTiming({
      route: "/api/public/directorio",
      requestId,
      startedAt,
      statusCode,
      actorUserId,
      actorEmail,
      metadata: {
        campus: campusRaw || null,
        zone: zoneRaw || null,
        role: roleRaw || null,
      },
    });
  }
}
