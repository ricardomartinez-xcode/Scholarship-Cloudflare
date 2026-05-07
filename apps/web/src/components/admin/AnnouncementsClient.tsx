"use client";

import { useId, useState } from "react";

import AdminDialogShell from "@/components/admin/AdminDialogShell";
import CtaLocationPicker from "@/components/admin/CtaLocationPicker";
import { useAdminActionForm } from "@/components/admin/useAdminActionForm";
import AppSelect from "@/components/ui/AppSelect";
import { CTA_LOCATIONS } from "@/config/adminCatalogs";

type Announcement = {
  id: string;
  title: string;
  message: string;
  display: "banner" | "popout";
  location: (typeof CTA_LOCATIONS)[number]["value"];
  organizationId: string | null;
  onlyNewUsers: boolean;
  url: string | null;
  buttonLabel: string | null;
  isActive: boolean;
  sortOrder: number;
  variant: string | null;
  visibilityRule?: {
    sessionStartOnly?: boolean | null;
    maxViews?: number | null;
  } | null;
};

type OrganizationOption = { id: string; displayName: string };
type ActionResult = { ok: boolean; error?: string };

export default function AnnouncementsClient({
  announcements,
  organizations,
  upsertAnnouncementAction,
  deleteAnnouncementAction,
}: {
  announcements: Announcement[];
  organizations: OrganizationOption[];
  upsertAnnouncementAction: (formData: FormData) => Promise<ActionResult>;
  deleteAnnouncementAction: (formData: FormData) => Promise<void>;
}) {
  const displayId = useId();
  const activeId = useId();
  const onlyNewId = useId();
  const sessionStartId = useId();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [display, setDisplay] = useState<"banner" | "popout">("banner");
  const [location, setLocation] = useState<(typeof CTA_LOCATIONS)[number]["value"]>("HOME_PRIMARY");
  const [organizationId, setOrganizationId] = useState("");
  const [onlyNewUsers, setOnlyNewUsers] = useState("false");
  const [url, setUrl] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [sortOrder, setSortOrder] = useState("0");
  const [variant, setVariant] = useState("");
  const [sessionStartOnly, setSessionStartOnly] = useState("false");
  const [maxViews, setMaxViews] = useState("");

  const { handleSubmit, saveState, saving, clearSaveState } = useAdminActionForm(
    upsertAnnouncementAction,
    "No fue posible guardar el comunicado."
  );

  return (
    <section className="ui-admin-surface ui-card-pad">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">M3B</div>
          <h1 className="mt-1 text-lg font-semibold">Comunicados</h1>
          <p className="mt-1 text-sm text-slate-300">
            Configura mensajes visibles por ubicación, segmento y regla de aparición.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearSaveState();
            setEditing(null);
            setTitle("");
            setMessage("");
            setDisplay("banner");
            setLocation("HOME_PRIMARY");
            setOrganizationId("");
            setOnlyNewUsers("false");
            setUrl("");
            setButtonLabel("");
            setIsActive("true");
            setSortOrder("0");
            setVariant("");
            setSessionStartOnly("false");
            setMaxViews("");
            setOpen(true);
          }}
          className="ui-admin-action"
        >
          Nuevo comunicado
        </button>
      </div>

      <div className="grid gap-3">
        {announcements.length ? announcements.map((row) => (
          <div key={row.id} className="ui-admin-list-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">{row.title}</div>
                <div className="mt-1 text-sm text-slate-300">{row.message}</div>
                <div className="mt-2 text-xs text-slate-400">
                  {CTA_LOCATIONS.find((item) => item.value === row.location)?.label ?? row.location} · {row.display}
                  {row.onlyNewUsers ? " · solo nuevos usuarios" : ""}
                  {row.visibilityRule?.sessionStartOnly ? " · al iniciar sesión" : ""}
                  {row.visibilityRule?.maxViews ? ` · máximo ${row.visibilityRule.maxViews} vista(s)` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearSaveState();
                    setEditing(row);
                    setTitle(row.title);
                    setMessage(row.message);
                    setDisplay(row.display);
                    setLocation(row.location);
                    setOrganizationId(row.organizationId ?? "");
                    setOnlyNewUsers(row.onlyNewUsers ? "true" : "false");
                    setUrl(row.url ?? "");
                    setButtonLabel(row.buttonLabel ?? "");
                    setIsActive(row.isActive ? "true" : "false");
                    setSortOrder(String(row.sortOrder));
                    setVariant(row.variant ?? "");
                    setSessionStartOnly(row.visibilityRule?.sessionStartOnly ? "true" : "false");
                    setMaxViews(
                      row.visibilityRule?.maxViews ? String(row.visibilityRule.maxViews) : "",
                    );
                    setOpen(true);
                  }}
                  className="ui-admin-action ui-admin-action--secondary min-h-[34px] px-3 text-xs"
                >
                  Editar
                </button>
                <form action={deleteAnnouncementAction} onSubmit={(event) => { if (!window.confirm("¿Eliminar este comunicado?")) event.preventDefault(); }}>
                  <input type="hidden" name="id" value={row.id} />
                  <button type="submit" className="ui-admin-action ui-admin-action--danger min-h-[34px] px-3 text-xs">Eliminar</button>
                </form>
              </div>
            </div>
          </div>
        )) : (
          <div className="ui-admin-list-card text-sm text-slate-300">
            No hay comunicados configurados.
          </div>
        )}
      </div>

      <AdminDialogShell
        open={open}
        onOpenChange={setOpen}
        title="Comunicado"
        description="Configura visibilidad, ubicación y formato del comunicado."
        kicker="M3B"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          <input type="hidden" name="id" value={editing?.id ?? ""} />

          <label className="grid gap-2 text-sm">
            Título
            <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} className="ui-control" />
          </label>

          <label className="grid gap-2 text-sm">
            Mensaje
            <textarea name="message" value={message} onChange={(e) => setMessage(e.target.value)} className="ui-control min-h-[90px]" />
          </label>

          <div className="grid gap-2">
            <div className="text-sm">Ubicación</div>
            <CtaLocationPicker value={location} onChange={setLocation} />
            <input type="hidden" name="location" value={location} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <div id={displayId} className="text-sm">Visualización</div>
              <AppSelect
                labelId={displayId}
                placeholder="Selecciona..."
                value={display}
                onValueChange={(value) => setDisplay(value === "popout" ? "popout" : "banner")}
                options={[{ value: "banner", label: "Banner" }, { value: "popout", label: "Pop-out" }]}
              />
            </div>

            <label className="grid gap-2 text-sm">
              Organización
              <select
                name="organizationId"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="ui-control"
              >
                <option value="">Todas las organizaciones</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>{organization.displayName}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-2">
              <div id={onlyNewId} className="text-sm">Segmento</div>
              <AppSelect
                labelId={onlyNewId}
                placeholder="Selecciona..."
                value={onlyNewUsers}
                onValueChange={setOnlyNewUsers}
                options={[{ value: "false", label: "Todos" }, { value: "true", label: "Solo usuarios nuevos" }]}
              />
            </div>

            <label className="grid gap-2 text-sm">
              Orden
              <input name="sortOrder" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="ui-control" />
            </label>

            <label className="grid gap-2 text-sm">
              URL opcional
              <input name="url" value={url} onChange={(e) => setUrl(e.target.value)} className="ui-control" placeholder="/unidep o https://..." />
            </label>

            <label className="grid gap-2 text-sm">
              Texto del botón
              <input name="buttonLabel" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} className="ui-control" placeholder="Ver más" />
            </label>

            <label className="grid gap-2 text-sm">
              Variant
              <input name="variant" value={variant} onChange={(e) => setVariant(e.target.value)} className="ui-control" placeholder="primary" />
            </label>

            {display === "popout" ? (
              <>
                <div className="grid gap-2">
                  <div id={sessionStartId} className="text-sm">Aparición del pop-up</div>
                  <AppSelect
                    labelId={sessionStartId}
                    placeholder="Selecciona..."
                    value={sessionStartOnly}
                    onValueChange={setSessionStartOnly}
                    options={[
                      { value: "false", label: "Mostrar mientras siga activo" },
                      { value: "true", label: "Solo al iniciar sesión" },
                    ]}
                  />
                </div>

                <label className="grid gap-2 text-sm">
                  Límite de apariciones
                  <input
                    name="maxViews"
                    type="number"
                    min="1"
                    value={maxViews}
                    onChange={(e) => setMaxViews(e.target.value)}
                    className="ui-control"
                    placeholder="Sin límite"
                  />
                </label>
              </>
            ) : null}

            <div className="grid gap-2">
              <div id={activeId} className="text-sm">Estado</div>
              <AppSelect
                labelId={activeId}
                placeholder="Selecciona..."
                value={isActive}
                onValueChange={setIsActive}
                options={[{ value: "true", label: "Activo" }, { value: "false", label: "Desactivado" }]}
              />
            </div>
          </div>

          <input type="hidden" name="display" value={display} />
          <input type="hidden" name="isActive" value={isActive} />
          <input type="hidden" name="onlyNewUsers" value={onlyNewUsers} />
          <input type="hidden" name="sessionStartOnly" value={sessionStartOnly} />
          <input type="hidden" name="maxViews" value={maxViews} />

          {saveState?.error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{saveState.error}</div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="ui-admin-action disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar comunicado"}
          </button>
        </form>
      </AdminDialogShell>
    </section>
  );
}
