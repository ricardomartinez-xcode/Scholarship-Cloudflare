import { ProgramAssetStatus, ProgramAssetType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const DEFAULT_TIMEOUT_MS = 8000;

type ProgramAssetTarget = {
  assetType: ProgramAssetType;
  url: string;
};

type AssetCheckResult = {
  assetType: ProgramAssetType;
  url: string;
  status: ProgramAssetStatus;
  httpStatus: number | null;
  contentType: string | null;
  error: string | null;
};

type ProgramWithAssets = {
  id: string;
  name: string;
  planPdfUrl: string | null;
  brochurePdfUrl: string | null;
  planUrl: string | null;
  planDriveLink: string | null;
};

function buildProgramAssetTargets(program: ProgramWithAssets): ProgramAssetTarget[] {
  const candidates: Array<[ProgramAssetType, string | null]> = [
    [ProgramAssetType.PLAN_PDF, program.planPdfUrl],
    [ProgramAssetType.BROCHURE_PDF, program.brochurePdfUrl],
    [ProgramAssetType.PLAN_URL, program.planUrl],
    [ProgramAssetType.PLAN_DRIVE_LINK, program.planDriveLink],
  ];

  return candidates.flatMap(([assetType, url]) => {
    const normalized = String(url ?? "").trim();
    return normalized ? [{ assetType, url: normalized }] : [];
  });
}

async function fetchAsset(url: string, method: "HEAD" | "GET", timeoutMs: number) {
  return fetch(url, {
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
    cache: "no-store",
  });
}

async function checkAssetTarget(
  target: ProgramAssetTarget,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<AssetCheckResult> {
  try {
    let response = await fetchAsset(target.url, "HEAD", timeoutMs);
    if (response.status === 405) {
      response = await fetchAsset(target.url, "GET", timeoutMs);
    }

    const contentType = response.headers.get("content-type");
    if (response.ok) {
      return {
        assetType: target.assetType,
        url: target.url,
        status: ProgramAssetStatus.healthy,
        httpStatus: response.status,
        contentType,
        error: null,
      };
    }

    const status =
      response.status === 401 || response.status === 403
        ? ProgramAssetStatus.unauthorized
        : ProgramAssetStatus.broken;
    return {
      assetType: target.assetType,
      url: target.url,
      status,
      httpStatus: response.status,
      contentType,
      error: `HTTP ${response.status}`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Asset check failed.";
    const status =
      error instanceof Error && error.name === "TimeoutError"
        ? ProgramAssetStatus.timeout
        : ProgramAssetStatus.broken;
    return {
      assetType: target.assetType,
      url: target.url,
      status,
      httpStatus: null,
      contentType: null,
      error: message,
    };
  }
}

export async function runProgramAssetHealthCheck() {
  const programs = await prisma.program.findMany({
    where: {
      OR: [
        { planPdfUrl: { not: null } },
        { brochurePdfUrl: { not: null } },
        { planUrl: { not: null } },
        { planDriveLink: { not: null } },
      ],
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      planPdfUrl: true,
      brochurePdfUrl: true,
      planUrl: true,
      planDriveLink: true,
    },
  });

  let healthy = 0;
  let broken = 0;
  let timeout = 0;
  let unauthorized = 0;
  let skipped = 0;
  const brokenAssets: Array<{
    programId: string;
    programName: string;
    assetType: ProgramAssetType;
    url: string;
    status: ProgramAssetStatus;
    error: string | null;
  }> = [];

  for (const program of programs) {
    const targets = buildProgramAssetTargets(program);
    const activeTypes = targets.map((target) => target.assetType);

    if (!targets.length) {
      skipped += 1;
      continue;
    }

    const results = await Promise.all(targets.map((target) => checkAssetTarget(target)));

    for (const result of results) {
      if (result.status === ProgramAssetStatus.healthy) healthy += 1;
      if (result.status === ProgramAssetStatus.broken) broken += 1;
      if (result.status === ProgramAssetStatus.timeout) timeout += 1;
      if (result.status === ProgramAssetStatus.unauthorized) unauthorized += 1;
      if (result.status === ProgramAssetStatus.skipped) skipped += 1;

      if (result.status !== ProgramAssetStatus.healthy) {
        brokenAssets.push({
          programId: program.id,
          programName: program.name,
          assetType: result.assetType,
          url: result.url,
          status: result.status,
          error: result.error,
        });
      }

      await prisma.programAssetCheck.upsert({
        where: {
          programId_assetType: {
            programId: program.id,
            assetType: result.assetType,
          },
        },
        update: {
          url: result.url,
          status: result.status,
          httpStatus: result.httpStatus,
          contentType: result.contentType,
          error: result.error,
          checkedAt: new Date(),
        },
        create: {
          programId: program.id,
          assetType: result.assetType,
          url: result.url,
          status: result.status,
          httpStatus: result.httpStatus,
          contentType: result.contentType,
          error: result.error,
          checkedAt: new Date(),
        },
      });
    }

    if (activeTypes.length) {
      await prisma.programAssetCheck.deleteMany({
        where: {
          programId: program.id,
          assetType: { notIn: activeTypes },
        },
      });
    }
  }

  return {
    ok: broken === 0 && timeout === 0 && unauthorized === 0,
    checkedAt: new Date().toISOString(),
    programsChecked: programs.length,
    assetsChecked: healthy + broken + timeout + unauthorized + skipped,
    counts: { healthy, broken, timeout, unauthorized, skipped },
    brokenAssets: brokenAssets.slice(0, 40),
  };
}

export async function getProgramAssetHealthSummary() {
  const [brokenChecks, aggregates, latestCheck] = await Promise.all([
    prisma.programAssetCheck.findMany({
      where: {
        status: {
          in: [
            ProgramAssetStatus.broken,
            ProgramAssetStatus.timeout,
            ProgramAssetStatus.unauthorized,
          ],
        },
      },
      orderBy: [{ checkedAt: "desc" }],
      take: 20,
      select: {
        id: true,
        assetType: true,
        url: true,
        status: true,
        httpStatus: true,
        error: true,
        checkedAt: true,
        program: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.programAssetCheck.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.programAssetCheck.findFirst({
      orderBy: [{ checkedAt: "desc" }],
      select: { checkedAt: true },
    }),
  ]);

  const counts = {
    healthy: 0,
    broken: 0,
    timeout: 0,
    unauthorized: 0,
    skipped: 0,
  };

  for (const aggregate of aggregates) {
    counts[aggregate.status] = aggregate._count._all;
  }

  return {
    counts,
    lastCheckedAt: latestCheck?.checkedAt.toISOString() ?? null,
    brokenChecks: brokenChecks.map((check) => ({
      id: check.id,
      programId: check.program.id,
      programName: check.program.name,
      assetType: check.assetType,
      url: check.url,
      status: check.status,
      httpStatus: check.httpStatus,
      error: check.error,
      checkedAt: check.checkedAt.toISOString(),
    })),
  };
}
