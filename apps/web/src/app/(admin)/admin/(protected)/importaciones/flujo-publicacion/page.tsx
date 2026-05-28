import { AdminCapability, AdminConfigModule } from "@prisma/client";
import Link from "next/link";

import { getAdminConfigModuleMeta } from "@/lib/admin-config-modules";
import { requireAdminCapabilityUser } from "@/lib/admin-session";
import {
  ADMIN_IMPORT_PUBLICATION_FLOW,
  getAdminImportPublicationChecklist,
} from "@/lib/importers/admin-import-publication";

export const dynamic = "force-dynamic";

const MODULES = [
  AdminConfigModule.PRICES,
  AdminConfigModule.BENEFITS,
  AdminConfigModule.OFFER,
] as const;

export default async function ImportPublicationFlowPage() {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);

  return (
    <div className="grid gap-6 p-6">
      <section className="ui-card ui-card-pad">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Fase 6D</div>
        <h1 className="mt-1 text-xl font-semibold">Modo borrador / publicación</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-300">
          Las importaciones operativas deben tratarse como borradores revisables antes de modificar datos productivos. Este flujo documenta el proceso estándar para validar, revisar, publicar y revertir sesiones desde Admin.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin/importaciones"
            className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            Ver historial de importaciones
          </Link>
          <Link
            href="/admin/importaciones/plantillas"
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Descargar plantillas
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ADMIN_IMPORT_PUBLICATION_FLOW.map((step) => (
          <article key={step.title} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-200">Flujo</div>
            <h2 className="mt-2 text-lg font-semibold text-white">{step.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{step.description}</p>
          </article>
        ))}
      </section>

      <section className="ui-card ui-card-pad">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Checklist operativo</div>
        <h2 className="mt-1 text-lg font-semibold">Antes de publicar</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Usa estos puntos como control mínimo de calidad por módulo. La publicación debe hacerse solamente cuando el borrador no tenga errores bloqueantes y el impacto sea esperado.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {MODULES.map((module) => {
          const meta = getAdminConfigModuleMeta(module);
          const checklist = getAdminImportPublicationChecklist(module);

          return (
            <article key={module} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{module}</div>
              <h3 className="mt-2 text-lg font-semibold text-white">{meta.label}</h3>
              <p className="mt-2 text-sm text-slate-300">{meta.description}</p>
              <ul className="mt-4 grid gap-2 text-xs text-slate-300">
                {checklist.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-amber-100">Regla de seguridad</div>
        <p className="mt-2 max-w-4xl text-sm text-amber-50/85">
          En producción, evita publicar importaciones sin revisar el detalle de sesión. Si una importación cambia precios, beneficios u oferta académica, conserva el sessionId y confirma que el rollback esté disponible antes de publicar.
        </p>
      </section>
    </div>
  );
}
