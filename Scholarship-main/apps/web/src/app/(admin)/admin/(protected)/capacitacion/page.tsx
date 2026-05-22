import { AdminCapability } from "@prisma/client";

import { adminHasCapability } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

import {
  assertTrainingAdminView,
  createTrainingRoomAction,
  upsertTrainingPermissionAction,
} from "./actions";

function readQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export const dynamic = "force-dynamic";

export default async function AdminCapacitacionPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [admin, query] = await Promise.all([
    assertTrainingAdminView(),
    searchParams ?? Promise.resolve(undefined),
  ]);
  const canManage = adminHasCapability(admin, [
    AdminCapability.manage_users,
    AdminCapability.manage_org_members,
  ]);
  const statusMessage = readQueryValue(query?.status);
  const errorMessage = readQueryValue(query?.error);

  const [users, organizations, permissions, rooms] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
      },
    }),
    prisma.organization.findMany({
      where: { isActive: true },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
      },
    }),
    prisma.trainingRoomPermission.findMany({
      orderBy: [
        { organization: { displayName: "asc" } },
        { user: { email: "asc" } },
      ],
      select: {
        id: true,
        canViewRolplay: true,
        canJoinRolplay: true,
        canCreateRoom: true,
        organizationId: true,
        userId: true,
        updatedAt: true,
        organization: {
          select: {
            displayName: true,
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
    }),
    prisma.trainingRoom.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        scenario: true,
        visibility: true,
        updatedAt: true,
        organization: {
          select: {
            displayName: true,
          },
        },
        creator: {
          select: {
            email: true,
          },
        },
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
      take: 24,
    }),
  ]);

  return (
    <div className="grid gap-6 p-6">
      <section className="ui-shell-page-intro">
        <div className="ui-shell-page-intro__grid">
          <div className="ui-shell-page-intro__headline">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="ui-pill ui-pill--accent">Capacitación</span>
              <span className="ui-pill">
                {canManage ? "Gestión habilitada" : "Consulta"}
              </span>
            </div>
            <div className="ui-kicker">Gobierno del módulo</div>
            <h1 className="ui-shell-page-intro__title">
              Asigna acceso a rolplay y prepara salas reales por organización.
            </h1>
            <p className="ui-shell-page-intro__copy">
              Este módulo resuelve el vacío operativo de capacitación: desde aquí
              se habilita quién puede ver, participar o crear salas, y también se
              crean las primeras salas que después consume <code>/unidep/capacitacion/rolplay</code>.
            </p>
          </div>

          <div className="ui-shell-page-intro__aside">
            <div className="ui-kicker">Resumen rápido</div>
            <div className="ui-shell-metric-grid">
              <div className="ui-shell-metric">
                <div className="ui-shell-metric__label">Organizaciones</div>
                <div className="ui-shell-metric__value">{organizations.length}</div>
                <div className="ui-shell-metric__copy">Disponibles para asignación</div>
              </div>
              <div className="ui-shell-metric">
                <div className="ui-shell-metric__label">Permisos activos</div>
                <div className="ui-shell-metric__value">{permissions.length}</div>
                <div className="ui-shell-metric__copy">Filas de acceso guardadas</div>
              </div>
              <div className="ui-shell-metric">
                <div className="ui-shell-metric__label">Salas</div>
                <div className="ui-shell-metric__value">{rooms.length}</div>
                <div className="ui-shell-metric__copy">Últimas salas registradas</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {statusMessage ? (
        <section className="ui-note ui-note--info">
          <div className="text-xs uppercase tracking-[0.28em]">Resultado</div>
          <div className="mt-1 font-semibold">{statusMessage}</div>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-[24px] border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <div className="text-xs uppercase tracking-[0.28em]">Error</div>
          <div className="mt-1 font-semibold">{errorMessage}</div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
        <div className="grid gap-4">
          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(11,61,92,0.92),rgba(13,45,86,0.96))] p-5">
            <div className="ui-kicker">Nueva asignación</div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Crear o actualizar permisos por usuario
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Usa esta forma para habilitar rolplay en una organización concreta.
              Si desmarcas todo y guardas, el permiso se elimina.
            </p>

            <form action={upsertTrainingPermissionAction} className="mt-5 grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2 text-sm text-slate-200">
                  Usuario
                  <select
                    name="userId"
                    className="ui-control"
                    disabled={!canManage}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Selecciona usuario
                    </option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  Organización
                  <select
                    name="organizationId"
                    className="ui-control"
                    disabled={!canManage}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Selecciona organización
                    </option>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="rounded-[22px] border border-white/8 bg-slate-950/20 p-4 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    name="canViewRolplay"
                    value="true"
                    className="mr-2"
                    disabled={!canManage}
                  />
                  Ver rolplay
                </label>
                <label className="rounded-[22px] border border-white/8 bg-slate-950/20 p-4 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    name="canJoinRolplay"
                    value="true"
                    className="mr-2"
                    disabled={!canManage}
                  />
                  Participar
                </label>
                <label className="rounded-[22px] border border-white/8 bg-slate-950/20 p-4 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    name="canCreateRoom"
                    value="true"
                    className="mr-2"
                    disabled={!canManage}
                  />
                  Crear salas
                </label>
              </div>

              <button
                type="submit"
                disabled={!canManage}
                className="ui-cta-secondary justify-center px-4 text-sm text-slate-100 disabled:opacity-60"
              >
                Guardar asignación
              </button>
            </form>
          </div>

          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(11,61,92,0.92),rgba(13,45,86,0.96))] p-5">
            <div className="ui-kicker">Asignaciones actuales</div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Permisos guardados por organización
            </h2>

            <div className="mt-5 grid gap-4">
              {permissions.length === 0 ? (
                <div className="rounded-[22px] border border-white/8 bg-slate-950/20 px-4 py-5 text-sm text-slate-300">
                  Aún no hay permisos explícitos registrados.
                </div>
              ) : null}

              {permissions.map((permission) => (
                <form
                  key={permission.id}
                  action={upsertTrainingPermissionAction}
                  className="grid gap-4 rounded-[22px] border border-white/8 bg-slate-950/20 p-4"
                >
                  <input type="hidden" name="userId" value={permission.userId} />
                  <input
                    type="hidden"
                    name="organizationId"
                    value={permission.organizationId}
                  />

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {permission.user.email}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {permission.organization.displayName}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      Actualizado {permission.updatedAt.toLocaleString("es-MX")}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="rounded-[18px] border border-white/8 bg-black/15 p-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        name="canViewRolplay"
                        value="true"
                        defaultChecked={permission.canViewRolplay}
                        className="mr-2"
                        disabled={!canManage}
                      />
                      Ver rolplay
                    </label>
                    <label className="rounded-[18px] border border-white/8 bg-black/15 p-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        name="canJoinRolplay"
                        value="true"
                        defaultChecked={permission.canJoinRolplay}
                        className="mr-2"
                        disabled={!canManage}
                      />
                      Participar
                    </label>
                    <label className="rounded-[18px] border border-white/8 bg-black/15 p-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        name="canCreateRoom"
                        value="true"
                        defaultChecked={permission.canCreateRoom}
                        className="mr-2"
                        disabled={!canManage}
                      />
                      Crear salas
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!canManage}
                    className="ui-cta-secondary justify-center px-4 text-sm text-slate-100 disabled:opacity-60"
                  >
                    Guardar cambios
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,48,78,0.9),rgba(10,36,74,0.96))] p-5">
            <div className="ui-kicker">Salas iniciales</div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Crear una sala operativa
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Crea la estructura base para que los usuarios con permisos entren
              inmediatamente a practicar desde <code>/unidep/capacitacion/rolplay</code>.
            </p>

            <form action={createTrainingRoomAction} className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm text-slate-200">
                Organización
                <select
                  name="organizationId"
                  className="ui-control"
                  disabled={!canManage}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecciona organización
                  </option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                Nombre
                <input
                  name="name"
                  className="ui-control"
                  placeholder="Ej. Sala General de Capacitación"
                  disabled={!canManage}
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                Descripción
                <textarea
                  name="description"
                  className="ui-control min-h-[96px]"
                  placeholder="Objetivo y alcance de la práctica"
                  disabled={!canManage}
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                Escenario
                <input
                  name="scenario"
                  className="ui-control"
                  placeholder="customer_service, ventas_b2b, admisiones"
                  disabled={!canManage}
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                Visibilidad
                <select
                  name="visibility"
                  className="ui-control"
                  defaultValue="org"
                  disabled={!canManage}
                >
                  <option value="org">Toda la organización</option>
                  <option value="private">Solo miembros invitados</option>
                  <option value="public">Todos los usuarios con acceso</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={!canManage}
                className="ui-cta-secondary justify-center px-4 text-sm text-slate-100 disabled:opacity-60"
              >
                Crear sala
              </button>
            </form>
          </div>

          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,48,78,0.9),rgba(10,36,74,0.96))] p-5">
            <div className="ui-kicker">Salas recientes</div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Últimas salas registradas
            </h2>

            <div className="mt-5 grid gap-3">
              {rooms.length === 0 ? (
                <div className="rounded-[22px] border border-white/8 bg-slate-950/20 px-4 py-5 text-sm text-slate-300">
                  Aún no hay salas creadas.
                </div>
              ) : null}

              {rooms.map((room) => (
                <article
                  key={room.id}
                  className="rounded-[22px] border border-white/8 bg-slate-950/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{room.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {room.organization.displayName}
                      </div>
                    </div>
                    <span className="ui-pill">{room.visibility}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {room.description || "Sin descripción registrada."}
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400">
                    <div>Escenario: {room.scenario || "sin definir"}</div>
                    <div>Creada por: {room.creator.email}</div>
                    <div>
                      {room._count.members} miembro(s) · {room._count.messages} mensaje(s)
                    </div>
                    <div>Actualizada: {room.updatedAt.toLocaleString("es-MX")}</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
