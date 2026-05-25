"use client";

import { useEffect, useId, useState } from "react";

import AdminDialogShell from "@/components/admin/AdminDialogShell";
import { useAdminActionForm } from "@/components/admin/useAdminActionForm";
import AppSelect from "@/components/ui/AppSelect";
import { SIDEBAR_FIELDS } from "@/config/adminCatalogs";

type Row = {
  id: string;
  key: string;
  value: string;
  isActive: boolean;
};

type ActionResult = { ok: boolean; error?: string };

export default function SidebarInfoClient({
  rows,
  upsertSidebarInfoAction,
  deleteSidebarInfoAction,
}: {
  rows: Row[];
  upsertSidebarInfoAction: (formData: FormData) => Promise<ActionResult>;
  deleteSidebarInfoAction: (formData: FormData) => Promise<void>;
}) {
  const activeId = useId();
  const fieldId = useId();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [isActive, setIsActive] = useState("true");

  const { handleSubmit, saveState, saving, clearSaveState } = useAdminActionForm(
    upsertSidebarInfoAction,
    "No fue posible guardar la información."
  );

  useEffect(() => {
    if (!saveState?.ok) return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setEditing(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [saveState?.ok]);

  function startCreate() {
    clearSaveState();
    setEditing(null);
    setKey("");
    setValue("");
    setIsActive("true");
    setOpen(true);
  }

  function startEdit(row: Row) {
    clearSaveState();
    setEditing(row);
    setKey(row.key ?? "");
    setValue(row.value ?? "");
    setIsActive(row.isActive ? "true" : "false");
    setOpen(true);
  }

  const knownKeys = new Set<string>(SIDEBAR_FIELDS.map((field) => field.key));
  const fieldOrder = new Map<string, number>(
    SIDEBAR_FIELDS.map((field) => [field.key, field.sortOrder])
  );
  const knownRows = rows
    .filter((row) => knownKeys.has(row.key))
    .sort((a, b) => (fieldOrder.get(a.key) ?? 999) - (fieldOrder.get(b.key) ?? 999));
  const unknownCount = rows.filter((row) => !knownKeys.has(row.key) && !row.key.startsWith("extension_panel.")).length;

  const selectedField = SIDEBAR_FIELDS.find((field) => field.key === key) ?? null;

  function pickField(nextKey: string) {
    setKey(nextKey);
    const existing = rows.find((row) => row.key === nextKey) ?? null;
    if (existing) {
      setEditing(existing);
      setValue(existing.value ?? "");
      setIsActive(existing.isActive ? "true" : "false");
      return;
    }
    setEditing(null);
    setValue("");
    setIsActive("true");
  }

  return (
    <section className="ui-card ui-card-pad">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Contacto publico
          </div>
          <h1 className="mt-1 text-lg font-semibold">Informacion publica del inicio</h1>
          <p className="mt-1 text-sm text-slate-300">
            Edita la columna lateral de contacto y orientacion que vive a la derecha del home.
          </p>
        </div>

        <button
          type="button"
          onClick={startCreate}
          className="rounded-2xl bg-blue-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
        >
          Nuevo
        </button>
      </div>

      {unknownCount ? (
        <div className="mt-4 rounded-2xl border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
          Hay {unknownCount} registro(s) con keys no soportadas. No se muestran
          para evitar romper el render publico.
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[520px] md:min-w-[620px] border-collapse text-sm">
          <thead className="bg-slate-950/40 text-slate-300">
            <tr>
              <th className="p-3 text-left font-semibold">Campo</th>
              <th className="p-3 text-left font-semibold">Contenido visible</th>
              <th className="p-3 text-left font-semibold">Estado</th>
              <th className="p-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {knownRows.length ? (
              knownRows.map((row) => (
                <tr key={row.id} className="border-t border-white/10">
                  <td className="p-3 text-slate-100">
                    {SIDEBAR_FIELDS.find((field) => field.key === row.key)?.label ?? row.key}
                  </td>
                  <td className="p-3 text-slate-200">
                    <span className="inline-block max-w-[520px] truncate">
                      {row.value}
                    </span>
                  </td>
                  <td className="p-3 text-slate-100">
                    {row.isActive ? "Activo" : "Desactivado"}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="rounded-xl border border-white/10 bg-white/0 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                      >
                        Editar
                      </button>
                      <form action={deleteSidebarInfoAction} onSubmit={(e) => { if (!window.confirm("¿Eliminar este dato?")) e.preventDefault(); }}>
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                        >
                          Eliminar
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-6 text-slate-300" colSpan={4}>
                  No hay información configurada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminDialogShell
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            clearSaveState();
          }
        }}
        kicker={editing ? "Editar" : "Nuevo"}
        title="Informacion publica"
        description="Gestiona telefono, correo, WhatsApp, direccion y horarios de la columna publica del inicio."
        size="xl"
      >
        {saveState?.ok === false && saveState.error ? (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {saveState.error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
              <input type="hidden" name="id" value={editing?.id ?? ""} />
              <input type="hidden" name="key" value={key} />
              <input
                type="hidden"
                name="inputType"
                value={selectedField?.inputType ?? "text"}
              />

              <div className="grid gap-2">
                <div id={fieldId} className="text-sm">
                  Campo de contacto a modificar
                </div>
                <AppSelect
                  labelId={fieldId}
                  placeholder="Selecciona..."
                  value={key}
                  onValueChange={pickField}
                  options={[...SIDEBAR_FIELDS]
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((field) => ({ value: field.key, label: field.label }))}
                />
                <div className="text-xs text-slate-400">
                  {selectedField?.description ?? ""}
                </div>
              </div>

              <label className="grid gap-2 text-sm">
                Contenido
                {selectedField?.inputType === "textarea" ? (
                  <textarea
                    name="value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="ui-control min-h-[100px]"
                    placeholder="Contenido"
                  />
                ) : (
                  <input
                    name="value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="ui-control"
                    placeholder="Contenido"
                    type={
                      selectedField?.inputType === "email"
                        ? "email"
                        : selectedField?.inputType === "url"
                          ? "url"
                          : "text"
                    }
                  />
                )}
              </label>

              <div className="grid gap-2">
                <div id={activeId} className="text-sm">
                  Estado
                </div>
                <AppSelect
                  labelId={activeId}
                  placeholder="Selecciona..."
                  value={isActive}
                  onValueChange={setIsActive}
                  options={[
                    { value: "true", label: "Activo" },
                    { value: "false", label: "Desactivado" },
                  ]}
                />
              </div>
              <input type="hidden" name="isActive" value={isActive} />

              <div className="sticky bottom-0 z-10 -mx-1 bg-slate-950/95 px-1 pt-3">
                <button
                  type="submit"
                  disabled={saving || !key}
                  className="w-full rounded-2xl bg-blue-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
        </form>
      </AdminDialogShell>
    </section>
  );
}
