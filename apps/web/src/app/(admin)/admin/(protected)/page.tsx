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

const SUMMARY_CARDS: SummaryCard[] = [
  {
    title: "Reporte operativo",
    description: "Dashboard de actividad, salud de assets, auth sync, importaciones y señales críticas.",
    href: "/admin/reporting",
    eyebrow: "Monitoreo",
    capability: [AdminCapability.view_admin_operations, AdminCapability.view_reports],
  },
  {
    title: "Usuarios",
    description: "Roles, accesos administrativos y permisos visibles por usuario.",
    href: "/admin/users",
    eyebrow: "Operación",
    capability: [AdminCapability.view_users, AdminCapability.manage_users],
  },
  {
    title: "Organizaciones",
    description: "Membresías por organización y estructura multiempresa.",
    href: "/admin/organizations",
    eyebrow: "Operación",
    capability: [AdminCapability.view_org_members, AdminCapability.manage_org_members],
  },
  {
    title: "Importaciones",
    description: "Historial, previews, aplicaciones y rollbacks de archivos cargados desde admin.",
    href: "/admin/importaciones",
    eyebrow: "Operación",
    capability: AdminCapability.view_admin_operations,
  },
  {
    title: "Auditoría",
    description: "Eventos y trazas de cambios relevantes dentro del sistema.",
    href: "/admin/audit",
    eyebrow: "Operación",
    capability: [AdminCapability.view_admin_operations, AdminCapability.view_reports],
  },
  {
    title: "Auth sync",
    description: "Diagnóstico técnico de identidad, sesiones y reparación guiada.",
    href: "/admin/auth-sync",
    eyebrow: "Operación",
    capability: AdminCapability.view_admin_operations,
  },
  {
    title: "Beneficios",
    description: "Reglas de beneficios adicionales, primer pago y vigencias.",
    href: "/admin/benefits",
    eyebrow: "Oferta",
    capability: AdminCapability.manage_benefits,
  },
  {
    title: "Precios",
    description: "Overrides, costos académicos y ajustes que afectan cotización.",
    href: "/admin/prices",
    eyebrow: "Oferta",
    capability: AdminCapability.manage_prices,
  },
  {
    title: "Oferta académica",
    description: "Carga, previsualización y publicación de oferta por ciclo.",
    href: "/admin/oferta",
    eyebrow: "Oferta",
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
    title: "Comunicados",
    description: "Mensajes publicados sobre superficies visibles de la app.",
    href: "/admin/comunicados",
    eyebrow: "Comunicación",
    capability: AdminCapability.manage_ctas,
  },
  {
    title: "Capacitación",
    description: "Permisos de roleplay, salas operativas y sesiones recientes.",
    href: "/admin/capacitacion",
    eyebrow: "Equipo",
    capability: [
      AdminCapability.view_users,
      AdminCapability.manage_users,
      AdminCapability.view_org_members,
      AdminCapability.manage_org_members,
    ],
  },
];

function capabilityVisible(
  admin: Awaited<ReturnType<typeof requireAdminAccessUser>>,
  card: SummaryCard,
) {
  return !card.capability || adminHasCapability(admin, card.capability);
}

export default async function AdminIndexPage() {
  const admin = await requireAdminAccessUser();
  const roleMeta = getSystemRoleMeta(admin.role);
  const visibleCards = SUMMARY_CARDS.filter((card) => capabilityVisible(admin, card));

  return (
    <div className="grid gap-5 p-4 sm:p-5 lg:p-6">
      <section className="rounded-[28px] border border-[#c8d6e2] bg-white p-5 shadow-[0_18px_60px_rgb(16_32_42/0.07)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
              Resumen operativo
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.045em] text-[#102838] md:text-3xl">
              Superficies principales del administrador.
            </h1>
          </div>
          <div className="rounded-[20px] border border-[#c8d6e2] bg-[#f7fafc] px-4 py-3 text-right">
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">
              Alcance
            </div>
            <div className="mt-1 font-black text-[#102838]">
              {admin.isSystemOwner ? "Owner" : roleMeta.label}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores administrativos">
        <div className="rounded-[24px] border border-[#c8d6e2] bg-white p-4 shadow-[0_12px_34px_rgb(16_32_42/0.05)]">
          <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">Módulos visibles</div>
          <div className="mt-2 text-2xl font-black text-[#102838]">{visibleCards.length}</div>
          <div className="mt-1 text-sm text-[#536a7c]">Accesos habilitados por permisos</div>
        </div>
        <div className="rounded-[24px] border border-[#c8d6e2] bg-white p-4 shadow-[0_12px_34px_rgb(16_32_42/0.05)]">
          <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">Rol protegido</div>
          <div className="mt-2 text-2xl font-black text-[#102838]">{admin.isSystemOwner ? "Owner" : roleMeta.label}</div>
          <div className="mt-1 text-sm text-[#536a7c]">Contexto de sesión actual</div>
        </div>
        <Link
          href="/admin/reporting"
          className="rounded-[24px] border border-[#0f4c6b]/24 bg-[#0f4c6b]/10 p-4 shadow-[0_12px_34px_rgb(16_32_42/0.05)] transition hover:border-[#0f4c6b]/44 hover:bg-[#0f4c6b]/15"
        >
          <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#0f4c6b]">Siguiente</div>
          <div className="mt-2 text-2xl font-black text-[#102838]">Reporte</div>
          <div className="mt-1 text-sm text-[#536a7c]">Monitoreo operativo y señales críticas</div>
        </Link>
        <Link
          href="/admin/importaciones"
          className="rounded-[24px] border border-[#c8d6e2] bg-white p-4 shadow-[0_12px_34px_rgb(16_32_42/0.05)] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10"
        >
          <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">Prioridad</div>
          <div className="mt-2 text-2xl font-black text-[#102838]">Publicación</div>
          <div className="mt-1 text-sm text-[#536a7c]">Draft, importaciones y rollback</div>
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Accesos administrativos">
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-[24px] border border-[#c8d6e2] bg-white p-4 shadow-[0_12px_34px_rgb(16_32_42/0.05)] transition hover:border-[#0f4c6b]/40 hover:bg-[#f7fafc]"
          >
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">
              {card.eyebrow}
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <h2 className="text-lg font-black tracking-[-0.025em] text-[#102838]">
                {card.title}
              </h2>
              <span className="rounded-full border border-[#0f4c6b]/20 bg-[#0f4c6b]/10 px-2.5 py-1 text-xs font-extrabold text-[#0f4c6b] transition group-hover:bg-[#0f4c6b] group-hover:text-white">
                Abrir
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#536a7c]">{card.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
