import { AdminCapability, AdminConfigModule } from "@prisma/client";

import ConfigPublishPanel from "@/components/admin/ConfigPublishPanel";
import { getAdminUser, requireAdminCapabilityUser } from "@/lib/admin-session";
import { getAdminConfigModuleMeta } from "@/lib/admin-config-modules";
import { canPublishConfigWithAdmin } from "@/lib/admin-publish-auth";
import { getConfigPublicationState } from "@/lib/admin-config-snapshots";
import { prisma } from "@/lib/prisma";
import SidebarInfoClient from "@/components/admin/SidebarInfoClient";
import {
  publishConfigModuleAction,
  rollbackConfigVersionAction,
} from "../config-actions";
import { deleteSidebarInfoAction, upsertSidebarInfoAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SidebarPage() {
  await requireAdminCapabilityUser(AdminCapability.manage_sidebar);
  const configModule = AdminConfigModule.SIDEBAR;
  const moduleMeta = getAdminConfigModuleMeta(configModule);

  const [admin, publicationState, rows] = await Promise.all([
    getAdminUser(),
    getConfigPublicationState(configModule),
    prisma.adminSidebarInfo.findMany({
      orderBy: [{ key: "asc" }],
      select: { id: true, key: true, value: true, isActive: true },
    }),
  ]);

  return (
    <div className="grid gap-6">
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
            Modulo
          </div>
          <p className="mt-2">
            Aqui no editas una sidebar tecnica. Editas la{" "}
            <span className="font-semibold text-slate-100">columna publica de contacto y orientacion</span>{" "}
            que aparece en el inicio del sitio.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Uso real
          </div>
          <p className="mt-2">
            Sirve para telefono, correo, WhatsApp, direccion, horarios y sitio web. Todo lo que
            ayude a un usuario a pedir apoyo antes de registrarse o iniciar sesion.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Publicacion
          </div>
          <p className="mt-2">
            Estos datos se publican como contenido visible del home. Conviene tratarlos como
            informacion oficial de contacto, no como texto auxiliar del panel.
          </p>
        </div>
      </section>
      <SidebarInfoClient
        rows={rows}
        upsertSidebarInfoAction={upsertSidebarInfoAction}
        deleteSidebarInfoAction={deleteSidebarInfoAction}
      />
    </div>
  );
}

