import Link from "next/link";

import { AdminCapability } from "@prisma/client";

import { adminHasCapability, requireAdminAccessUser } from "@/lib/admin-session";
import { getSystemRoleMeta } from "@/lib/system-roles";

type SummaryCard = {
  title: string;
  description: string;
  href: string;
  eyebrow: string;
  capability?: AdminCapability | AdminCapability[];
};

const SUMMARY_SECTIONS: Array<{
  title: string;
  description: string;
  cards: SummaryCard[];
}> = [
  {
    title: "Operación comercial",
    description: "Lo que impacta oferta, costos, simulador y atencion comercial.",
    cards: [
      {
        title: "Beneficios",
        description: "Reglas de beneficios adicionales, primer pago y vigencias.",
        href: "/admin/benefits",
        eyebrow: "Operacion",
        capability: AdminCapability.manage_benefits,
      },
      {
        title: "Precios",
        description: "Overrides, costos academicos y ajustes que afectan la cotizacion.",
        href: "/admin/prices",
        eyebrow: "Operacion",
        capability: AdminCapability.manage_prices,
      },
      {
        title: "Oferta academica",
        description: "Programas, planes y estructura oficial de oferta.",
        href: "/admin/oferta",
        eyebrow: "Operacion",
        capability: AdminCapability.manage_offers,
      },
      {
        title: "Directorio UNIDEP",
        description: "Planteles, campus y contactos operativos publicados.",
        href: "/admin/unidep/directory",
        eyebrow: "Operacion",
        capability: AdminCapability.manage_directory,
      },
    ],
  },
  {
    title: "Contenido público",
    description: "Elementos visibles que ordenan la experiencia y el mensaje.",
    cards: [
      {
        title: "CTAs",
        description: "Mapa visual por pagina, seccion y slot para botones y llamados.",
        href: "/admin/ctas",
        eyebrow: "Contenido",
        capability: AdminCapability.manage_ctas,
      },
      {
        title: "Comunicados",
        description: "Mensajes publicados sobre superficies visibles de la app.",
        href: "/admin/comunicados",
        eyebrow: "Contenido",
        capability: AdminCapability.manage_ctas,
      },
      {
        title: "Informacion publica",
        description: "Datos de contacto y orientacion del rail publico del home.",
        href: "/admin/sidebar",
        eyebrow: "Contenido",
        capability: AdminCapability.manage_sidebar,
      },
      {
        title: "Templates WhatsApp",
        description: "Versiones oficiales, revision y salida comercial de cotizaciones.",
        href: "/admin/whatsapp-templates",
        eyebrow: "Contenido",
        capability: AdminCapability.manage_ctas,
      },
    ],
  },
  {
    title: "Accesos",
    description: "Gobernanza del sistema, accesos y trazabilidad de ingreso.",
    cards: [
      {
        title: "Usuarios",
        description: "Rol del sistema, acceso administrativo y segmentos visuales reales.",
        href: "/admin/users",
        eyebrow: "Acceso",
        capability: [AdminCapability.view_users, AdminCapability.manage_users],
      },
      {
        title: "Invitaciones",
        description: "Flujo de altas, reenvios, estados y consumo explicito de tokens.",
        href: "/admin/invitations",
        eyebrow: "Acceso",
        capability: [AdminCapability.view_invites, AdminCapability.manage_invites],
      },
      {
        title: "Organizaciones",
        description: "Membresias por organizacion y estructura multiempresa.",
        href: "/admin/organizations",
        eyebrow: "Acceso",
        capability: [AdminCapability.view_org_members, AdminCapability.manage_org_members],
      },
      {
        title: "Capacitación",
        description: "Permisos de rolplay, creación de salas y trazabilidad del módulo de entrenamiento.",
        href: "/admin/capacitacion",
        eyebrow: "Acceso",
        capability: [
          AdminCapability.view_users,
          AdminCapability.manage_users,
          AdminCapability.view_org_members,
          AdminCapability.manage_org_members,
        ],
      },
    ],
  },
  {
    title: "Sistema",
    description: "Configuración, diagnóstico y gobierno técnico del sistema.",
    cards: [
      {
        title: "WhatsApp",
        description: "Conexión Meta, embedded signup, sincronización y estado técnico del canal.",
        href: "/admin/whatsapp",
        eyebrow: "Sistema",
        capability: AdminCapability.manage_ctas,
      },
      {
        title: "Extensión Chrome",
        description: "Runtime, selector pack, handoff a WhatsApp Web y métricas del canal.",
        href: "/admin/extension-panel",
        eyebrow: "Sistema",
        capability: [AdminCapability.manage_ctas, AdminCapability.view_admin_operations],
      },
      {
        title: "Reporte operativo",
        description: "Actividad, estado general y señales para seguimiento.",
        href: "/admin/reporting",
        eyebrow: "Sistema",
        capability: [AdminCapability.view_admin_operations, AdminCapability.view_reports],
      },
      {
        title: "Auditoria",
        description: "Eventos y trazas de cambios relevantes dentro del sistema.",
        href: "/admin/audit",
        eyebrow: "Sistema",
        capability: [AdminCapability.view_admin_operations, AdminCapability.view_reports],
      },
      {
        title: "Sincronizacion auth",
        description: "Herramientas tecnicas para revisar identidad y sesiones.",
        href: "/admin/auth-sync",
        eyebrow: "Sistema",
        capability: AdminCapability.view_admin_operations,
      },
    ],
  },
];

export default async function AdminIndexPage() {
  const admin = await requireAdminAccessUser();
  const roleMeta = getSystemRoleMeta(admin.role);
  const visibleSections = SUMMARY_SECTIONS.map((section) => ({
    ...section,
    cards: section.cards.filter(
      (card) => !card.capability || adminHasCapability(admin, card.capability),
    ),
  })).filter((section) => section.cards.length > 0);

  const visibleCardCount = visibleSections.reduce(
    (count, section) => count + section.cards.length,
    0,
  );

  return (
    <div className="grid gap-6 p-6">
      <section className="ui-shell-page-intro">
        <div className="ui-shell-page-intro__grid">
          <div className="ui-shell-page-intro__headline">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="ui-pill ui-pill--accent">Resumen operativo</span>
              {admin.isSystemOwner ? <span className="ui-pill">Owner</span> : null}
            </div>
            <div className="ui-kicker">Mapa principal</div>
            <h1 className="ui-shell-page-intro__title">
              Módulos, accesos y puntos de operación disponibles en esta sesión.
            </h1>
            <p className="ui-shell-page-intro__copy">
              Usa este resumen como mapa de entrada. Cada bloque agrupa las superficies
              administrativas reales que puedes modificar sin recorrer todo el panel.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <span className="ui-pill">Operación</span>
              <span className="ui-pill">Contenido</span>
              <span className="ui-pill">Acceso</span>
              <span className="ui-pill">Desarrollo</span>
            </div>
          </div>

          <div className="ui-shell-page-intro__aside">
            <div className="ui-kicker">Tu alcance actual</div>
            <div className="text-xl font-semibold text-white">{roleMeta.label}</div>
            <div className="text-sm text-slate-300">{roleMeta.description}</div>
            <div className="ui-shell-metric-grid">
              <div className="ui-shell-metric">
                <div className="ui-shell-metric__label">Módulos visibles</div>
                <div className="ui-shell-metric__value">{visibleCardCount}</div>
                <div className="ui-shell-metric__copy">Accesos mostrados en este panel</div>
              </div>
              <div className="ui-shell-metric">
                <div className="ui-shell-metric__label">Rol protegido</div>
                <div className="ui-shell-metric__value">
                  {admin.isSystemOwner ? "Sí" : "No"}
                </div>
                <div className="ui-shell-metric__copy">Control global del sistema</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {visibleSections.map((section) => (
        <section key={section.title} className="grid gap-4">
          <div className="ui-admin-section-head">
            <div className="ui-kicker">
              {section.title}
            </div>
            <h2 className="ui-admin-section-head__title">{section.title}</h2>
            <p className="ui-admin-section-head__copy">{section.description}</p>
          </div>

          <div className="ui-admin-tile-grid">
            {section.cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="ui-admin-tile group"
              >
                <div className="ui-admin-tile__eyebrow">
                  {card.eyebrow}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="ui-admin-tile__title">{card.title}</div>
                  <span className="ui-admin-chip ui-admin-chip--accent">Abrir</span>
                </div>
                <p className="ui-admin-tile__copy">{card.description}</p>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 transition group-hover:text-white">
                  Abrir módulo
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
