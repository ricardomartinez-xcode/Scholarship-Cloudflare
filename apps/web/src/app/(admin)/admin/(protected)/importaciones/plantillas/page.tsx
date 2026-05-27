import { AdminCapability } from "@prisma/client";
import Link from "next/link";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { ADMIN_IMPORT_TEMPLATES } from "@/lib/importers/admin-import-templates";

export const dynamic = "force-dynamic";

export default async function ImportTemplatesPage() {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);

  return (
    <div className="grid gap-6 p-6">
      <section className="ui-card ui-card-pad">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Importaciones</div>
        <h1 className="mt-1 text-xl font-semibold">Plantillas descargables</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Descarga archivos base para preparar importaciones con columnas consistentes. Las plantillas reducen errores de captura y ayudan a operar precios, beneficios, becas base, aliases y oferta académica sin tocar código.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin/importaciones"
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Volver al historial
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ADMIN_IMPORT_TEMPLATES.map((template) => (
          <article key={template.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{template.moduleLabel}</div>
            <h2 className="mt-2 text-lg font-semibold text-white">{template.label}</h2>
            <p className="mt-2 text-sm text-slate-300">{template.description}</p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
              <div className="font-semibold text-slate-100">Columnas</div>
              <div className="mt-2 break-words text-slate-400">{template.headers.join(", ")}</div>
            </div>

            <ul className="mt-4 grid gap-2 text-xs text-slate-400">
              {template.notes.map((note) => (
                <li key={note} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  {note}
                </li>
              ))}
            </ul>

            <a
              href={`/api/admin/import-templates/${template.id}`}
              className="mt-5 inline-flex w-full justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              Descargar {template.format.toUpperCase()}
            </a>
          </article>
        ))}
      </section>
    </div>
  );
}
