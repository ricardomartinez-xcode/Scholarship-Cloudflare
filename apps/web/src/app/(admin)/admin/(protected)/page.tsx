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

type SummarySection = {
  title: string;
  description: string;
  cards: SummaryCard[];
};

const SUMMARY_SECTIONS: SummarySection[] = [
  {
    title: "Accesos",
    description: "Usuarios, invitaciones, organizaciones y sincronización de identidad.",
    cards: [
      {
        title: "Usuarios",
        description: "Rol del sistema, acceso administrativo y permisos visibles.",
        href: "/admin/users",
        eyebrow: "Acceso",
        capability: [AdminCapability.view_users, AdminCapability.manage_users],
      },
      {
        title: "Invitaciones",
        description: "Altas, reenvíos, estados y consumo explícito de tokens.",
        href: "/admin/invitations",
        eyebrow: "Acceso",
        capability: [AdminCapability.view_invites, AdminCapability.manage_invites],
      },
      {
        title: "Organizaciones",
        description: "Membresías por organización y estructura multiempresa.",
        href: "/admin/organizations",
        eyebrow: "Acceso",
        capability: [AdminCapability.view_org_members, AdminCapability.manage_org_members],
      },
      {
        title: "Auth sync",
        description: "Diagnóstico técnico de identidad y sesiones.",
        href: "/admin/auth-sync",
        eyebrow: "Sistema",
        capability: AdminCapability.view_admin_operations,
      },
    ],
  },
  {
    title: "Oferta y precios",
    description: "Oferta por planteles, programas, precios, beneficios y simulador.",
    cards: [
      {
        title: "Oferta por planteles",
        description: "Carga, previsualización y publicación de oferta por ciclo.",
        href: "/admin/oferta",
        eyebrow: "Importación",
        capability: AdminCapability.manage_offers,
      },
      {
        title: "Programas",
        description: "Programas académicos, PDFs y estructura visible.",
        href: "/admin/unidep/programs",
        eyebrow: "Catálogo",
        capability: AdminCapability.manage_offers,
      },
      {
        title: "Precios",
        description: "Overrides, costos académicos y ajustes que afectan cotización.",
        href: "/admin/prices",
        eyebrow: "Catálogo",
        capability: AdminCapability.manage_prices,
      },
      {
        title: "Beneficios",
        description: "Reglas de beneficios adicionales, primer pago y vigencias.",
        href: "/admin/benefits",
        eyebrow: "Draft / publish",
        capability: AdminCapability.manage_benefits,
      },
      {
        title: "Costos académicos",
        description: "Costos por plantel, tier y modalidad para cotización.",
        href: "/admin/unidep/fees",
        eyebrow: "Catálogo",
        capability: AdminCapability.manage_prices,
      },
      {
        title: "Simulador",
        description: "Sesiones, escenarios guardados, CTAs y monitoreo lateral.",
        href: "/admin/unidep/simulador",
        eyebrow: "UNIDEP",
        capability: [AdminCapability.manage_prices, AdminCapability.manage_offers],
      },
      {
        title: "Formatos",
        description: "Formatos públicos y recursos de consulta para programas.",
        href: "/admin/unidep/formatos",
        eyebrow: "Contenido",
        capability: AdminCapability.manage_offers,
      },
      {
        title: "Archivos R2",
        description: "Assets, PDFs e imágenes vinculadas a oferta y programas.",
        href: "/admin/files",
        eyebrow: "Assets",
        capability: AdminCapability.manage_offers,
      },
    ],
  },
  {
    title: "Catálogos UNIDEP",
    description: "Planteles, directorio y aliases canónicos para cotización.",
    cards: [
      {
        title: "Planteles",
        description: "Catálogo de campus y estado operativo por sede.",
        href: "/admin/unidep/campuses",
        eyebrow: "Catálogo",
        capability: AdminCapability.manage_directory,
      },
      {
        title: "Directorio",
        description: "Planteles, campus y contactos operativos publicados.",
        href: "/admin/unidep/directory",
        eyebrow: "Directorio",
        capability: AdminCapability.manage_directory,
      },
      {
        title: "Aliases",
        description: "Equivalencias entre importaciones, planteles y datos canónicos.",
        href: "/admin/aliases",
        eyebrow: "Catálogo",
        capability: [AdminCapability.manage_prices, AdminCapability.manage_offers, AdminCapability.manage_benefits],
      },
    ],
  },
  {
    title: "Comunicación",
    description: "Mensajes, CTAs, WhatsApp y extensión Chrome.",
    cards: [
      {
        title: "Comunicados",
        description: "Mensajes publicados sobre superficies visibles de la app.",
        href: "/admin/comunicados",
        eyebrow: "Contenido",
        capability: AdminCapability.manage_ctas,
      },
      {
        title: "CTAs",
        description: "Mapa visual por página, sección y slot para llamados.",
        href: "/admin/ctas",
        eyebrow: "Contenido",
        capability: AdminCapability.manage_ctas,
      },
      {
        title: "WhatsApp",
        description: "Canal Meta, templates y estado técnico de comunicación.",
        href: "/admin/whatsapp",
        eyebrow: "Integración",
        capability: AdminCapability.manage_ctas,
      },
      {
        title: "Templates WhatsApp",
        description: "Plantillas oficiales y variables usadas en mensajes.",
        href: "/admin/whatsapp-templates",
        eyebrow: "Contenido",
        capability: AdminCapability.manage_ctas,
      },
      {
        title: "Extensión Chrome",
        description: "Runtime, selector pack, handoff a WhatsApp Web y métricas.",
        href: "/admin/extension-panel",
        eyebrow: "Integración",
        capability: [AdminCapability.manage_ctas, AdminCapability.view_admin_operations],
      },
    ],
  },
  {
    title: "Sistema",
    description: "Importaciones, auditoría, monitoreo, API y configuración pública.",
    cards: [
      {
        title: "Importaciones",
        description: "Historial, previews, aplicaciones y rollbacks de archivos.",
        href: "/admin/importaciones",
        eyebrow: "Importaciones",
        capability: AdminCapability.view_admin_operations,
      },
      {
        title: "Reporte operativo",
        description: "Actividad, estado general y señales de seguimiento.",
        href: "/admin/reporting",
        eyebrow: "Monitoreo",
        capability: [AdminCapability.view_admin_operations, AdminCapability.view_reports],
      },
      {
        title: "Auditoría",
        description: "Eventos y trazas de cambios relevantes dentro del sistema.",
        href: "/admin/audit",
        eyebrow: "Auditoría",
        capability: [AdminCapability.view_admin_operations, AdminCapability.view_reports],
      },
      {
        title: "Tokens API Recalc",
        description: "Emisión, revocación y OpenAPI para GPT Actions e intranet.",
        href: "/admin/integrations/recalc-api",
        eyebrow: "API",
        capability: AdminCapability.view_admin_operations,
      },
      {
        title: "Capacitación",
        description: "Permisos de roleplay, salas operativas y sesiones recientes.",
        href: "/admin/capacitacion",
        eyebrow: "Entrenamiento",
        capability: [
          AdminCapability.view_users,
          AdminCapability.manage_users,
          AdminCapability.view_org_members,
          AdminCapability.manage_org_members,
        ],
      },
      {
        title: "Información pública",
        description: "Contacto y orientación del rail público del home.",
        href: "/admin/sidebar",
        eyebrow: "Contenido",
        capability: AdminCapability.manage_sidebar,
      },
    ],
  },
];

function capabilityVisible(admin: Awaited<ReturnType<typeof requireAdminAccessUser>>, card: SummaryCard) {
  return !card.capability || adminHasCapability(admin, card.capability);
}

export default async function AdminIndexPage() {
  const admin = await requireAdminAccessUser();
  const roleMeta = getSystemRoleMeta(admin.role);
  const visibleSections = SUMMARY_SECTIONS.map((section) => ({
    ...section,
    cards: section.cards.filter((card) => capabilityVisible(admin, card)),
  })).filter((section) => section.cards.length > 0);

  const visibleCardCount = visibleSections.reduce((count, section) => count + section.cards.length, 0);
  const primaryCards = visibleSections.flatMap((section) => section.cards).slice(0, 6);

  return (
    <div className="grid gap-5 p-4 sm:p-5 lg:p-6">
      <section className="ui-admin-dashboard-hero">
        <div>
          <div className="ui-kicker">Panel operativo</div>
          <h1 className="ui-admin-dashboard-hero__title">Estado, módulos y acciones principales del administrador.</h1>
          <p className="ui-admin-dashboard-hero__copy">
            Usa esta vista como entrada de trabajo: prioriza operación, oferta, contenido, integraciones y auditoría sin recorrer todo el panel.
          </p>
        </div>
        <div className="ui-admin-dashboard-identity">
          <div className="ui-kicker">Alcance actual</div>
          <div className="ui-admin-dashboard-identity__role">{roleMeta.label}</div>
          <p>{roleMeta.description}</p>
        </div>
      </section>

      <section className="ui-admin-kpi-grid" aria-label="Resumen administrativo">
        <div className="ui-admin-kpi-card">
          <span>Módulos visibles</span>
          <strong>{visibleCardCount}</strong>
          <small>Accesos habilitados por permisos</small>
        </div>
        <div className="ui-admin-kpi-card">
          <span>Áreas activas</span>
          <strong>{visibleSections.length}</strong>
          <small>Grupos operativos disponibles</small>
        </div>
        <div className="ui-admin-kpi-card">
          <span>Rol protegido</span>
          <strong>{admin.isSystemOwner ? "Owner" : roleMeta.label}</strong>
          <small>Contexto de sesión actual</small>
        </div>
        <div className="ui-admin-kpi-card">
          <span>Prioridad</span>
          <strong>Publicación</strong>
          <small>Revisa draft, importaciones y auditoría</small>
        </div>
      </section>

      <section className="ui-admin-section-head">
        <div>
          <div className="ui-kicker">Accesos rápidos</div>
          <h2 className="ui-admin-section-head__title">Tareas frecuentes</h2>
          <p className="ui-admin-section-head__copy">Atajos a las superficies más usadas para operación diaria.</p>
        </div>
      </section>

      <div className="ui-admin-quick-grid">
        {primaryCards.map((card) => (
          <Link key={card.href} href={card.href} className="ui-admin-quick-card">
            <span>{card.eyebrow}</span>
            <strong>{card.title}</strong>
            <small>{card.description}</small>
          </Link>
        ))}
      </div>

      {visibleSections.map((section) => (
        <section key={section.title} className="grid gap-4">
          <div className="ui-admin-section-head">
            <div>
              <div className="ui-kicker">{section.title}</div>
              <h2 className="ui-admin-section-head__title">{section.title}</h2>
              <p className="ui-admin-section-head__copy">{section.description}</p>
            </div>
          </div>

          <div className="ui-admin-tile-grid">
            {section.cards.map((card) => (
              <Link key={card.href} href={card.href} className="ui-admin-tile group">
                <div className="ui-admin-tile__eyebrow">{card.eyebrow}</div>
                <div className="flex items-start justify-between gap-3">
                  <div className="ui-admin-tile__title">{card.title}</div>
                  <span className="ui-admin-chip ui-admin-chip--accent">Abrir</span>
                </div>
                <p className="ui-admin-tile__copy">{card.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
