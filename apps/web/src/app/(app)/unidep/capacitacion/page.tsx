"use client";

import Link from "next/link";

import { useTrainingAccess } from "@/components/capacitacion/TrainingAccessProvider";

const MODULE_ITEMS = [
  {
    href: "/unidep/capacitacion/rolplay",
    title: "Rolplay",
    requiresRolplay: true,
  },
  {
    href: "/unidep/capacitacion/materiales",
    title: "Materiales",
    requiresRolplay: false,
  },
  {
    href: "/unidep/capacitacion/evaluaciones",
    title: "Evaluaciones",
    requiresRolplay: false,
  },
  {
    href: "/unidep/capacitacion/sesiones",
    title: "Sesiones",
    requiresRolplay: false,
  },
] as const;

export default function CapacitacionPage() {
  const { organizations, permissions, isLoading } = useTrainingAccess();
  const hasAccess = permissions.canAccessCapacitacion || organizations.length > 0;

  return (
    <div className="grid gap-4">
      {!hasAccess && !isLoading ? (
        <section className="ui-note ui-note--warning">
          <div className="font-semibold">Sin acceso a capacitación.</div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {MODULE_ITEMS.filter(
          (item) => !item.requiresRolplay || permissions.canViewRolplay,
        ).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="ui-card ui-card-pad flex items-center justify-between gap-3"
          >
            <span className="text-sm font-semibold">{item.title}</span>
            <span className="ui-pill">Abrir</span>
          </Link>
        ))}
      </section>

      <section className="ui-card ui-card-pad">
        <div className="flex flex-wrap gap-2">
          <span className="ui-pill">
            {permissions.canViewRolplay ? "Rolplay habilitado" : "Rolplay restringido"}
          </span>
          <span className="ui-pill">
            {permissions.canJoinRolplay ? "Participación habilitada" : "Participación restringida"}
          </span>
          <span className="ui-pill">
            {permissions.canCreateRooms ? "Creación de salas habilitada" : "Creación de salas restringida"}
          </span>
        </div>
      </section>
    </div>
  );
}
