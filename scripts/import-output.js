// Por seguridad: este importador NO actualiza AdminPriceOverride ni precios del calculador.
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { execSync } = require("node:child_process");
const ExcelJS = require("exceljs");
const { PrismaClient, CampusKind, ProgramOfferingDelivery } = require("@prisma/client");

const OUTPUT_BASE = (() => {
  if (process.env.OUTPUT_BASE) return process.env.OUTPUT_BASE;
  const candidates = [
    path.join(os.homedir(), "Desktop", "_output"),
    path.join(os.homedir(), "Desktop", "_output.zip"),
  ];
  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  if (!existing) return candidates[0];
  if (!existing.endsWith(".zip")) return existing;

  // Se encontró ZIP — extraer a directorio temporal
  const dest = path.join(os.tmpdir(), "recalc-output-" + randomUUID());
  fs.mkdirSync(dest, { recursive: true });
  if (process.platform === "win32") {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Force '${existing}' '${dest}'"`,
      { stdio: "inherit" }
    );
  } else {
    execSync(`unzip -o '${existing}' -d '${dest}'`, { stdio: "inherit" });
  }
  // Si la extracción produjo una subcarpeta _output, usarla
  const nested = path.join(dest, "_output");
  return fs.existsSync(nested) ? nested : dest;
})();
const OFFER_CYCLE = process.env.OFFER_CYCLE || "2026-2";

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

function normalizeKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[().,_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(input) {
  return normalizeKey(input).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function cleanCell(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function toBool(value) {
  const n = normalizeKey(value);
  return n === "true" || n === "verdadero" || n === "si" || n === "1" || n === "x";
}

function mapCategoryToLevel(category) {
  const n = normalizeKey(category);
  if (!n) return null;
  if (n.includes("prepa") || n.includes("bachillerato")) return "preparatoria";
  if (n.includes("maestr") || n.includes("doctor")) return "posgrado";
  if (n.includes("licenci")) return "licenciatura";
  return null;
}

function deriveLineOfBusiness(programName, category) {
  const n = normalizeKey(programName);
  const c = normalizeKey(category);
  if (n.includes("bachillerato") || c.includes("prepa")) return "prepa";
  if (
    n.includes("maestr") ||
    n.includes("doctor") ||
    c.includes("maestr") ||
    c.includes("posgrado")
  ) {
    return "posgrado";
  }
  if (
    n.includes("enfermer") ||
    n.includes("fisioter") ||
    n.includes("nutric") ||
    n.includes("medic") ||
    n.includes("odont")
  ) {
    return "salud";
  }
  if (n.includes("licenci")) return "licenciatura";
  return null;
}

async function readWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

function worksheetRows(worksheet) {
  if (!worksheet) return [];
  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = [];
    for (let index = 1; index <= worksheet.columnCount; index += 1) {
      values.push(cleanCell(row.getCell(index).text));
    }
    rows.push(values);
  });
  return rows;
}

function findFirstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function parseOnlineSheet(rows) {
  const offerings = [];

  function readColumn(col, startRow, endRow, level) {
    let emptyStreak = 0;
    for (let r = startRow; r <= endRow && r < rows.length; r += 1) {
      const name = cleanCell(rows[r][col]);
      if (!name) {
        emptyStreak += 1;
        if (emptyStreak >= 3) break;
        continue;
      }
      emptyStreak = 0;
      offerings.push({
        campusName: "Online",
        programName: name,
        delivery: "ONLINE",
        track: null,
        escolarizadoAvailable: false,
        ejecutivoAvailable: false,
        escolarizadoSchedule: null,
        ejecutivoSchedule: null,
        category: level === "LICENCIATURA" ? "Licenciaturas" : "Maestrias",
        lineOfBusiness: level === "LICENCIATURA" ? "licenciatura" : "posgrado",
      });
    }
  }

  readColumn(0, 1, 19, "LICENCIATURA");
  readColumn(3, 1, 19, "LICENCIATURA");
  readColumn(0, 22, 80, "POSGRADO");
  readColumn(3, 22, 80, "POSGRADO");

  const dedup = new Map();
  for (const row of offerings) {
    const key = normalizeKey(row.programName);
    if (!dedup.has(key)) dedup.set(key, row);
  }
  return Array.from(dedup.values());
}

function parseCampusSheet(rows, sheetName) {
  let headerIndex = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const b = normalizeKey(rows[i][1]);
    const c = normalizeKey(rows[i][2]);
    const d = normalizeKey(rows[i][3]);
    if (b === "oferta" && c.includes("escolar") && d.includes("ejecut")) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex < 0) return [];

  const offerings = [];
  let emptyStreak = 0;
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const programName = cleanCell(rows[i][1]);
    if (!programName) {
      emptyStreak += 1;
      if (emptyStreak >= 3) break;
      continue;
    }
    emptyStreak = 0;

    const track = cleanCell(rows[i][0]) || null;
    const escolarizadoAvailable = toBool(rows[i][2]);
    const ejecutivoAvailable = toBool(rows[i][3]);
    const escolarizadoSchedule = cleanCell(rows[i][7]) || null;
    const ejecutivoSchedule = cleanCell(rows[i][9]) || null;
    const lineOfBusiness = deriveLineOfBusiness(programName, null);

    offerings.push({
      campusName: cleanCell(sheetName),
      programName,
      delivery: "CAMPUS",
      track,
      escolarizadoAvailable,
      ejecutivoAvailable,
      escolarizadoSchedule,
      ejecutivoSchedule,
      category: null,
      lineOfBusiness,
    });
  }

  const dedup = new Map();
  for (const row of offerings) {
    const key = `${normalizeKey(row.campusName)}::${normalizeKey(row.programName)}`;
    if (!dedup.has(key)) dedup.set(key, row);
  }
  return Array.from(dedup.values());
}

async function parseProgramsCatalog(filePath) {
  const workbook = await readWorkbook(filePath);
  const rows = worksheetRows(workbook.getWorksheet("Programas"));
  const byProgram = new Map();
  for (let i = 1; i < rows.length; i += 1) {
    const category = cleanCell(rows[i][0]);
    const programName = cleanCell(rows[i][1]);
    if (!programName) continue;
    const driveFileId = cleanCell(rows[i][4]) || null;
    const driveLink = cleanCell(rows[i][5]) || null;
    const normalized = normalizeKey(programName);
    if (!normalized) continue;
    byProgram.set(normalized, {
      name: programName,
      category: category || null,
      planDriveFileId: driveFileId,
      planDriveLink: driveLink,
      planUrl: null,
      level: mapCategoryToLevel(category),
    });
  }
  return byProgram;
}

function buildCampusResolver(campusNames) {
  const byNormalized = new Map();
  for (const name of campusNames) {
    byNormalized.set(normalizeKey(name), name);
  }
  byNormalized.set("on line", "Online");
  byNormalized.set("online", "Online");
  byNormalized.set("cd obregon", "Obregon");
  byNormalized.set("ciudad obregon", "Obregon");
  byNormalized.set("cd del carmen", "Cd. Del Carmen");
  byNormalized.set("cd mante", "Cd. Mante");

  return (raw) => {
    const n = normalizeKey(raw);
    if (!n) return null;
    if (byNormalized.has(n)) return byNormalized.get(n);
    for (const [key, value] of byNormalized.entries()) {
      if (n.includes(key) || key.includes(n)) return value;
    }
    return null;
  };
}

async function parseDirectory(filePath, resolveCampusName) {
  const workbook = await readWorkbook(filePath);
  const rows = worksheetRows(workbook.getWorksheet("Directorio"));
  const contacts = [];
  const warnings = [];
  for (let i = 1; i < rows.length; i += 1) {
    const zone = cleanCell(rows[i][0]) || null;
    const plantel = cleanCell(rows[i][1]);
    const role = cleanCell(rows[i][2]) || null;
    const name = cleanCell(rows[i][3]) || null;
    const email = cleanCell(rows[i][4]) || null;
    const source = cleanCell(rows[i][5]) || null;
    if (!plantel) continue;
    const campusName = resolveCampusName(plantel);
    if (!campusName) {
      warnings.push(`Directorio sin campus reconocido: "${plantel}"`);
      continue;
    }
    contacts.push({
      campusName,
      zone,
      role,
      name,
      email,
      source,
    });
  }
  return { contacts, warnings };
}

function parseBulletins(bulletinsDir, publicDir, resolveCampusName) {
  const warnings = [];
  const bulletins = [];
  if (!fs.existsSync(bulletinsDir)) {
    return { bulletins, warnings: [`No existe carpeta de boletines: ${bulletinsDir}`] };
  }

  fs.mkdirSync(publicDir, { recursive: true });

  const entries = fs.readdirSync(bulletinsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".pdf")) continue;
    const sourceFile = path.join(bulletinsDir, entry.name);
    const normalizedFile = normalizeKey(entry.name.replace(/\.pdf$/i, ""));
    if (normalizedFile.includes("nivelatorio")) continue;
    let campusToken = normalizedFile
      .replace(/^boletin de cuotas\s*2026\s*2\s*/i, "")
      .trim();
    if (!campusToken) campusToken = normalizedFile;

    const campusName = resolveCampusName(campusToken);
    if (!campusName) {
      warnings.push(`Boletin sin campus reconocido: "${entry.name}"`);
      continue;
    }

    const safeName = `${slugify(entry.name.replace(/\.pdf$/i, ""))}.pdf`;
    const targetFile = path.join(publicDir, safeName);
    fs.copyFileSync(sourceFile, targetFile);

    bulletins.push({
      campusName,
      cycle: OFFER_CYCLE,
      fileName: entry.name,
      filePath: `/boletines/${safeName}`,
    });
  }
  return { bulletins, warnings };
}

async function main() {
  const url = resolveDatabaseUrl();
  if (!url) throw new Error("Missing DATABASE_URL. Set it in .env.local (see .env.local.example).");
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = url;

  const offerFile = findFirstExisting([
    path.join(OUTPUT_BASE, "bolets", "Oferta Académica.xlsx"),
    path.join(OUTPUT_BASE, "bolets", "Oferta Academica.xlsx"),
    path.join(OUTPUT_BASE, "boletines", "Oferta Académica.xlsx"),
    path.join(OUTPUT_BASE, "boletines", "Oferta Academica.xlsx"),
  ]);
  if (!offerFile) throw new Error("No se encontro Oferta Academica.xlsx en _output.");

  const directoryFile = path.join(OUTPUT_BASE, "directorio_general_drive.xlsx");
  const programsFile = path.join(OUTPUT_BASE, "programas_academicos_drive.xlsx");
  const bulletinsDir = path.join(OUTPUT_BASE, "boletines", "BOLETINES DE CUOTAS 2026-2");
  const publicBulletinsDir = path.join(process.cwd(), "public", "boletines");

  const offerWorkbook = await readWorkbook(offerFile);
  const sheetNames = offerWorkbook.worksheets.map((worksheet) => worksheet.name);
  const offerRows = [];
  for (const name of sheetNames) {
    const normalized = normalizeKey(name);
    if (normalized === "comparativo 22 vs 24") continue;
    const rows = worksheetRows(offerWorkbook.getWorksheet(name));
    if (normalized === "online") {
      offerRows.push(...parseOnlineSheet(rows));
    } else {
      offerRows.push(...parseCampusSheet(rows, name));
    }
  }

  if (!offerRows.length) {
    throw new Error("No se detectaron filas de oferta academica para importar.");
  }

  const uniqueCampusNames = Array.from(
    new Set(offerRows.map((r) => (normalizeKey(r.campusName) === "online" ? "Online" : r.campusName)))
  );
  if (!uniqueCampusNames.some((n) => normalizeKey(n) === "online")) {
    uniqueCampusNames.push("Online");
  }

  const resolveCampusName = buildCampusResolver(uniqueCampusNames);
  const programsByName = await parseProgramsCatalog(programsFile);
  const { contacts, warnings: directoryWarnings } = await parseDirectory(
    directoryFile,
    resolveCampusName
  );
  const { bulletins, warnings: bulletinWarnings } = parseBulletins(
    bulletinsDir,
    publicBulletinsDir,
    resolveCampusName
  );

  const warningLogs = [...directoryWarnings, ...bulletinWarnings];

  const prisma = new PrismaClient();
  try {
    const existingCampuses = await prisma.campus.findMany({
      select: { id: true, code: true, name: true, sortOrder: true, metaKey: true },
    });
    const existingByNormalized = new Map();
    for (const c of existingCampuses) {
      existingByNormalized.set(normalizeKey(c.name), c);
      existingByNormalized.set(normalizeKey(c.metaKey), c);
    }

    const sortedCampusNames = uniqueCampusNames
      .map((n) => (normalizeKey(n) === "online" ? "Online" : n))
      .sort((a, b) => {
        if (normalizeKey(a) === "online") return 1;
        if (normalizeKey(b) === "online") return -1;
        return a.localeCompare(b, "es");
      });

    const campusSeed = sortedCampusNames.map((name, index) => {
      const normalized = normalizeKey(name);
      const existing = existingByNormalized.get(normalized);
      const isOnline = normalized === "online";
      const slug = isOnline ? "online" : slugify(name);
      const code =
        existing?.code ||
        (isOnline
          ? "ONLINE"
          : `CAMPUS_${slug.replace(/-/g, "_").toUpperCase()}`);
      const metaKey = isOnline ? "ONLINE" : name;
      const sortOrder = existing?.sortOrder || (index + 1) * 10;
      return {
        name: isOnline ? "Online" : name,
        code,
        metaKey,
        slug,
        tier: null,
        kind: isOnline ? CampusKind.online : CampusKind.campus,
        sortOrder,
      };
    });

    const importedProgramMap = new Map();
    for (const row of offerRows) {
      const normalized = normalizeKey(row.programName);
      if (!normalized) continue;
      const catalog = programsByName.get(normalized) || null;
      if (!importedProgramMap.has(normalized)) {
        importedProgramMap.set(normalized, {
          name: row.programName,
          nameNormalized: normalized,
          level: catalog?.level || deriveLineOfBusiness(row.programName, catalog?.category) || null,
          category: catalog?.category || row.category || null,
          planDriveFileId: catalog?.planDriveFileId || null,
          planDriveLink: catalog?.planDriveLink || null,
          planUrl: catalog?.planUrl || null,
        });
      }
    }
    for (const [normalized, catalog] of programsByName.entries()) {
      if (importedProgramMap.has(normalized)) continue;
      importedProgramMap.set(normalized, {
        name: catalog.name || normalized,
        nameNormalized: normalized,
        level: catalog.level || null,
        category: catalog.category || null,
        planDriveFileId: catalog.planDriveFileId || null,
        planDriveLink: catalog.planDriveLink || null,
        planUrl: catalog.planUrl || null,
      });
    }

    const summary = await prisma.$transaction(async (tx) => {
      await tx.programOffering.deleteMany({});
      await tx.directoryContact.deleteMany({});
      await tx.bulletin.deleteMany({});
      await tx.program.deleteMany({});
      await tx.campus.updateMany({
        data: { isActive: false },
      });

      const campusByName = new Map();
      for (const campus of campusSeed) {
        const upserted = await tx.campus.upsert({
          where: { code: campus.code },
          update: {
            name: campus.name,
            metaKey: campus.metaKey,
            slug: campus.slug,
            tier: campus.tier,
            kind: campus.kind,
            isActive: true,
            sortOrder: campus.sortOrder,
          },
          create: {
            code: campus.code,
            metaKey: campus.metaKey,
            name: campus.name,
            slug: campus.slug,
            tier: campus.tier,
            kind: campus.kind,
            isActive: true,
            sortOrder: campus.sortOrder,
          },
        });
        campusByName.set(normalizeKey(campus.name), upserted.id);
        campusByName.set(normalizeKey(campus.metaKey), upserted.id);
      }

      const programByNormalized = new Map();
      for (const program of importedProgramMap.values()) {
        const created = await tx.program.create({
          data: {
            name: program.name,
            nameNormalized: program.nameNormalized,
            level: program.level,
            category: program.category,
            planDriveFileId: program.planDriveFileId,
            planDriveLink: program.planDriveLink,
            planUrl: program.planUrl,
          },
          select: { id: true, nameNormalized: true },
        });
        programByNormalized.set(created.nameNormalized, created.id);
      }

      const offeringRows = [];
      const offeringKeySet = new Set();
      const now = new Date();
      for (const row of offerRows) {
        const campusId = campusByName.get(normalizeKey(row.campusName));
        const programId = programByNormalized.get(normalizeKey(row.programName));
        if (!campusId || !programId) continue;
        const key = `${campusId}|${programId}|${OFFER_CYCLE}`;
        if (offeringKeySet.has(key)) continue;
        offeringKeySet.add(key);
        offeringRows.push({
          id: randomUUID(),
          campusId,
          programId,
          cycle: OFFER_CYCLE,
          track: row.track || null,
          delivery:
            row.delivery === "ONLINE"
              ? ProgramOfferingDelivery.ONLINE
              : ProgramOfferingDelivery.CAMPUS,
          escolarizado: Boolean(row.escolarizadoAvailable),
          ejecutivo: Boolean(row.ejecutivoAvailable),
          escolarizadoSchedule: row.escolarizadoSchedule || null,
          ejecutivoSchedule: row.ejecutivoSchedule || null,
          lineOfBusiness:
            row.lineOfBusiness ||
            deriveLineOfBusiness(row.programName, row.category) ||
            null,
          isActive: true,
          archivedAt: null,
          archivedReason: null,
          updatedBy: "import-output",
          createdAt: now,
          updatedAt: now,
        });
      }
      if (offeringRows.length) {
        await tx.programOffering.createMany({ data: offeringRows });
      }

      const contactRows = contacts
        .map((c) => ({
          id: randomUUID(),
          campusId: campusByName.get(normalizeKey(c.campusName)),
          zone: c.zone,
          role: c.role,
          name: c.name,
          email: c.email,
          source: c.source,
          createdAt: now,
          updatedAt: now,
        }))
        .filter((c) => Boolean(c.campusId));
      if (contactRows.length) {
        await tx.directoryContact.createMany({
          data: contactRows.map((c) => ({
            id: c.id,
            campusId: c.campusId,
            zone: c.zone,
            role: c.role,
            name: c.name,
            email: c.email,
            source: c.source,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          })),
        });
      }

      const bulletinRows = bulletins
        .map((b) => ({
          id: randomUUID(),
          campusId: campusByName.get(normalizeKey(b.campusName)),
          cycle: b.cycle,
          fileName: b.fileName,
          filePath: b.filePath,
          createdAt: now,
          updatedAt: now,
        }))
        .filter((b) => Boolean(b.campusId));
      if (bulletinRows.length) {
        await tx.bulletin.createMany({
          data: bulletinRows.map((b) => ({
            id: b.id,
            campusId: b.campusId,
            cycle: b.cycle,
            fileName: b.fileName,
            filePath: b.filePath,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
          })),
        });
      }

      const counts = {
        campus: await tx.campus.count({ where: { isActive: true } }),
        program: await tx.program.count(),
        offering: await tx.programOffering.count(),
        contact: await tx.directoryContact.count(),
        bulletin: await tx.bulletin.count(),
      };
      return counts;
    }, { timeout: 120000 });

    console.log("Import completed.");
    console.log(JSON.stringify(summary, null, 2));
    if (warningLogs.length) {
      console.log("Warnings:");
      for (const warning of warningLogs) console.log(`- ${warning}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
