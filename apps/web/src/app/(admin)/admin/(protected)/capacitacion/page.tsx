import { AdminCapability } from "@prisma/client";

import AdminDataTable from "@/components/admin/AdminDataTable";
import { adminHasCapability } from "@/lib/admin-session";
import { buildFileAssetLinks, listFileAssetUsagesByTargetType } from "@/lib/file-assets";
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

function formatDate(value: Date) {
  return value.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function TrainingKpi({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#c8d6e2] bg-white p-4 shadow-[0_12px_34px_rgb(16_32_42/0.05)]">
      <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#102838]">
        {value}
      </div>
      <p className="mt-1 text-sm leading-5 text-[#536a7c]">{description}</p>
    </div>
  );
}

function TrainingSection({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-[#c8d6e2] bg-white p-5 shadow-[0_16px_50px_rgb(16_32_42/0.06)]">
      <div className="mb-5">
        <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
          {kicker}
        </div>
        <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[#102838]">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#536a7c]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function PermissionCheckbox({
  name,
  label,
  disabled,
  defaultChecked,
}: {
  name: string;
  label: string;
  disabled: boolean;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-12 items-center rounded-[18px] border border-[#c8d6e2] bg-[#f7fafc] px-4 py-3 text-sm font-semibold text-[#163247]">
      <input
        type="checkbox"
        name={name}
        value="true"
        className="mr-2 h-4 w-4 accent-[#0f4c6b]"
        disabled={disabled}
        defaultChecked={defaultChecked}
      />
      {label}
    </label>
  );
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

  const [users, organizations, permissions, rooms, materials] = await Promise.all([
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
    listFileAssetUsagesByTargetType("training_material", {
      slotPrefix: "training",
      limit: 24,
    }),
  ]);

  const activeViewPermissions = permissions.filter(
    (permission) => permission.canViewRolplay,
  ).length;
  const activeJoinPermissions = permissions.filter(
    (permission) => permission.canJoinRolplay,
  ).length;
  const activeCreatorPermissions = permissions.filter(
    (permission) => permission.canCreateRoom,
  ).length;

  return (
    <div className="grid gap-5 p-4 sm:p-5 lg:p-6">
      <section className="rounded-[28px] border border-[#c8d6e2] bg-white p-5 shadow-[0_18px_60px_rgb(16_32_42/0.07)]">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#0f4c6b]/25 bg-[#0f4c6b]/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[#0f4c6b]">
                Capacitación
              </span>
              <span className="rounded-full border border-[#c8d6e2] bg-[#f7fafc] px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[#536a7c]">
                {canManage ? "Gestión habilitada" : "Consulta"}
              </span>
            </div>
            <div className="mt-4 text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
              Gobierno del módulo
            </div>
            <h1 className="mt-2 max-w-4xl text-3xl font-black leading-tight tracking-[-0.055em] text-[#102838] md:text-4xl">
              Permisos de roleplay, salas operativas y actividad reciente.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#536a7c]">
              Organiza quién puede ver, participar o crear salas de capacitación.
              La pantalla queda separada por tareas para reducir ruido visual y
              mantener la operación diaria clara.
            </p>
          </div>

          <div className="grid gap-3 rounded-[22px] border border-[#c8d6e2] bg-[#f7fafc] p-4">
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
              Resumen rápido
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[18px] border border-[#c8d6e2] bg-white p-3">
                <div className="text-xs font-bold text-[#536a7c]">Usuarios</div>
                <div className="mt-1 text-xl font-black text-[#102838]">
                  {users.length}
                </div>
              </div>
              <div className="rounded-[18px] border border-[#c8d6e2] bg-white p-3">
                <div className="text-xs font-bold text-[#536a7c]">Permisos</div>
                <div className="mt-1 text-xl font-black text-[#102838]">
                  {permissions.length}
                </div>
              </div>
              <div className="rounded-[18px] border border-[#c8d6e2] bg-white p-3">
              <div className="text-xs font-bold text-[#536a7c]">Salas</div>
                <div className="mt-1 text-xl font-black text-[#102838]">
                  {rooms.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {statusMessage ? (
        <section className="rounded-[20px] border border-[#0c5f3a]/20 bg-[#ddf8ea] px-4 py-3 text-sm font-semibold text-[#0c5f3a]">
          {statusMessage}
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-[20px] border border-[#8a2d2d]/20 bg-[#fde7e7] px-4 py-3 text-sm font-semibold text-[#8a2d2d]">
          {errorMessage}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <TrainingKpi
          label="Organizaciones"
          value={organizations.length}
          description="Disponibles para asignación y creación de salas."
        />
        <TrainingKpi
          label="Ver roleplay"
          value={activeViewPermissions}
          description="Usuarios habilitados para consultar el módulo."
        />
        <TrainingKpi
          label="Participar"
          value={activeJoinPermissions}
          description="Permisos activos para unirse a sesiones."
        />
        <TrainingKpi
          label="Crear salas"
          value={activeCreatorPermissions}
          description="Usuarios con capacidad para iniciar salas."
        />
        <TrainingKpi
          label="Materiales"
          value={materials.length}
          description="Recursos publicados desde Storage para capacitación."
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.7fr)]">
        <div className="grid gap-5">
          <TrainingSection
            kicker="Gestión de acceso"
            title="Crear o actualizar permisos por usuario"
            description="Selecciona usuario, organización y permisos. Si guardas sin permisos marcados, el registro se elimina."
          >
            <form action={upsertTrainingPermissionAction} className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-[#163247]">
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

                <label className="grid gap-2 text-sm font-bold text-[#163247]">
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
                <PermissionCheckbox
                  name="canViewRolplay"
                  label="Ver roleplay"
                  disabled={!canManage}
                />
                <PermissionCheckbox
                  name="canJoinRolplay"
                  label="Participar"
                  disabled={!canManage}
                />
                <PermissionCheckbox
                  name="canCreateRoom"
                  label="Crear salas"
                  disabled={!canManage}
                />
              </div>

              <button
                type="submit"
                disabled={!canManage}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-5 text-sm font-extrabold text-white shadow-[0_12px_30px_rgb(15_76_107/0.18)] transition hover:bg-[#0b3d56] disabled:border-[#c8d6e2] disabled:bg-[#e5ebef] disabled:text-[#647684]"
              >
                Guardar asignación
              </button>
            </form>
          </TrainingSection>

          <TrainingSection
            kicker="Asignaciones actuales"
            title="Permisos guardados por organización"
            description="Revisa y ajusta permisos existentes sin mezclar esta tarea con la creación de salas."
          >
            <div className="grid max-h-[620px] gap-3 overflow-y-auto pr-1">
              {permissions.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-6 text-sm text-[#536a7c]">
                  Aún no hay permisos explícitos registrados.
                </div>
              ) : null}

              {permissions.map((permission) => (
                <form
                  key={permission.id}
                  action={upsertTrainingPermissionAction}
                  className="grid gap-4 rounded-[22px] border border-[#c8d6e2] bg-[#f7fafc] p-4"
                >
                  <input type="hidden" name="userId" value={permission.userId} />
                  <input
                    type="hidden"
                    name="organizationId"
                    value={permission.organizationId}
                  />

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-[#102838]">
                        {permission.user.email}
                      </div>
                      <div className="mt-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[#536a7c]">
                        {permission.organization.displayName}
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-[#536a7c]">
                      Actualizado {formatDate(permission.updatedAt)}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <PermissionCheckbox
                      name="canViewRolplay"
                      label="Ver roleplay"
                      disabled={!canManage}
                      defaultChecked={permission.canViewRolplay}
                    />
                    <PermissionCheckbox
                      name="canJoinRolplay"
                      label="Participar"
                      disabled={!canManage}
                      defaultChecked={permission.canJoinRolplay}
                    />
                    <PermissionCheckbox
                      name="canCreateRoom"
                      label="Crear salas"
                      disabled={!canManage}
                      defaultChecked={permission.canCreateRoom}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!canManage}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#c8d6e2] bg-white px-4 text-sm font-extrabold text-[#163247] transition hover:border-[#0f4c6b]/40 hover:bg-[#0f4c6b]/10 disabled:bg-[#e5ebef] disabled:text-[#647684]"
                  >
                    Guardar cambios
                  </button>
                </form>
              ))}
            </div>
          </TrainingSection>
        </div>

        <div className="grid gap-5 content-start">
          <TrainingSection
            kicker="Materiales Storage"
            title="Recursos publicados"
            description="Sube videos, PDFs, imágenes o documentos en Archivos Storage y relaciónalos como Material de capacitación."
          >
            <div className="grid gap-3">
              <a
                href="/admin/files"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-4 text-sm font-extrabold text-white shadow-[0_12px_30px_rgb(15_76_107/0.16)] transition hover:bg-[#0b3d56]"
              >
                Configurar archivos Storage
              </a>
              {materials.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-6 text-sm text-[#536a7c]">
                  Aún no hay materiales relacionados.
                </div>
              ) : (
                <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
                  {materials.map((usage) => {
                    const links = buildFileAssetLinks(usage.file.id);
                    return (
                      <article
                        key={usage.id}
                        className="rounded-[20px] border border-[#c8d6e2] bg-[#f7fafc] p-4"
                      >
                        <div className="text-sm font-black text-[#102838]">
                          {usage.file.fileName}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-[#536a7c]">
                          {usage.slot} · {usage.file.mimeType}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a
                            href={links.previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-[#c8d6e2] bg-white px-3 py-1 text-xs font-bold text-[#163247]"
                          >
                            Preview
                          </a>
                          <a
                            href={links.downloadUrl}
                            className="rounded-full border border-[#c8d6e2] bg-white px-3 py-1 text-xs font-bold text-[#163247]"
                          >
                            Descargar
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </TrainingSection>

          <TrainingSection
            kicker="Salas iniciales"
            title="Crear una sala operativa"
            description="Crea la estructura base para que usuarios con permisos entren a practicar desde roleplay."
          >
            <form action={createTrainingRoomAction} className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-[#163247]">
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

              <label className="grid gap-2 text-sm font-bold text-[#163247]">
                Nombre
                <input
                  name="name"
                  className="ui-control"
                  placeholder="Ej. Sala General de Capacitación"
                  disabled={!canManage}
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-[#163247]">
                Descripción
                <textarea
                  name="description"
                  className="ui-control min-h-[96px]"
                  placeholder="Objetivo y alcance de la práctica"
                  disabled={!canManage}
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-[#163247]">
                Escenario
                <input
                  name="scenario"
                  className="ui-control"
                  placeholder="customer_service, ventas_b2b, admisiones"
                  disabled={!canManage}
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-[#163247]">
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
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-5 text-sm font-extrabold text-white shadow-[0_12px_30px_rgb(15_76_107/0.18)] transition hover:bg-[#0b3d56] disabled:border-[#c8d6e2] disabled:bg-[#e5ebef] disabled:text-[#647684]"
              >
                Crear sala
              </button>
            </form>
          </TrainingSection>

          <TrainingSection
            kicker="Salas recientes"
            title="Últimas salas registradas"
            description="Historial operativo para validar creación, escenario, miembros y actividad."
          >
            <div className="grid max-h-[620px] gap-3 overflow-y-auto pr-1">
              {rooms.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-6 text-sm text-[#536a7c]">
                  Aún no hay salas creadas.
                </div>
              ) : null}

              {rooms.map((room) => (
                <article
                  key={room.id}
                  className="rounded-[22px] border border-[#c8d6e2] bg-[#f7fafc] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-[#102838]">
                        {room.name}
                      </div>
                      <div className="mt-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[#536a7c]">
                        {room.organization.displayName}
                      </div>
                    </div>
                    <span className="rounded-full border border-[#c8d6e2] bg-white px-3 py-1 text-xs font-extrabold text-[#163247]">
                      {room.visibility}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#536a7c]">
                    {room.description || "Sin descripción registrada."}
                  </p>
                  <div className="mt-3 grid gap-2 text-xs font-semibold text-[#536a7c]">
                    <div>Escenario: {room.scenario || "sin definir"}</div>
                    <div>Creada por: {room.creator.email}</div>
                    <div>
                      {room._count.members} miembro(s) · {room._count.messages} mensaje(s)
                    </div>
                    <div>Actualizada: {formatDate(room.updatedAt)}</div>
                  </div>
                </article>
              ))}
            </div>
          </TrainingSection>
        </div>
      </section>

      <AdminDataTable
        title="Resumen de permisos"
        count={permissions.length}
        description="Vista compacta para revisar registros sin desbordar la pantalla."
        maxHeight="420px"
      >
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Organización</th>
              <th>Ver</th>
              <th>Participar</th>
              <th>Crear salas</th>
              <th>Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id}>
                <td>{permission.user.email}</td>
                <td>{permission.organization.displayName}</td>
                <td>{permission.canViewRolplay ? "Sí" : "No"}</td>
                <td>{permission.canJoinRolplay ? "Sí" : "No"}</td>
                <td>{permission.canCreateRoom ? "Sí" : "No"}</td>
                <td>{formatDate(permission.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminDataTable>
    </div>
  );
}
