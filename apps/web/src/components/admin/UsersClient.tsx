"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AdminDialogShell from "@/components/admin/AdminDialogShell";
import {
  downloadCsv,
  type AdminTableDensity,
} from "@/components/admin/admin-table-utils";
import { useAdminUiPreferences } from "@/components/admin/useAdminUiPreferences";

type MembershipRow = {
  organizationId: string;
  organizationName: string;
  role: "owner" | "admin" | "member";
};

type CapabilityOverride = {
  capability: string;
  enabled: boolean;
};

type UserRow = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  isRootAdmin: boolean;
  isProtectedRole: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  systemRoleLabel: string;
  systemRoleDescription: string;
  memberships: MembershipRow[];
  capabilityOverrides: CapabilityOverride[];
  userCapabilities: string[];
  internalUserCapabilities: string[];
  effectiveCapabilities: string[];
};

type OrganizationOption = {
  id: string;
  displayName: string;
};

type EditableMembership = {
  organizationId: string;
  role: "owner" | "admin" | "member";
};

type CapabilityCatalogItem = {
  key: string;
  label: string;
  description: string;
};

type UserCapabilityCatalogItem = {
  key: string;
  label: string;
  description: string;
};

type RoleOption = {
  value: string;
  label: string;
  description?: string;
};

type UsersPreferenceState = {
  query: string;
  page: number;
  tableExpanded: boolean;
  density: AdminTableDensity;
  visibleColumns: Record<string, boolean>;
};

type EditableUserState = {
  role: string;
  isActive: boolean;
  memberships: EditableMembership[];
  capabilityOverrides: CapabilityOverride[];
  userCapabilities: string[];
};

const PAGE_SIZE = 10;
const USER_COLUMNS = [
  "email",
  "role",
  "status",
  "organizations",
  "effectiveCapabilities",
  "lastLogin",
] as const;

const USERS_DEFAULTS: UsersPreferenceState = {
  query: "",
  page: 1,
  tableExpanded: true,
  density: "comfortable",
  visibleColumns: {
    email: true,
    role: true,
    status: true,
    organizations: true,
    effectiveCapabilities: true,
    lastLogin: true,
  },
};

function summarizeLabels(
  labels: string[],
  emptyLabel: string,
  maxVisible = 3,
) {
  if (!labels.length) return emptyLabel;
  const visible = labels.slice(0, maxVisible);
  const remaining = labels.length - visible.length;
  return remaining > 0
    ? `${visible.join(", ")} +${remaining}`
    : visible.join(", ");
}

export default function UsersClient({
  currentAdmin,
  capabilityCatalog,
  userCapabilityCatalog,
  roleOptions,
  users,
  organizations,
  bulkUpdateUsersAction,
  updateUserAction,
  deleteUserAction,
}: {
  currentAdmin: {
    email: string;
    role: string;
    capabilities: string[];
    canManageUsers: boolean;
    canManageOrgMembers: boolean;
  };
  capabilityCatalog: CapabilityCatalogItem[];
  userCapabilityCatalog: UserCapabilityCatalogItem[];
  roleOptions: RoleOption[];
  users: UserRow[];
  organizations: OrganizationOption[];
  bulkUpdateUsersAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  updateUserAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  deleteUserAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const prefs = useAdminUiPreferences("USERS", USERS_DEFAULTS);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [formState, setFormState] = useState<EditableUserState | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const capabilityMetaByKey = useMemo(
    () => new Map(capabilityCatalog.map((item) => [item.key, item])),
    [capabilityCatalog],
  );
  const userCapabilityMetaByKey = useMemo(
    () => new Map(userCapabilityCatalog.map((item) => [item.key, item])),
    [userCapabilityCatalog],
  );
  const roleOptionByValue = useMemo(
    () => new Map(roleOptions.map((option) => [option.value, option])),
    [roleOptions],
  );

  const filtered = useMemo(() => {
    const q = prefs.state.query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const orgText = user.memberships
        .map((membership) => membership.organizationName)
        .join(" ")
        .toLowerCase();
      const capabilityText = user.effectiveCapabilities
        .map((capability) => capabilityMetaByKey.get(capability)?.label ?? capability)
        .join(" ")
        .toLowerCase();
      const visualAccessText = user.userCapabilities
        .map((capability) => userCapabilityMetaByKey.get(capability)?.label ?? capability)
        .join(" ")
        .toLowerCase();
      return (
        user.email.toLowerCase().includes(q) ||
        user.systemRoleLabel.toLowerCase().includes(q) ||
        orgText.includes(q) ||
        capabilityText.includes(q) ||
        visualAccessText.includes(q)
      );
    });
  }, [capabilityMetaByKey, prefs.state.query, userCapabilityMetaByKey, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(prefs.state.page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  const selectedRows = filtered.filter((user) => selectedIds.includes(user.id));
  const allVisibleSelected =
    pageRows.length > 0 && pageRows.every((user) => selectedIds.includes(user.id));
  const compact = prefs.state.density === "compact";
  const cellClassName = compact ? "p-2" : "p-3";
  const selectedRoleOption = formState
    ? roleOptionByValue.get(formState.role)
    : undefined;
  const isEditingSelf = Boolean(editing && editing.email === currentAdmin.email);
  const currentAdminIsOwner = currentAdmin.role === "owner";
  const ownerReadOnly =
    Boolean(editing?.isProtectedRole) && !(isEditingSelf && currentAdminIsOwner);
  const lockSelfPrivilegeControls = isEditingSelf && !currentAdminIsOwner;
  const disableRoleAndPrivilegeControls =
    ownerReadOnly ||
    !currentAdmin.canManageUsers ||
    lockSelfPrivilegeControls;

  const formatDate = (value: Date | null) =>
    value ? new Date(value).toLocaleString("es-MX") : "n/a";

  const getAdminCapabilityLabel = (capability: string) =>
    capabilityMetaByKey.get(capability)?.label ?? capability;

  const getVisualCapabilityLabel = (capability: string) =>
    userCapabilityMetaByKey.get(capability)?.label ?? capability;

  function openEditor(user: UserRow) {
    setEditing(user);
    setFormState({
      role: user.role,
      isActive: user.isActive,
      memberships: user.memberships.map((membership) => ({
        organizationId: membership.organizationId,
        role: membership.role,
      })),
      capabilityOverrides: user.capabilityOverrides.map((override) => ({
        capability: override.capability,
        enabled: override.enabled,
      })),
      userCapabilities: user.userCapabilities ?? [],
    });
    setMessage("");
  }

  function addMembership() {
    setFormState((prev) =>
      prev
        ? {
            ...prev,
            memberships: [
              ...prev.memberships,
              { organizationId: organizations[0]?.id ?? "", role: "member" },
            ],
          }
        : prev,
    );
  }

  function updateMembership(
    index: number,
    field: "organizationId" | "role",
    value: string,
  ) {
    setFormState((prev) => {
      if (!prev) return prev;
      const memberships = prev.memberships.map((membership, currentIndex) =>
        currentIndex === index
          ? { ...membership, [field]: value }
          : membership,
      ) as EditableMembership[];
      return { ...prev, memberships };
    });
  }

  function removeMembership(index: number) {
    setFormState((prev) =>
      prev
        ? {
            ...prev,
            memberships: prev.memberships.filter((_, currentIndex) => currentIndex !== index),
          }
        : prev,
    );
  }

  function toggleCapability(capability: string) {
    setFormState((prev) => {
      if (!prev) return prev;
      const exists = prev.capabilityOverrides.some(
        (override) => override.capability === capability,
      );
      return exists
        ? {
            ...prev,
            capabilityOverrides: prev.capabilityOverrides.filter(
              (override) => override.capability !== capability,
            ),
          }
        : {
            ...prev,
            capabilityOverrides: [
              ...prev.capabilityOverrides,
              { capability, enabled: true },
            ].sort((left, right) => left.capability.localeCompare(right.capability)),
          };
    });
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  }

  function toggleSelectVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !pageRows.some((row) => row.id === id));
      }
      const next = new Set(current);
      pageRows.forEach((row) => next.add(row.id));
      return Array.from(next);
    });
  }

  async function saveUser() {
    if (!editing || !formState) return;
    setMessage("");
    setSavingId(editing.id);
    try {
      const memberships = formState.memberships.filter(
        (membership) => membership.organizationId,
      );
      const fd = new FormData();
      fd.set("id", editing.id);
      fd.set("role", formState.role);
      fd.set("isActive", String(formState.isActive));
      fd.set("memberships", JSON.stringify(memberships));
      fd.set("capabilityOverrides", JSON.stringify(formState.capabilityOverrides));
      fd.set("userCapabilities", JSON.stringify(formState.userCapabilities ?? []));
      const result = await updateUserAction(fd);
      setMessage(result.ok ? "Usuario actualizado." : result.error ?? "Error.");
      if (result.ok) {
        setEditing(null);
        router.refresh();
      }
    } finally {
      setSavingId(null);
    }
  }

  async function deleteUser(id: string, email: string) {
    if (!window.confirm(`¿Eliminar la cuenta de ${email}? Esta acción no se puede deshacer.`)) return;
    setMessage("");
    setDeletingId(id);
    try {
      const fd = new FormData();
      fd.set("id", id);
      const result = await deleteUserAction(fd);
      setMessage(result.ok ? "Usuario eliminado." : result.error ?? "Error.");
      if (result.ok) {
        setSelectedIds((current) => current.filter((currentId) => currentId !== id));
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function runBulkAction(operation: "activate" | "deactivate") {
    if (!selectedIds.length) return;
    const confirmed = window.confirm(
      `¿Aplicar ${operation === "activate" ? "activar" : "desactivar"} a ${selectedIds.length} usuario(s)?`,
    );
    if (!confirmed) return;
    const fd = new FormData();
    fd.set("ids", JSON.stringify(selectedIds));
    fd.set("operation", operation);
    const result = await bulkUpdateUsersAction(fd);
    setMessage(result.ok ? "Acción en lote aplicada." : result.error ?? "Error.");
    if (result.ok) {
      setSelectedIds([]);
      router.refresh();
    }
  }

  function exportRows(rows: UserRow[]) {
    downloadCsv(
      "admin-users.csv",
      rows.map((user) => ({
        email: user.email,
        role: user.systemRoleLabel,
        active: user.isActive ? "si" : "no",
        organizations: user.memberships
          .map((membership) => `${membership.organizationName} (${membership.role})`)
          .join(" | "),
        adminAccess: user.role === "owner"
          ? "Acceso total"
          : user.effectiveCapabilities.map(getAdminCapabilityLabel).join(" | "),
        visualAccess: user.userCapabilities.map(getVisualCapabilityLabel).join(" | "),
        lastLogin: formatDate(user.lastLoginAt),
      })),
    );
  }

  const visibleColumns = prefs.state.visibleColumns;

  return (
    <div className="grid gap-6">
      <section className="ui-card ui-card-pad">
        <div className="ui-toolbar">
          <div>
            <h1 className="mt-1 text-lg font-semibold">Usuarios y permisos</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">
              Separa el rol del sistema, el acceso administrativo adicional y el acceso
              visual especial. Las cuentas <code>Owner</code> conservan acceso total
              y no admiten overrides operativos desde este panel.
            </p>
          </div>
          <div className="ui-toolbar-actions">
            <button
              type="button"
              onClick={() =>
                prefs.patchState({
                  density:
                    prefs.state.density === "compact" ? "comfortable" : "compact",
                })
              }
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10"
            >
              Densidad: {prefs.state.density === "compact" ? "compacta" : "cómoda"}
            </button>
            <button
              type="button"
              onClick={() =>
                prefs.patchState({ tableExpanded: !prefs.state.tableExpanded })
              }
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10"
            >
              {prefs.state.tableExpanded ? "Contraer tabla" : "Expandir tabla"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/25 p-4 text-sm text-slate-300">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Sesión actual
          </div>
          <div className="mt-2">{currentAdmin.email}</div>
          <div className="mt-2 text-xs text-slate-500">
            Este bloque muestra el acceso admin efectivo de tu sesión; no controla
            visibilidad de CTAs para usuarios finales.
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {currentAdmin.capabilities.map((capability) => (
              <span
                key={capability}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300"
              >
                {getAdminCapabilityLabel(capability)}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="ui-card grid gap-4 p-[var(--ui-card-pad)]">
        <div className="ui-toolbar">
          <label className="grid gap-1 text-xs text-slate-400">
            Buscar correo, rol, organización o acceso
            <input
              value={prefs.state.query}
              onChange={(e) =>
                prefs.patchState({ query: e.target.value, page: 1 })
              }
                className="ui-control w-full sm:min-w-[220px]"
              placeholder="usuario@dominio.com"
            />
          </label>

          <div className="ui-toolbar-actions">
            <button
              type="button"
              onClick={() => exportRows(selectedRows.length ? selectedRows : filtered)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:bg-white/10"
            >
              Exportar CSV
            </button>
            {currentAdmin.canManageUsers ? (
              <>
                <button
                  type="button"
                  disabled={!selectedIds.length}
                  onClick={() => void runBulkAction("activate")}
                  className="rounded-xl border border-emerald-300 bg-emerald-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-950 transition hover:bg-emerald-200 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100"
                >
                  Activar lote
                </button>
                <button
                  type="button"
                  disabled={!selectedIds.length}
                  onClick={() => void runBulkAction("deactivate")}
                  className="rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-950 transition hover:bg-amber-200 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100"
                >
                  Desactivar lote
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4 text-sm text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Columnas visibles
              </div>
              <div className="mt-1 text-xs text-slate-500">
                La configuración se guarda por usuario y módulo.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {USER_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[column]}
                    onChange={(event) =>
                      prefs.patchState({
                        visibleColumns: {
                          ...visibleColumns,
                          [column]: event.target.checked,
                        },
                      })
                    }
                  />
                  {column}
                </label>
              ))}
            </div>
          </div>
        </div>

        {message ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100">
            {message}
          </div>
        ) : null}

        {prefs.state.tableExpanded ? (
          <div className="ui-table-wrap ui-scrollbar">
            <table className="ui-table min-w-[840px]">
              <thead className="sticky top-0 bg-slate-950/95 text-slate-300 backdrop-blur">
                <tr>
                  <th className={`${cellClassName} w-[56px] text-center font-semibold`}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectVisible}
                    />
                  </th>
                  {visibleColumns.email ? (
                    <th className={`${cellClassName} min-w-[180px] text-left font-semibold`}>
                      Email
                    </th>
                  ) : null}
                  {visibleColumns.role ? (
                    <th className={`${cellClassName} min-w-[180px] text-left font-semibold`}>
                      Rol del sistema
                    </th>
                  ) : null}
                  {visibleColumns.status ? (
                    <th className={`${cellClassName} w-[100px] text-left font-semibold`}>
                      Activo
                    </th>
                  ) : null}
                  {visibleColumns.organizations ? (
                    <th className={`${cellClassName} min-w-[180px] text-left font-semibold`}>
                      Organizaciones
                    </th>
                  ) : null}
                  {visibleColumns.effectiveCapabilities ? (
                    <th className={`${cellClassName} min-w-[180px] text-left font-semibold`}>
                      Acceso admin
                    </th>
                  ) : null}
                  {visibleColumns.lastLogin ? (
                    <th className={`${cellClassName} w-[180px] text-left font-semibold`}>
                      Último acceso
                    </th>
                  ) : null}
                  <th className={`${cellClassName} min-w-[140px] text-right font-semibold`}>
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((user) => (
                  <tr key={user.id} className="align-top">
                    <td className={`${cellClassName} text-center`}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => toggleSelectOne(user.id)}
                      />
                    </td>
                    {visibleColumns.email ? (
                      <td className={`${cellClassName} text-slate-100`}>
                        <span className="ui-cell-truncate" title={user.email}>
                          {user.email}
                        </span>
                        {user.isRootAdmin ? (
                          <div className="text-xs text-emerald-300">Owner protegido</div>
                        ) : user.userCapabilities.length ? (
                          <div className="text-xs text-slate-400">
                            Visual: {summarizeLabels(
                              user.userCapabilities.map(getVisualCapabilityLabel),
                              "Sin acceso visual",
                              2,
                            )}
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                    {visibleColumns.role ? (
                      <td className={cellClassName}>
                        <div className="text-sm font-semibold text-slate-100">
                          {user.systemRoleLabel}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {user.systemRoleDescription}
                        </div>
                      </td>
                    ) : null}
                    {visibleColumns.status ? (
                      <td className={`${cellClassName} text-slate-100`}>
                        {user.isActive ? "Sí" : "No"}
                      </td>
                    ) : null}
                    {visibleColumns.organizations ? (
                      <td className={cellClassName}>
                        <div className="flex flex-wrap gap-2">
                          {user.memberships.length ? (
                            user.memberships.map((membership) => (
                              <span
                                key={`${user.id}-${membership.organizationId}`}
                                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300"
                              >
                                {membership.organizationName} · {membership.role}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500">Sin organización</span>
                          )}
                        </div>
                      </td>
                    ) : null}
                    {visibleColumns.effectiveCapabilities ? (
                      <td className={cellClassName}>
                        <div className="text-sm text-slate-100">
                          {user.role === "owner"
                            ? "Acceso total a módulos admin"
                            : summarizeLabels(
                                user.effectiveCapabilities.map(getAdminCapabilityLabel),
                                "Sin acceso admin adicional",
                              )}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {user.role === "owner"
                            ? `${user.effectiveCapabilities.length} capacidades resueltas automáticamente`
                            : `${user.effectiveCapabilities.length} capacidades efectivas`}
                        </div>
                      </td>
                    ) : null}
                    {visibleColumns.lastLogin ? (
                      <td className={`${cellClassName} text-slate-200`}>
                        {formatDate(user.lastLoginAt)}
                      </td>
                    ) : null}
                    <td className={`${cellClassName} text-right`}>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditor(user)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                        >
                          {currentAdmin.canManageUsers || currentAdmin.canManageOrgMembers
                            ? "Gestionar"
                            : "Ver"}
                        </button>
                        {currentAdmin.canManageUsers &&
                        !user.isRootAdmin &&
                        !user.isActive ? (
                          <button
                            type="button"
                            disabled={deletingId === user.id}
                            onClick={() => deleteUser(user.id, user.email)}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!pageRows.length ? (
                  <tr>
                    <td className="p-4 text-slate-300" colSpan={8}>
                      Sin resultados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-sm text-slate-400">
            La tabla está contraída. Puedes volver a abrirla desde el encabezado del módulo.
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400">
          <div>
            Página {currentPage} de {totalPages} ({filtered.length} usuarios)
            {selectedIds.length ? ` · ${selectedIds.length} seleccionados` : ""}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                prefs.patchState({ page: Math.max(1, currentPage - 1) })
              }
              disabled={currentPage <= 1}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() =>
                prefs.patchState({ page: Math.min(totalPages, currentPage + 1) })
              }
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      <AdminDialogShell
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={
          currentAdmin.canManageUsers || currentAdmin.canManageOrgMembers
            ? "Gestionar usuario"
            : "Detalle de usuario"
        }
        description="Distingue el rol del sistema, el acceso admin adicional y el acceso visual especial."
        kicker="Usuarios"
        size="xl"
      >
        {editing && formState ? (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
              <div className="font-semibold text-slate-100">{editing.email}</div>
              <div className="mt-1 text-xs text-slate-400">
                Creado: {formatDate(editing.createdAt)} · Último acceso: {formatDate(editing.lastLoginAt)}
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                  <div className="uppercase tracking-[0.22em] text-slate-500">Rol del sistema</div>
                  <div className="mt-2 font-semibold text-slate-100">
                    {editing.systemRoleLabel}
                  </div>
                  <div className="mt-1 text-slate-400">{editing.systemRoleDescription}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                  <div className="uppercase tracking-[0.22em] text-slate-500">Acceso admin</div>
                  <div className="mt-2 font-semibold text-slate-100">
                    {editing.role === "owner"
                      ? "Acceso total"
                      : summarizeLabels(
                          editing.effectiveCapabilities.map(getAdminCapabilityLabel),
                          "Sin acceso adicional",
                        )}
                  </div>
                  <div className="mt-1 text-slate-400">
                    {editing.role === "owner"
                      ? "Hereda todas las capacidades admin automáticamente."
                      : "Se resuelve desde el rol base y los overrides activos."}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                  <div className="uppercase tracking-[0.22em] text-slate-500">Acceso visual</div>
                  <div className="mt-2 font-semibold text-slate-100">
                    {summarizeLabels(
                      editing.userCapabilities.map(getVisualCapabilityLabel),
                      "Sin acceso visual especial",
                    )}
                  </div>
                  <div className="mt-1 text-slate-400">
                    Solo controla visibilidad de CTAs o bloques públicos.
                  </div>
                </div>
              </div>
            </div>

            {ownerReadOnly ? (
              <div className="rounded-2xl border border-emerald-500/25 bg-blue-950/20 px-4 py-3 text-sm text-emerald-100">
                Esta cuenta <code>Owner</code> queda en modo solo lectura. Su acceso admin siempre
                resuelve a todas las capacidades y aquí no se permiten cambios de rol,
                activación, membresías, overrides ni acceso visual.
              </div>
            ) : null}

            {isEditingSelf && currentAdminIsOwner ? (
              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                Estás editando tu propia cuenta <code>Owner</code>. Conserva acceso total
                y no puede perder el rol <code>Owner</code> ni desactivarse.
              </div>
            ) : null}

            {lockSelfPrivilegeControls ? (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                No puedes autoelevarte ni editar tus propios privilegios desde esta pantalla.
                Solo una cuenta <code>Owner</code> puede modificar su propio rol,
                overrides o permisos visuales.
              </div>
            ) : null}

            {editing.internalUserCapabilities.length ? (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Este usuario conserva banderas internas heredadas que ya no se administran
                desde esta pantalla. Permanecerán intactas aunque guardes otros cambios.
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                Rol del sistema
                <select
                  value={formState.role}
                  disabled={disableRoleAndPrivilegeControls}
                  onChange={(e) =>
                    setFormState((prev) =>
                      prev ? { ...prev, role: e.target.value } : prev,
                    )
                  }
                  className="ui-control"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {selectedRoleOption?.description ? (
                  <span className="text-xs text-slate-400">
                    {selectedRoleOption.description}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm">
                Estado
                <select
                  value={String(formState.isActive)}
                  disabled={ownerReadOnly || !currentAdmin.canManageUsers}
                  onChange={(e) =>
                    setFormState((prev) =>
                      prev ? { ...prev, isActive: e.target.value === "true" } : prev,
                    )
                  }
                  className="ui-control"
                >
                  <option value="true">Activo</option>
                  <option value="false">Desactivado</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Organizaciones</div>
                  <div className="text-xs text-slate-400">
                    Gestiona membresías sin depender de una invitación nueva.
                  </div>
                </div>
                {currentAdmin.canManageOrgMembers && !ownerReadOnly ? (
                  <button
                    type="button"
                    onClick={addMembership}
                    className="rounded-full border border-blue-900/40 bg-blue-950/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-blue-950/30"
                  >
                    + Añadir membresía
                  </button>
                ) : null}
              </div>

              {formState.memberships.length ? (
                <div className="grid gap-3">
                  {formState.memberships.map((membership, index) => (
                    <div
                      key={`${membership.organizationId}-${index}`}
                      className="grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]"
                    >
                      <label className="grid gap-2 text-sm">
                        Organización
                        <select
                          value={membership.organizationId}
                          disabled={
                            ownerReadOnly || !currentAdmin.canManageOrgMembers
                          }
                          onChange={(e) =>
                            updateMembership(index, "organizationId", e.target.value)
                          }
                          className="ui-control"
                        >
                          <option value="">Selecciona organización</option>
                          {organizations.map((organization) => (
                            <option key={organization.id} value={organization.id}>
                              {organization.displayName}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm">
                        Rol en organización
                        <select
                          value={membership.role}
                          disabled={
                            ownerReadOnly || !currentAdmin.canManageOrgMembers
                          }
                          onChange={(e) => updateMembership(index, "role", e.target.value)}
                          className="ui-control"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          <option value="owner">Owner</option>
                        </select>
                      </label>

                      {currentAdmin.canManageOrgMembers && !ownerReadOnly ? (
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeMembership(index)}
                            className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 transition hover:bg-red-500/20"
                          >
                            Quitar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400">Sin membresías asignadas.</div>
              )}
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/25 p-4">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  Acceso admin adicional
                </div>
                <div className="text-xs text-slate-400">
                  Se usa sólo para excepciones puntuales sobre el rol base. No reemplaza
                  la gobernanza del rol del sistema y no aplica para <code>Owner</code>.
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {capabilityCatalog.map((item) => {
                  const checked = formState.capabilityOverrides.some(
                    (override) => override.capability === item.key,
                  );
                  return (
                    <label
                      key={item.key}
                      className="grid gap-1 rounded-2xl border border-white/10 bg-black/15 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disableRoleAndPrivilegeControls}
                          onChange={() => toggleCapability(item.key)}
                        />
                        <span className="text-sm font-semibold text-slate-100">
                          {item.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">{item.description}</div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/25 p-4">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  Acceso visual especial
                </div>
                <div className="text-xs text-slate-400">
                  Sólo controla qué CTAs o bloques públicos ve el usuario. No concede
                  permisos administrativos, acceso interno ni tooling técnico.
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {userCapabilityCatalog.map((item) => {
                  const checked = (formState.userCapabilities ?? []).includes(item.key);
                  return (
                    <label
                      key={item.key}
                      className="grid gap-1 rounded-2xl border border-white/10 bg-black/15 p-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disableRoleAndPrivilegeControls}
                          onChange={() => {
                            setFormState((prev) => {
                              if (!prev) return prev;
                              const current = prev.userCapabilities ?? [];
                              return {
                                ...prev,
                                userCapabilities: checked
                                  ? current.filter((k) => k !== item.key)
                                  : [...current, item.key],
                              };
                            });
                          }}
                        />
                        <span className="text-sm font-semibold text-slate-100">
                          {item.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">{item.description}</div>
                    </label>
                  );
                })}
              </div>
            </div>

            {(currentAdmin.canManageUsers || currentAdmin.canManageOrgMembers) &&
            !ownerReadOnly ? (
              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-white/10 bg-slate-950/95 pt-4">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingId === editing.id}
                  onClick={() => void saveUser()}
                  className="rounded-full border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-100 transition hover:bg-blue-950/30 disabled:opacity-50"
                >
                  {savingId === editing.id ? "Guardando..." : "Guardar"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminDialogShell>
    </div>
  );
}
