"use client";

import { useMemo, useState } from "react";

import {
  downloadCsv,
  type AdminTableDensity,
} from "@/components/admin/admin-table-utils";
import { useAdminUiPreferences } from "@/components/admin/useAdminUiPreferences";

type Team = {
  id: string;
  display_name: string;
  created_at_millis: number;
  memberCount?: number;
};

type ApiResult = {
  ok: boolean;
  error?: string;
  code?: string;
  requestId?: string;
  updatedCount?: number;
  teams?: Team[];
  team?: Team;
  missing?: string[];
};

type OrganizationsPreferenceState = {
  query: string;
  page: number;
  tableExpanded: boolean;
  density: AdminTableDensity;
  visibleColumns: Record<string, boolean>;
};

const PAGE_SIZE = 10;
const ORGANIZATION_COLUMNS = ["name", "memberCount", "createdAt"] as const;

const ORGANIZATIONS_DEFAULTS: OrganizationsPreferenceState = {
  query: "",
  page: 1,
  tableExpanded: true,
  density: "comfortable",
  visibleColumns: {
    name: true,
    memberCount: true,
    createdAt: true,
  },
};

async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T & { requestId?: string }> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new Error("Error de red. Verifica tu conexión e intenta de nuevo.");
  }
  const data = (await res.json()) as ApiResult;
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `Error HTTP ${res.status}`);
  }
  return data as unknown as T & { requestId?: string };
}

function normalizeOrganizationName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getOrganizationNameError(value: string) {
  if (!value) return "El nombre es obligatorio.";
  if (value.length < 3) return "Usa al menos 3 caracteres para distinguir la organización.";
  if (value.length > 80) return "Usa máximo 80 caracteres.";
  return null;
}

export default function OrganizationsClient({
  currentAdmin,
  initialTeams,
  configError,
}: {
  currentAdmin: {
    canManageOrganizations: boolean;
  };
  initialTeams: Team[];
  configError?: string | null;
}) {
  const prefs = useAdminUiPreferences("ORGANIZATIONS", ORGANIZATIONS_DEFAULTS);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(configError ?? "");
  const [deletingScope, setDeletingScope] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = prefs.state.query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((team) =>
      [team.display_name, String(team.memberCount ?? 0)].join(" ").toLowerCase().includes(q),
    );
  }, [prefs.state.query, teams]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(prefs.state.page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  const selectedRows = filtered.filter((team) => selectedIds.includes(team.id));
  const allVisibleSelected =
    pageRows.length > 0 && pageRows.every((team) => selectedIds.includes(team.id));
  const compact = prefs.state.density === "compact";
  const cellClassName = compact ? "p-2" : "p-3";
  const visibleColumns = prefs.state.visibleColumns;

  const createName = normalizeOrganizationName(newName);
  const createNameError = getOrganizationNameError(createName);

  async function reload() {
    setLoading(true);
    try {
      const data = await apiFetch<ApiResult>("/api/admin/organizations", {
        cache: "no-store",
      });
      const nextTeams = data.teams ?? [];
      setTeams(nextTeams);
      setSelectedIds((current) =>
        current.filter((id) => nextTeams.some((team) => team.id === id)),
      );
      setMessage("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al cargar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!currentAdmin.canManageOrganizations || createNameError) {
      setMessage(createNameError ?? "No tienes permiso para crear organizaciones.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await apiFetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: createName }),
      });
      setNewName("");
      setMessage("Organización creada.");
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al crear.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    const normalizedEditName = normalizeOrganizationName(editName);
    const validationError = getOrganizationNameError(normalizedEditName);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setEditSaving(true);
    setMessage("");
    try {
      await apiFetch("/api/admin/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, displayName: normalizedEditName }),
      });
      setEditingId(null);
      setEditName("");
      setMessage("Organización actualizada.");
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al actualizar.");
    } finally {
      setEditSaving(false);
    }
  }

  async function deactivateOrganizations(ids: string[], confirmationLabel: string) {
    if (!ids.length) return;
    const confirmed = window.confirm(confirmationLabel);
    if (!confirmed) return;
    setDeletingScope(ids.length === 1 ? ids[0] : "bulk");
    setMessage("");
    try {
      const result = await apiFetch<ApiResult>("/api/admin/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setEditingId((current) => (current && ids.includes(current) ? null : current));
      setMessage(
        ids.length === 1
          ? "Organización desactivada."
          : `Se desactivaron ${result.updatedCount ?? ids.length} organizaciones.`,
      );
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al desactivar.");
    } finally {
      setDeletingScope(null);
    }
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

  function exportRows(rows: Team[]) {
    downloadCsv(
      "admin-organizations.csv",
      rows.map((team) => ({
        name: team.display_name,
        members: team.memberCount ?? 0,
        createdAt: new Date(team.created_at_millis).toLocaleDateString("es-MX", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        id: team.id,
      })),
    );
  }

  const hasConfigError = Boolean(configError);

  return (
    <section className="ui-card ui-card-pad">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
            M8
          </div>
          <h1 className="mt-1 text-lg font-semibold">Organizaciones</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">
            Gestiona organizaciones operativas. Desactivar una organización evita nuevas
            asignaciones en invitaciones, pero conserva historial de membresías y auditoría.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading || hasConfigError}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-60"
          >
            {loading ? "Actualizando..." : "Recargar"}
          </button>
        </div>
      </div>

      {hasConfigError ? (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
            Error
          </div>
          <p className="mt-2">{configError}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4 text-sm text-sky-100">
            <div className="text-xs uppercase tracking-[0.24em] text-sky-200">
              Ayuda contextual
            </div>
            <p className="mt-2">
              Usa nombres operativos estables como campus, zona o unidad. Evita crear variantes
              mínimas del mismo nombre porque la validación bloqueará duplicados activos.
            </p>
          </div>

          <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4 lg:grid-cols-[1fr_auto]">
            <label className="grid gap-2 text-sm">
              Nombre de la organización
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="ui-control"
                placeholder="Ej. Campus Monterrey, Zona Norte"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleCreate();
                }}
              />
              <span className="text-xs text-slate-500">
                El nombre se normaliza antes de guardar y debe ser único entre organizaciones activas.
              </span>
            </label>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving || Boolean(createNameError) || !currentAdmin.canManageOrganizations}
              className="self-end rounded-2xl bg-blue-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-60"
            >
              {saving ? "Creando..." : "Crear organización"}
            </button>
          </div>

          {createNameError && newName.trim() ? (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {createNameError}
            </div>
          ) : null}
        </>
      )}

      {message ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100">
          {message}
        </div>
      ) : null}

      {!hasConfigError ? (
        <>
          <div className="ui-toolbar mt-6">
            <label className="grid gap-1 text-xs text-slate-400">
              Buscar organización o tamaño
              <input
                value={prefs.state.query}
                onChange={(event) =>
                  prefs.patchState({ query: event.target.value, page: 1 })
                }
                className="ui-control w-full sm:min-w-[220px]"
                placeholder="Nombre de organización"
              />
            </label>
            <div className="text-xs text-slate-400">{filtered.length} organizaciones</div>
          </div>

          <div className="ui-scrollbar mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead className="bg-slate-950/40 text-slate-300">
                <tr>
                  <th className="p-3 text-left font-semibold">Nombre</th>
                  <th className="p-3 text-left font-semibold whitespace-nowrap w-[180px]">Creada</th>
                  <th className="p-3 text-right font-semibold w-[200px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((team) => (
                  <tr key={team.id} className="border-t border-white/10">
                    <td className="p-3 text-slate-100">
                      {editingId === team.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="ui-control min-w-[160px]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleUpdate(team.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => void handleUpdate(team.id)}
                            disabled={editSaving || !editName.trim()}
                            className="rounded-lg bg-blue-950 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {editSaving ? "..." : "Guardar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <span title={team.id}>{team.display_name}</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-200 whitespace-nowrap">
                      {new Date(team.created_at_millis).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-3 text-right">
                      {editingId !== team.id && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!currentAdmin.canManageOrganizations) return;
                              setEditingId(team.id);
                              setEditName(team.display_name);
                            }}
                            disabled={!currentAdmin.canManageOrganizations}
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void deactivateOrganizations(
                                [team.id],
                                `¿Desactivar la organización "${team.display_name}"? Esta acción conservará el historial pero impedirá nuevas asignaciones.`,
                              )
                            }
                            disabled={deletingScope === team.id || !currentAdmin.canManageOrganizations}
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
                          >
                            {deletingScope === team.id ? "..." : "Desactivar"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!pageRows.length ? (
                  <tr>
                    <td className="p-4 text-slate-300" colSpan={3}>
                      {teams.length === 0
                        ? "No hay organizaciones. Crea la primera."
                        : "Sin resultados."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Columnas visibles
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    La configuración se guarda por usuario y módulo.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ORGANIZATION_COLUMNS.map((column) => (
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

              <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="grid gap-1 text-xs text-slate-400">
                Buscar organización o tamaño
                <input
                  value={prefs.state.query}
                  onChange={(event) =>
                    prefs.patchState({ query: event.target.value, page: 1 })
                  }
                  className="ui-control w-full sm:min-w-[240px]"
                  placeholder="Nombre de organización"
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
              {currentAdmin.canManageOrganizations ? (
                <button
                  type="button"
                  disabled={!selectedIds.length || deletingScope !== null}
                  onClick={() =>
                    void deactivateOrganizations(
                      selectedIds,
                      `¿Desactivar ${selectedIds.length} organización(es)? Las invitaciones futuras dejarán de poder asignarlas.`,
                    )
                  }
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-50"
                >
                  Desactivar lote
                </button>
              ) : null}
              <div className="text-xs text-slate-400">
                {filtered.length} organizaciones
                {selectedIds.length ? ` · ${selectedIds.length} seleccionadas` : ""}
              </div>
            </div>
          </div>

            </>
          )}

          {prefs.state.tableExpanded ? (
            <div className="ui-scrollbar mt-4 overflow-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-950/95 text-slate-300 backdrop-blur">
                  <tr>
                    <th className={`${cellClassName} w-[56px] text-center font-semibold`}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectVisible}
                      />
                    </th>
                    {visibleColumns.name ? (
                      <th className={`${cellClassName} text-left font-semibold`}>
                        Nombre
                      </th>
                    ) : null}
                    {visibleColumns.memberCount ? (
                      <th className={`${cellClassName} w-[120px] text-center font-semibold`}>
                        Miembros
                      </th>
                    ) : null}
                    {visibleColumns.createdAt ? (
                      <th className={`${cellClassName} w-[180px] text-left font-semibold`}>
                        Creada
                      </th>
                    ) : null}
                    <th className={`${cellClassName} w-[220px] text-right font-semibold`}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((team) => {
                    const isDeleting =
                      deletingScope === team.id || deletingScope === "bulk";
                    return (
                      <tr key={team.id} className="border-t border-white/10 align-top">
                        <td className={`${cellClassName} text-center`}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(team.id)}
                            onChange={() => toggleSelectOne(team.id)}
                          />
                        </td>
                        {visibleColumns.name ? (
                          <td className={`${cellClassName} text-slate-100`}>
                            {editingId === team.id ? (
                              <div className="grid gap-2">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(event) => setEditName(event.target.value)}
                                  className="ui-control min-w-[220px]"
                                  autoFocus
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") void handleUpdate(team.id);
                                    if (event.key === "Escape") {
                                      setEditingId(null);
                                      setEditName("");
                                    }
                                  }}
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleUpdate(team.id)}
                                    disabled={
                                      editSaving ||
                                      Boolean(
                                        getOrganizationNameError(
                                          normalizeOrganizationName(editName),
                                        ),
                                      ) ||
                                      !currentAdmin.canManageOrganizations
                                    }
                                    className="rounded-lg bg-blue-950 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                                  >
                                    {editSaving ? "Guardando..." : "Guardar"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditName("");
                                    }}
                                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-medium">{team.display_name}</div>
                                <div className="text-xs text-slate-500">{team.id}</div>
                              </div>
                            )}
                          </td>
                        ) : null}
                        {visibleColumns.memberCount ? (
                          <td className={`${cellClassName} text-center text-slate-200`}>
                            {team.memberCount ?? 0}
                          </td>
                        ) : null}
                        {visibleColumns.createdAt ? (
                          <td className={`${cellClassName} whitespace-nowrap text-slate-200`}>
                            {new Date(team.created_at_millis).toLocaleDateString("es-MX", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                        ) : null}
                        <td className={`${cellClassName} text-right`}>
                          {editingId !== team.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!currentAdmin.canManageOrganizations) return;
                                  setEditingId(team.id);
                                  setEditName(team.display_name);
                                }}
                                disabled={!currentAdmin.canManageOrganizations || deletingScope !== null}
                                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void deactivateOrganizations(
                                    [team.id],
                                    `¿Desactivar la organización "${team.display_name}"? Esta acción conservará el historial pero impedirá nuevas asignaciones.`,
                                  )
                                }
                                disabled={isDeleting || !currentAdmin.canManageOrganizations}
                                className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
                              >
                                {isDeleting ? "..." : "Desactivar"}
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  {!pageRows.length ? (
                    <tr>
                      <td className="p-4 text-slate-300" colSpan={5}>
                        {teams.length === 0
                          ? "No hay organizaciones. Crea la primera."
                          : "Sin resultados."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-sm text-slate-400">
              La tabla está contraída. Puedes volver a abrirla desde el encabezado del módulo.
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
            <div>
              Página {currentPage} de {totalPages}
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
        </>
      ) : null}
    </section>
  );
}
