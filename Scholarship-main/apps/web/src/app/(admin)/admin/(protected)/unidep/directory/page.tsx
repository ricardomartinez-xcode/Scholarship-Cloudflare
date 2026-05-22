import { AdminCapability, AdminConfigModule } from "@prisma/client";

import ConfigPublishPanel from "@/components/admin/ConfigPublishPanel";
import { getAdminUser, requireAdminCapabilityUser } from "@/lib/admin-session";
import { getAdminConfigModuleMeta } from "@/lib/admin-config-modules";
import { canPublishConfigWithAdmin } from "@/lib/admin-publish-auth";
import { getConfigPublicationState } from "@/lib/admin-config-snapshots";
import { prisma } from "@/lib/prisma";
import { projectDirectoryContact } from "@/lib/directory-projection";
import {
  publishConfigModuleAction,
  rollbackConfigVersionAction,
} from "../../config-actions";
import DirectoryClient from "./DirectoryClient";

export const dynamic = "force-dynamic";

export default async function UnidepDirectoryPage() {
  await requireAdminCapabilityUser(AdminCapability.manage_directory);
  const configModule = AdminConfigModule.DIRECTORY;
  const moduleMeta = getAdminConfigModuleMeta(configModule);

  const [admin, publicationState, contacts, campuses] = await Promise.all([
    getAdminUser(),
    getConfigPublicationState(configModule),
    prisma.directoryContact.findMany({
      orderBy: [{ campus: { name: "asc" } }, { role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        campusId: true,
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
        campus: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.campus.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
  ]);

  return (
    <div className="grid gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Directorio UNIDEP</h1>
        <p className="mt-1 text-sm text-slate-300">
          CRUD de contactos del directorio académico y escolar.
        </p>
      </div>
      <ConfigPublishPanel
        module={configModule}
        title={moduleMeta.label}
        description={moduleMeta.description}
        canPublish={canPublishConfigWithAdmin(admin)}
        state={publicationState}
        publishConfigModuleAction={publishConfigModuleAction}
        rollbackConfigVersionAction={rollbackConfigVersionAction}
      />
      <section className="ui-card grid gap-3 p-4 text-sm text-slate-300 md:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Zona y rol
          </div>
          <p className="mt-2">
            Zona ayuda a agrupar contactos operativos. Rol debe nombrar la función del contacto,
            no el área completa ni el nombre del campus.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Métodos de contacto
          </div>
          <p className="mt-2">
            Separa correo, teléfono, WhatsApp y URL en métodos distintos. Usa el principal
            para el canal preferente y deja el campo legado sólo como compatibilidad.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Calidad de datos
          </div>
          <p className="mt-2">
            Evita duplicar contactos por campus y rol. Si un método ya no sirve, elimínalo
            o márcalo como secundario en lugar de concatenarlo en un solo campo ambiguo.
          </p>
        </div>
      </section>
      <DirectoryClient
        contacts={contacts.map((contact) => ({
          ...projectDirectoryContact(contact),
          campusId: contact.campusId,
        }))}
        campuses={campuses}
      />
    </div>
  );
}
