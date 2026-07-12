import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import CampusesClient from "./CampusesClient";
import MigrateClient from "../MigrateClient";

export const dynamic = "force-dynamic";

async function loadCampuses() {
  try {
    return await prisma.campus.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        metaKey: true,
        name: true,
        slug: true,
        tier: true,
        kind: true,
        isActive: true,
        address: true,
        phone: true,
        whatsapp: true,
      },
    });
  } catch {
    return null;
  }
}

export default async function UnidepCampusesPage() {
  await requireAdminCapabilityUser(AdminCapability.manage_directory);
  const campuses = await loadCampuses();
  if (!campuses) {
    return <NeedsMigration title="Planteles UNIDEP" />;
  }

  return (
    <div className="grid gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Planteles UNIDEP</h1>
        <p className="mt-1 text-sm text-slate-300">
          Administra dirección, teléfono y WhatsApp de cada plantel. Importa desde CSV (URL de Cloudinary).
        </p>
      </div>
      <CampusesClient campuses={campuses} />
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
          Las columnas nuevas de UNIDEP aún no existen en PostgreSQL. Aplica la migración con el botón de abajo.
        </div>
      </div>
      <MigrateClient />
    </div>
  );
}
