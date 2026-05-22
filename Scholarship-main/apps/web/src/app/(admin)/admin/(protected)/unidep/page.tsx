import Link from "next/link";

import MigrateClient from "./MigrateClient";
import { requireAdminAccessUser } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function UnidepIndexPage() {
  const admin = await requireAdminAccessUser();
  const cards = [
    {
      href: "/admin/unidep/programs",
      label: "Programas",
      desc: "Línea de negocio y URLs oficiales para brochure y plan de estudios.",
    },
    {
      href: "/admin/unidep/formatos",
      label: "Formatos",
      desc: "Documentos útiles para inscripción en PDF, Word o link de descarga.",
    },
    {
      href: "/admin/unidep/campuses",
      label: "Planteles",
      desc: "Dirección, teléfono, WhatsApp, CSV y consistencia de sedes.",
    },
    {
      href: "/admin/unidep/fees",
      label: "Costos académicos",
      desc: "Trámites, exámenes y disponibilidad por plantel.",
    },
    {
      href: "/admin/unidep/directory",
      label: "Directorio",
      desc: "Contactos académicos, escolares y responsables operativos.",
    },
  ];

  return (
    <div className="grid gap-6 p-6">
      <section className="ui-shell-page-intro">
        <div className="ui-shell-page-intro__grid">
          <div className="ui-shell-page-intro__headline">
            <div className="ui-kicker">UNIDEP</div>
            <h1 className="ui-shell-page-intro__title">
              Catálogos y superficies públicas que alimentan el workspace comercial.
            </h1>
            <p className="ui-shell-page-intro__copy">
              Desde aquí organizas la información base que consume el cotizador:
              programas, planteles, costos y directorio operativo.
            </p>
          </div>
          <div className="ui-shell-page-intro__aside">
            <div className="ui-kicker">Cobertura</div>
            <div className="ui-shell-metric-grid">
              <div className="ui-shell-metric">
                <div className="ui-shell-metric__label">Módulos</div>
                <div className="ui-shell-metric__value">{cards.length}</div>
                <div className="ui-shell-metric__copy">Entradas principales del catálogo UNIDEP</div>
              </div>
              <div className="ui-shell-metric">
                <div className="ui-shell-metric__label">Owner</div>
                <div className="ui-shell-metric__value">
                  {admin.isSystemOwner ? "Sí" : "No"}
                </div>
                <div className="ui-shell-metric__copy">Habilita acciones extraordinarias</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(11,61,92,0.92),rgba(13,45,86,0.96))] p-5 transition hover:border-emerald-400/28 hover:bg-[linear-gradient(180deg,rgba(0,71,104,0.92),rgba(11,61,92,0.98))]"
          >
            <div className="ui-kicker transition group-hover:text-emerald-200/80">Catálogo</div>
            <div className="mt-2 font-semibold text-slate-100">{item.label}</div>
            <div className="mt-2 text-sm leading-6 text-slate-300">{item.desc}</div>
            <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition group-hover:text-emerald-200/70">
              Abrir módulo
            </div>
          </Link>
        ))}
      </div>

      {admin.isSystemOwner ? <MigrateClient /> : null}
    </div>
  );
}
