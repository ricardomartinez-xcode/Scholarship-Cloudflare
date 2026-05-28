"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import AdminDataTable from "@/components/admin/AdminDataTable";
import AdminDialogShell from "@/components/admin/AdminDialogShell";
import AdminRowActions from "@/components/admin/AdminRowActions";
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
  const router = useRouter();
  const activeId = useId();
  const fieldId = useId();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [isDeleting, startDeleteTransition] = useTransition();

  const { handleSubmit, saveState, saving, clearSaveState } =
    useAdminActionForm(
      upsertSidebarInfoAction,
      "No fue posible guardar la información.",
    );

  useEffect(() => {
    if (!saveState?.ok) return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setEditing(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [saveState?.ok]);

  const knownKeys = new Set<string>(SIDEBAR_FIELDS.map((field) => field.key));
  const fieldOrder = new Map<string, number>(
    SIDEBAR_FIELDS.map((field) => [field.key, field.sortOrder]),
  );
  const knownRows = rows
    .filter((row) => knownKeys.has(row.key))
    .sort(
      (a, b) =>
        (fieldOrder.get(a.key) ?? 999) - (fieldOrder.get(b.key) ?? 999),
    );
  const unknownCount = rows.filter(
    (row) => !knownKeys.has(row.key) && !row.key.startsWith("extension_panel."),
  ).length;

  const selectedField = SIDEBAR_FIELDS.find((field) => field.key === key) ?? null;

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

  function handleDelete(row: Row) {
    if (!window.confirm("¿Eliminar este dato público?")) return;

    const formData = new FormData();
    formData.set("id", row.id);
    startDeleteTransition(async () => {
      await deleteSidebarInfoAction(formData);
      router.refresh();
    });
  }

  return (
    <section className="rounded-[26px] border border-[#c8d6e2] bg-white p-4 shadow-[0_16px_50px_rgb(16_32_42/0.06)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
            Contacto público
          </div>
          <h1 className="mt-1 text-xl font-black tracking-[-0.035em] text-[#102838]">
            Información pública del inicio
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#536a7c]">
            Edita la columna lateral de contacto y orientación que vive a la
            derecha del home. Las acciones de fila se compactan para mantener
            la tabla limpia.
          </p>
        </div>

        <button
          type="button"
          onClick={startCreate}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-4 text-sm font-extrabold text-white transition hover:bg-[#0b3d56]"
        >
          Nuevo
        </button>
      </div>

      {unknownCount ? (
        <div className="mt-4 rounded-[18px] border border-[#0f4c6b]/20 bg-[#0f4c6b]/10 px-4 py-3 text-sm font-semibold text-[#0f4c6b]">
          Hay {unknownCount} registro(s) con keys no soportadas. No se muestran
          para evitar romper el render público.
        </div>
      ) : null}

      <div className="mt-5">
        <AdminDataTable
          title="Campos publicados"
          count={knownRows.length}
          description="Teléfono, correo, WhatsApp, dirección, horarios y enlaces usados en el home público."
          maxHeight="560px"
        >
          <table>
            <thead>
              <tr>
                <th>Campo</th>
                <th>Contenido visible</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {knownRows.map((row) => {
                const fieldLabel =
                  SIDEBAR_FIELDS.find((field) => field.key === row.key)?.label ??
                  row.key;

                return (
                  <tr key={row.id}>
                    <td>
                      <div className="font-extrabold text-[#102838]">
                        {fieldLabel}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-[#536a7c]">
                        {row.key}
                      </div>
                    </td>
                    <td>
                      <span
                        className="block max-w-[520px] truncate text-[#163247]"
                        title={row.value}
                      >
                        {row.value}
                      </span>
                    </td>
                    <td>
                      <span
                        className={[
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold",
                          row.isActive
                            ? "border-[#0c5f3a]/20 bg-[#ddf8ea] text-[#0c5f3a]"
                            : "border-[#8a2d2d]/20 bg-[#fde7e7] text-[#8a2d2d]",
                        ].join(" ")}
                      >
                        {row.isActive ? "Activo" : "Desactivado"}
                      </span>
                    </td>
                    <td>
                      <AdminRowActions
                        actions={[
                          {
                            type: "edit",
                            label: `Editar ${fieldLabel}`,
                            onClick: () => startEdit(row),
                            tone: "primary",
                          },
                          {
                            type: "delete",
                            label: `Eliminar ${fieldLabel}`,
                            onClick: () => handleDelete(row),
                            tone: "danger",
                            disabled: isDeleting,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
              {!knownRows.length ? (
                <tr>
                  <td colSpan={4}>
                    <div className="rounded-[18px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-6 text-sm text-[#536a7c]">
                      No hay información configurada. Crea el primer campo para
                      comenzar a poblar la columna pública del home.
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </AdminDataTable>
      </div>

      <AdminDialogShell
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) clearSaveState();
        }}
        kicker={editing ? "Editar" : "Nuevo"}
        title="Información pública"
        description="Gestiona teléfono, correo, WhatsApp, dirección y horarios de la columna pública del inicio."
        size="xl"
      >
        {saveState?.ok === false && saveState.error ? (
          <div className="mb-4 rounded-[18px] border border-[#8a2d2d]/20 bg-[#fde7e7] px-4 py-2 text-sm font-semibold text-[#8a2d2d]">
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
            <div id={fieldId} className="text-sm font-bold text-[#163247]">
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
            <div className="text-xs font-semibold text-[#536a7c]">
              {selectedField?.description ?? ""}
            </div>
          </div>

          <label className="grid gap-2 text-sm font-bold text-[#163247]">
            Contenido
            {selectedField?.inputType === "textarea" ? (
              <textarea
                name="value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="ui-control min-h-[100px]"
                placeholder="Contenido"
              />
            ) : (
              <input
                name="value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
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
            <div id={activeId} className="text-sm font-bold text-[#163247]">
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

          <div className="sticky bottom-0 z-10 -mx-1 bg-white/95 px-1 pt-3">
            <button
              type="submit"
              disabled={saving || !key}
              className="w-full rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#0b3d56] disabled:border-[#c8d6e2] disabled:bg-[#e5ebef] disabled:text-[#647684]"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </AdminDialogShell>
    </section>
  );
}
