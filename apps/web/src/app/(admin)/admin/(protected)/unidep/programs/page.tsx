import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { listFileAssetAssignmentsForTargets, listFileAssets } from "@/lib/file-assets";
import { getUnidepProgramCatalog } from "@/lib/unidep-program-catalog";
import ProgramsClient from "./ProgramsClient";
import MigrateClient from "../MigrateClient";

export const dynamic = "force-dynamic";

async function loadPrograms() {
  try {
    return await getUnidepProgramCatalog();
  } catch {
    return null;
  }
}

export default async function UnidepProgramsPage() {
  await requireAdminCapabilityUser(AdminCapability.manage_offers);
  const programs = await loadPrograms();
  if (!programs) {
    return <NeedsMigration title="Programas UNIDEP" />;
  }
  const [files, assignments] = await Promise.all([
    listFileAssets({ limit: 500 }),
    listFileAssetAssignmentsForTargets(
      "program",
      programs.map((program) => program.id),
    ),
  ]);
  const programsWithAssets = programs.map((program) => ({
    ...program,
    r2Assets: assignments.get(program.id) ?? {},
  }));

  return (
    <div className="grid gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Programas UNIDEP</h1>
        <p className="mt-1 text-sm text-slate-300">
          Administra categoría, línea de negocio y los PDFs públicos de cada programa.
        </p>
      </div>
      <ProgramsClient programs={programsWithAssets} fileAssets={files} />
    </div>
  );
}

function NeedsMigration({ title }: { title: string }) {
  return (
    <div className="grid gap-6 p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <div className="font-semibold">Base de datos desactualizada</div>
        <div className="mt-1">
          Las columnas nuevas de UNIDEP aún no existen en Neon. Aplica la migración con el botón de abajo.
        </div>
      </div>
      <MigrateClient />
    </div>
  );
}
