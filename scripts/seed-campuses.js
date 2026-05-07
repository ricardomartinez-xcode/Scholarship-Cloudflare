// Idempotent seed for canonical campus catalog:
// - 24 campus (presenciales) + 1 online ("Online")
//
// Source of truth lives here (codes are stable, metaKey matches legacy keys used by reglas/meta).
// Can be safely executed multiple times:
//   npm run campus:seed

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const CANONICAL = [
  { code: "CAMPUS_AGUA_PRIETA", metaKey: "Agua Prieta", name: "Agua Prieta", kind: "campus", sortOrder: 10 },
  { code: "CAMPUS_AGUASCALIENTES", metaKey: "Aguascalientes", name: "Aguascalientes", kind: "campus", sortOrder: 20 },
  { code: "CAMPUS_ALTAMIRA", metaKey: "Altamira", name: "Altamira", kind: "campus", sortOrder: 30 },
  { code: "CAMPUS_CANANEA", metaKey: "Cananea", name: "Cananea", kind: "campus", sortOrder: 40 },
  { code: "CAMPUS_CD_DEL_CARMEN", metaKey: "Cd. Del Carmen", name: "Cd. Del Carmen", kind: "campus", sortOrder: 50 },
  { code: "CAMPUS_CD_MANTE", metaKey: "Cd. Mante", name: "Cd. Mante", kind: "campus", sortOrder: 60 },
  { code: "CAMPUS_CHIHUAHUA", metaKey: "Chihuahua", name: "Chihuahua", kind: "campus", sortOrder: 70 },
  { code: "CAMPUS_CULIACAN", metaKey: "Culiacán", name: "Culiacán", kind: "campus", sortOrder: 80 },
  { code: "CAMPUS_ENSENADA", metaKey: "Ensenada", name: "Ensenada", kind: "campus", sortOrder: 90 },
  { code: "CAMPUS_HERMOSILLO", metaKey: "Hermosillo", name: "Hermosillo", kind: "campus", sortOrder: 100 },
  { code: "CAMPUS_LA_PAZ", metaKey: "La Paz", name: "La Paz", kind: "campus", sortOrder: 110 },
  { code: "CAMPUS_LOS_CABOS", metaKey: "Los Cabos", name: "Los Cabos", kind: "campus", sortOrder: 120 },
  { code: "CAMPUS_MEXICALI", metaKey: "Mexicali", name: "Mexicali", kind: "campus", sortOrder: 130 },
  { code: "CAMPUS_NOGALES", metaKey: "Nogales", name: "Nogales", kind: "campus", sortOrder: 140 },
  { code: "CAMPUS_OBREGON", metaKey: "Obregon", name: "Obregon", kind: "campus", sortOrder: 150 },
  { code: "CAMPUS_PUERTO_PENASCO", metaKey: "Puerto Peñasco", name: "Puerto Peñasco", kind: "campus", sortOrder: 160 },
  { code: "CAMPUS_QUERETARO", metaKey: "Querétaro", name: "Querétaro", kind: "campus", sortOrder: 170 },
  { code: "CAMPUS_SALTILLO", metaKey: "Saltillo", name: "Saltillo", kind: "campus", sortOrder: 180 },
  { code: "CAMPUS_TEOCALTICHE", metaKey: "Teocaltiche", name: "Teocaltiche", kind: "campus", sortOrder: 190 },
  { code: "CAMPUS_TIJUANA", metaKey: "Tijuana", name: "Tijuana", kind: "campus", sortOrder: 200 },
  { code: "CAMPUS_TORREON", metaKey: "Torreon", name: "Torreon", kind: "campus", sortOrder: 210 },
  { code: "CAMPUS_TUXPAN", metaKey: "Tuxpan", name: "Tuxpan", kind: "campus", sortOrder: 220 },
  { code: "CAMPUS_VERACRUZ", metaKey: "Veracruz", name: "Veracruz", kind: "campus", sortOrder: 230 },
  { code: "CAMPUS_ZACATECAS", metaKey: "Zacatecas", name: "Zacatecas", kind: "campus", sortOrder: 240 },
  { code: "ONLINE", metaKey: "ONLINE", name: "Online", kind: "online", sortOrder: 1000 },
];

function normalizeKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DIRECT_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    null
  );
}

async function main() {
  const url = resolveDatabaseUrl();
  if (!url) throw new Error("Missing DATABASE_URL. Set it in .env.local (see .env.local.example).");
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = url;

  if (CANONICAL.length !== 25) {
    throw new Error(`Canonical list must be 25 items. Got ${CANONICAL.length}.`);
  }
  const onlineCount = CANONICAL.filter((c) => c.kind === "online").length;
  if (onlineCount !== 1) throw new Error(`Canonical list must have exactly 1 online. Got ${onlineCount}.`);

  const prisma = new PrismaClient();
  try {
    for (const c of CANONICAL) {
      await prisma.campus.upsert({
        where: { code: c.code },
        update: {
          metaKey: c.metaKey,
          name: c.name,
          slug: c.kind === "online" ? "online" : normalizeKey(c.name),
          tier: null,
          kind: c.kind,
          isActive: true,
          sortOrder: c.sortOrder,
        },
        create: {
          code: c.code,
          metaKey: c.metaKey,
          name: c.name,
          slug: c.kind === "online" ? "online" : normalizeKey(c.name),
          tier: null,
          kind: c.kind,
          isActive: true,
          sortOrder: c.sortOrder,
        },
      });
    }

    const active = await prisma.campus.count({ where: { isActive: true } });
    const activeCampus = await prisma.campus.count({ where: { isActive: true, kind: "campus" } });
    const activeOnline = await prisma.campus.count({ where: { isActive: true, kind: "online" } });

    if (activeCampus !== 24 || activeOnline !== 1) {
      throw new Error(
        `Catalog mismatch. Active campus=${activeCampus} active online=${activeOnline} (expected 24/1).`
      );
    }
    if (active < 25) {
      throw new Error(`Catalog incomplete. Active=${active} (expected at least 25).`);
    }

    console.log("Campus seed OK:", { active, activeCampus, activeOnline });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
