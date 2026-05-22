import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import FeesClient from "./FeesClient";
import MigrateClient from "../MigrateClient";
import { getMateriasAction } from "./actions";

export const dynamic = "force-dynamic";

async function loadFeesPageData() {
  try {
    return await Promise.all([
      prisma.academicFee.findMany({
        orderBy: [{ section: "asc" }, { concept: "asc" }],
        select: {
          id: true,
          code: true,
          concept: true,
          costMxn: true,
          section: true,
          isActive: true,
        },
      }),
      prisma.campus.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, code: true, metaKey: true },
      }),
      prisma.campusAcademicFee.findMany({
        select: {
          id: true,
          campusId: true,
          academicFeeId: true,
          isActive: true,
          overrideCostMxn: true,
        },
      }),
      getMateriasAction(),
    ]);
  } catch {
    return null;
  }
}

export default async function UnidepFeesPage() {
  await requireAdminCapabilityUser(AdminCapability.manage_prices);
  const data = await loadFeesPageData();
  if (!data) {
    return <NeedsMigration title="Costos Académicos UNIDEP" />;
  }

  const [fees, campuses, campusFees, materias] = data;

  return (
    <div className="grid gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Costos Académicos UNIDEP</h1>
        <p className="mt-1 text-sm text-slate-300">
          Consulta y ajusta cambios individuales en trámites, disponibilidad por plantel y
          precio por materia. Usa la pestaña de seed para cargas masivas en formato JSON o
          CSV.
        </p>
      </div>
      <FeesClient
        fees={fees}
        campuses={campuses}
        campusFees={campusFees}
        materias={materias}
      />
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
          Las tablas de costos académicos aún no existen en Neon. Aplica la migración con el
          botón de abajo.
        </div>
      </div>
      <MigrateClient />
    </div>
  );
}
