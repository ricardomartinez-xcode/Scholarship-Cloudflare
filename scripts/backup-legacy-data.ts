import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import dotenv from "dotenv";

import { getSql } from "@/lib/neon";
import { prisma } from "@/lib/prisma";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir =
    process.argv[2] ||
    path.join(os.homedir(), "Scholarship-backups", `legacy-${timestamp}`);

  await fs.mkdir(outputDir, { recursive: true });
  const sql = getSql();

  const [rules, regresoMaterias, metas, directoryContacts] = await Promise.all([
    sql`select * from recalc_regla_beca order by id`,
    sql`select * from recalc_regreso_materias order by plantel, modalidad, materias_count`,
    sql`select * from recalc_meta order by id desc`,
    prisma.directoryContact.findMany({
      orderBy: [{ campus: { name: "asc" } }, { role: "asc" }, { name: "asc" }],
      include: {
        campus: { select: { id: true, code: true, metaKey: true, name: true, slug: true } },
        methods: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
  ]);

  await Promise.all([
    fs.writeFile(
      path.join(outputDir, "recalc_regla_beca.json"),
      JSON.stringify(rules, null, 2),
    ),
    fs.writeFile(
      path.join(outputDir, "recalc_regreso_materias.json"),
      JSON.stringify(regresoMaterias, null, 2),
    ),
    fs.writeFile(
      path.join(outputDir, "recalc_meta.json"),
      JSON.stringify(metas, null, 2),
    ),
    fs.writeFile(
      path.join(outputDir, "directory_contact.json"),
      JSON.stringify(directoryContacts, null, 2),
    ),
    fs.writeFile(
      path.join(outputDir, "manifest.json"),
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          outputDir,
          counts: {
            recalc_regla_beca: rules.length,
            recalc_regreso_materias: regresoMaterias.length,
            recalc_meta: metas.length,
            directory_contact: directoryContacts.length,
          },
        },
        null,
        2,
      ),
    ),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputDir,
        counts: {
          recalc_regla_beca: rules.length,
          recalc_regreso_materias: regresoMaterias.length,
          recalc_meta: metas.length,
          directory_contact: directoryContacts.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
