#!/usr/bin/env node

/**
 * Cleans stale academic-offer data in Neon/Prisma.
 *
 * Default behavior is dry-run. To actually delete records, run with:
 *   DRY_RUN=false CONFIRM_DELETE=DELETE_STALE_ACADEMIC_OFFER node scripts/cleanup-academic-offer-cycles.js
 *
 * The script removes:
 *   1. All program offerings from C1.
 *   2. C2/C3 program offerings that are not present in the latest applied C2/C3
 *      academic-offer imports from May 31, 2026 Mexico City day.
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DAY_START = process.env.CLEANUP_DAY_START || "2026-05-31T00:00:00-06:00";
const DAY_END = process.env.CLEANUP_DAY_END || "2026-06-01T00:00:00-06:00";
const KEEP_LATEST_IMPORTS = Number(process.env.KEEP_LATEST_IMPORTS || "2");
const DRY_RUN = String(process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const CONFIRM_DELETE = process.env.CONFIRM_DELETE || "";
const REQUIRED_CONFIRMATION = "DELETE_STALE_ACADEMIC_OFFER";

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[().,_/\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSessionCycle(session) {
  return (
    session.summary?.cycle ||
    session.result?.cycle ||
    session.payload?.cycle ||
    null
  );
}

function getKeepKeysFromSession(session) {
  const cycle = getSessionCycle(session);
  const keepKeys = new Set();
  const parsed = Array.isArray(session.payload?.parsed) ? session.payload.parsed : [];

  for (const campus of parsed) {
    const campusId = campus?.campusId;
    const rows = Array.isArray(campus?.rows) ? campus.rows : [];
    if (!cycle || !campusId) continue;

    for (const row of rows) {
      const programKey = row?.programNormalized || normalizeKey(row?.programName);
      if (!programKey) continue;
      keepKeys.add(`${cycle}::${campusId}::${programKey}`);
    }
  }

  return keepKeys;
}

async function deleteByIds(model, ids) {
  const chunkSize = 500;
  let deleted = 0;

  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const result = await model.deleteMany({ where: { id: { in: chunk } } });
    deleted += result.count;
  }

  return deleted;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL. Configure the Neon connection string as a GitHub Actions secret.");
  }

  if (!DRY_RUN && CONFIRM_DELETE !== REQUIRED_CONFIRMATION) {
    throw new Error(`Refusing destructive cleanup. Set CONFIRM_DELETE=${REQUIRED_CONFIRMATION}.`);
  }

  const dayStart = new Date(DAY_START);
  const dayEnd = new Date(DAY_END);

  const appliedOfferSessions = await prisma.adminImportSession.findMany({
    where: {
      module: "OFFER",
      status: "applied",
      createdAt: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
    orderBy: [{ appliedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      createdAt: true,
      appliedAt: true,
      payload: true,
      summary: true,
      result: true,
    },
  });

  const latestC2C3Sessions = appliedOfferSessions
    .filter((session) => ["C2", "C3"].includes(getSessionCycle(session)))
    .slice(0, KEEP_LATEST_IMPORTS);

  const cyclesKept = new Set(latestC2C3Sessions.map((session) => getSessionCycle(session)));
  if (latestC2C3Sessions.length < KEEP_LATEST_IMPORTS || !cyclesKept.has("C2") || !cyclesKept.has("C3")) {
    throw new Error(
      `Expected latest applied C2 and C3 imports on ${DAY_START}..${DAY_END}. Found: ${latestC2C3Sessions
        .map((session) => `${session.id}:${getSessionCycle(session)}`)
        .join(", ") || "none"}`,
    );
  }

  const keepKeys = new Set();
  for (const session of latestC2C3Sessions) {
    for (const key of getKeepKeysFromSession(session)) keepKeys.add(key);
  }

  if (keepKeys.size === 0) {
    throw new Error("Latest C2/C3 imports did not contain payload.parsed rows. Cleanup aborted.");
  }

  const c1Count = await prisma.programOffering.count({ where: { cycle: "C1" } });

  const c2c3Offerings = await prisma.programOffering.findMany({
    where: { cycle: { in: ["C2", "C3"] } },
    select: {
      id: true,
      cycle: true,
      campusId: true,
      program: { select: { nameNormalized: true, name: true } },
    },
  });

  const staleC2C3Ids = c2c3Offerings
    .filter((offering) => {
      const programKey = offering.program?.nameNormalized || normalizeKey(offering.program?.name);
      return !keepKeys.has(`${offering.cycle}::${offering.campusId}::${programKey}`);
    })
    .map((offering) => offering.id);

  const report = {
    dryRun: DRY_RUN,
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
    latestC2C3Sessions: latestC2C3Sessions.map((session) => ({
      id: session.id,
      cycle: getSessionCycle(session),
      createdAt: session.createdAt,
      appliedAt: session.appliedAt,
    })),
    keepKeys: keepKeys.size,
    toDelete: {
      c1Offerings: c1Count,
      staleC2C3Offerings: staleC2C3Ids.length,
    },
    deleted: {
      c1Offerings: 0,
      staleC2C3Offerings: 0,
    },
  };

  if (!DRY_RUN) {
    await prisma.$transaction(async (tx) => {
      const c1Deleted = await tx.programOffering.deleteMany({ where: { cycle: "C1" } });
      report.deleted.c1Offerings = c1Deleted.count;
      report.deleted.staleC2C3Offerings = await deleteByIds(tx.programOffering, staleC2C3Ids);
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
