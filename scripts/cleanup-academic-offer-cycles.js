#!/usr/bin/env node

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DAY_START = process.env.CLEANUP_DAY_START || "2026-05-31T00:00:00-06:00";
const DAY_END = process.env.CLEANUP_DAY_END || "2026-06-01T00:00:00-06:00";
const DRY_RUN = String(process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const CONFIRM_DELETE = process.env.CONFIRM_DELETE || "";
const REQUIRED_CONFIRMATION = "DELETE_STALE_ACADEMIC_OFFER";
const TARGET_CYCLES = ["C2", "C3"];
const DELETE_CHUNK_SIZE = 500;

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

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getPath(source, path) {
  let current = source;
  for (const part of path) {
    if (!current || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

function getCycleFromRecord(record) {
  const candidates = [
    getPath(record, ["summary", "cycle"]),
    getPath(record, ["result", "cycle"]),
    getPath(record, ["payload", "cycle"]),
    getPath(record, ["snapshot", "cycle"]),
    getPath(record, ["afterSnapshot", "cycle"]),
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim().toUpperCase();
    if (TARGET_CYCLES.includes(value)) return value;
  }

  const fileName = String(record.fileName || record.notes || "").toUpperCase();
  const match = fileName.match(/\bC[23]\b/);
  return match ? match[0] : null;
}

function keyFor(cycle, campusId, programKey) {
  return `${cycle}::${campusId}::${programKey}`;
}

function addKeepKeysFromParsedPayload(cycle, payload, keepKeys) {
  const parsed = asArray(getPath({ payload }, ["payload", "parsed"]));
  if (!cycle || parsed.length === 0) return 0;

  let added = 0;
  for (const campus of parsed) {
    const campusId = campus?.campusId;
    const rows = asArray(campus?.rows);
    if (!campusId) continue;

    for (const row of rows) {
      const programKey = row?.programNormalized || row?.programNameNormalized || normalizeKey(row?.programName);
      if (!programKey) continue;
      keepKeys.add(keyFor(cycle, campusId, programKey));
      added += 1;
    }
  }
  return added;
}

function addKeepKeysFromOfferSnapshot(cycle, snapshot, keepKeys) {
  const safeSnapshot = asObject(snapshot);
  if (!cycle || !safeSnapshot) return 0;

  const programs = asArray(safeSnapshot.programs);
  const offerings = asArray(safeSnapshot.offerings);
  const programKeyById = new Map();

  for (const program of programs) {
    const programKey = program?.nameNormalized || normalizeKey(program?.name);
    if (program?.id && programKey) programKeyById.set(program.id, programKey);
  }

  let added = 0;
  for (const offering of offerings) {
    if (String(offering?.cycle || "").toUpperCase() !== cycle) continue;
    const campusId = offering?.campusId;
    const programKey = programKeyById.get(offering?.programId);
    if (!campusId || !programKey) continue;
    keepKeys.add(keyFor(cycle, campusId, programKey));
    added += 1;
  }
  return added;
}

function buildKeepKeysFromSource(source) {
  const keepKeys = new Set();
  const cycle = source.cycle;

  const parsedCount = addKeepKeysFromParsedPayload(cycle, source.payload, keepKeys);
  const versionSnapshotCount = keepKeys.size === 0 ? addKeepKeysFromOfferSnapshot(cycle, source.snapshot, keepKeys) : 0;
  const afterSnapshotCount = keepKeys.size === 0 ? addKeepKeysFromOfferSnapshot(cycle, source.afterSnapshot, keepKeys) : 0;

  return {
    keepKeys,
    source:
      parsedCount > 0
        ? "payload.parsed"
        : versionSnapshotCount > 0
          ? "publishedVersion.snapshot"
          : afterSnapshotCount > 0
            ? "session.afterSnapshot"
            : "none",
  };
}

async function deleteByIds(model, ids) {
  let deleted = 0;
  for (let index = 0; index < ids.length; index += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + DELETE_CHUNK_SIZE);
    const result = await model.deleteMany({ where: { id: { in: chunk } } });
    deleted += result.count;
  }
  return deleted;
}

async function loadLatestPublishedSources(dayStart, dayEnd) {
  const versions = await prisma.adminConfigVersion.findMany({
    where: {
      module: "OFFER",
      publishedAt: { gte: dayStart, lt: dayEnd },
      importSessionId: { not: null },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      createdAt: true,
      publishedAt: true,
      notes: true,
      snapshot: true,
      summary: true,
      diffSummary: true,
      importSessionId: true,
    },
  });

  const sessionIds = Array.from(new Set(versions.map((version) => version.importSessionId).filter(Boolean)));
  const sessions = sessionIds.length
    ? await prisma.adminImportSession.findMany({
        where: { id: { in: sessionIds } },
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          updatedAt: true,
          appliedAt: true,
          payload: true,
          summary: true,
          result: true,
          afterSnapshot: true,
        },
      })
    : [];

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const latestByCycle = new Map();

  for (const version of versions) {
    const session = sessionById.get(version.importSessionId) || null;
    const cycle = getCycleFromRecord(session || version) || getCycleFromRecord(version);
    if (!TARGET_CYCLES.includes(cycle) || latestByCycle.has(cycle)) continue;
    latestByCycle.set(cycle, {
      kind: "publishedVersion",
      id: version.id,
      cycle,
      fileName: session?.fileName || null,
      createdAt: version.createdAt,
      appliedAt: session?.appliedAt || null,
      publishedAt: version.publishedAt,
      payload: session?.payload || null,
      afterSnapshot: session?.afterSnapshot || null,
      snapshot: version.snapshot,
      importSessionId: version.importSessionId,
    });
  }

  return { latestByCycle, versionsFound: versions.length };
}

async function loadLatestAppliedSessionSources(dayStart, dayEnd) {
  const sessions = await prisma.adminImportSession.findMany({
    where: {
      module: "OFFER",
      status: "applied",
      OR: [{ appliedAt: { gte: dayStart, lt: dayEnd } }, { createdAt: { gte: dayStart, lt: dayEnd } }],
    },
    orderBy: [{ appliedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      updatedAt: true,
      appliedAt: true,
      payload: true,
      summary: true,
      result: true,
      afterSnapshot: true,
    },
  });

  const latestByCycle = new Map();
  for (const session of sessions) {
    const cycle = getCycleFromRecord(session);
    if (!TARGET_CYCLES.includes(cycle) || latestByCycle.has(cycle)) continue;
    latestByCycle.set(cycle, {
      kind: "appliedSession",
      id: session.id,
      cycle,
      fileName: session.fileName,
      createdAt: session.createdAt,
      appliedAt: session.appliedAt,
      publishedAt: null,
      payload: session.payload,
      afterSnapshot: session.afterSnapshot,
      snapshot: null,
      importSessionId: session.id,
    });
  }

  return { latestByCycle, sessionsFound: sessions.length };
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
  if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime()) || dayStart >= dayEnd) {
    throw new Error(`Invalid cleanup day range: ${DAY_START}..${DAY_END}`);
  }

  const published = await loadLatestPublishedSources(dayStart, dayEnd);
  const applied = published.latestByCycle.size < TARGET_CYCLES.length ? await loadLatestAppliedSessionSources(dayStart, dayEnd) : null;
  const latestByCycle = new Map([...((applied?.latestByCycle || new Map()).entries()), ...published.latestByCycle.entries()]);

  const missingCycles = TARGET_CYCLES.filter((cycle) => !latestByCycle.has(cycle));
  if (missingCycles.length > 0) {
    throw new Error(
      `Expected latest published/applied C2 and C3 OFFER previews on ${DAY_START}..${DAY_END}. Missing: ${missingCycles.join(", ")}. Published versions found: ${published.versionsFound}. Applied sessions found: ${applied?.sessionsFound ?? "not checked"}.`,
    );
  }

  const keepKeys = new Set();
  const sourceReports = [];
  for (const cycle of TARGET_CYCLES) {
    const source = latestByCycle.get(cycle);
    const extracted = buildKeepKeysFromSource(source);
    if (extracted.keepKeys.size === 0) {
      throw new Error(`Could not derive keep set for ${cycle} from ${source.kind} ${source.id}.`);
    }
    for (const key of extracted.keepKeys) keepKeys.add(key);
    sourceReports.push({
      id: source.id,
      kind: source.kind,
      cycle,
      fileName: source.fileName,
      createdAt: source.createdAt.toISOString(),
      appliedAt: source.appliedAt ? source.appliedAt.toISOString() : null,
      publishedAt: source.publishedAt ? source.publishedAt.toISOString() : null,
      importSessionId: source.importSessionId,
      keepSource: extracted.source,
      keepKeys: extracted.keepKeys.size,
    });
  }

  const c1Count = await prisma.programOffering.count({ where: { cycle: "C1" } });
  const c2c3Offerings = await prisma.programOffering.findMany({
    where: { cycle: { in: TARGET_CYCLES } },
    select: { id: true, cycle: true, campusId: true, program: { select: { name: true, nameNormalized: true } } },
  });

  const staleC2C3Ids = c2c3Offerings
    .filter((offering) => {
      const programKey = offering.program?.nameNormalized || normalizeKey(offering.program?.name);
      return !keepKeys.has(keyFor(offering.cycle, offering.campusId, programKey));
    })
    .map((offering) => offering.id);

  const report = {
    dryRun: DRY_RUN,
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
    latestSourcesKept: sourceReports,
    keepKeys: keepKeys.size,
    current: { c1Offerings: c1Count, c2c3Offerings: c2c3Offerings.length },
    toDelete: { c1Offerings: c1Count, staleC2C3Offerings: staleC2C3Ids.length },
    deleted: { c1Offerings: 0, staleC2C3Offerings: 0 },
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
