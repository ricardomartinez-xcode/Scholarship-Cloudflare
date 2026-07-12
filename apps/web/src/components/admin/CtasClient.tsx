"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Image from "next/image";
import type { Role, UserCapability } from "@prisma/client";

import AdminDialogShell from "@/components/admin/AdminDialogShell";
import { useAdminActionForm } from "@/components/admin/useAdminActionForm";
import AppSelect from "@/components/ui/AppSelect";
import CtaLocationPicker from "@/components/admin/CtaLocationPicker";
import { CTA_LOCATION_META, CTA_LOCATIONS } from "@/config/adminCatalogs";
import type { CtaActionConfig } from "@/lib/cta-action-config";
import type { PublicFileAssetPayload } from "@/lib/file-assets";

type CtaKind = "link" | "action";
type CtaLocation = (typeof CTA_LOCATIONS)[number]["value"];

type Cta = {
  id: string;
  label: string;
  kind: CtaKind;
  location: CtaLocation;
  url: string | null;
  isActive: boolean;
  sortOrder: number;
  variant: string | null;
  organizationId: string | null;
  onlyNewUsers: boolean;
  requiredCapability: UserCapability | null;
  excludeOrganizationIds: string[];
  excludeRoles: Role[];
  excludeCapabilities: UserCapability[];
  excludeUserIds: string[];
  actionConfig: CtaActionConfig | null;
};

type OrgOption = { id: string; displayName: string };
type CapabilityOption = { key: string; label: string };
type VisualCapabilityOption = { key: string; label: string; help: string };
type ActionConfigType = "" | "popup";

type FileUploadResponse =
  | {
      ok: true;
      asset: {
        id: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number | null;
      };
      uploadUrl: string;
      uploadHeaders?: Record<string, string>;
    }
  | { ok: false; error: string };

type FileCompleteResponse =
  | {
      ok: true;
      asset: {
        id: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number | null;
      };
    }
  | { ok: false; error: string };

function buildClientFileAssetLinks(fileId: string) {
  return {
    previewUrl: `/api/files/${fileId}/auth-view`,
    downloadUrl: `/api/files/${fileId}/download`,
  };
}

type ActionResult = { ok: boolean; error?: string };

const VISUAL_CAPABILITY_KEYS = ["user_vip", "access_admin_cta"] as const;
const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "admin_operativo", label: "Admin operativo" },
  { value: "editor_operativo", label: "Editor operativo" },
  { value: "user", label: "Usuario" },
];

const VISUAL_CAPABILITY_COPY: Record<
  (typeof VISUAL_CAPABILITY_KEYS)[number],
  { label: string; help: string }
> = {
  user_vip: {
    label: "Usuarios VIP",
    help: "Oculta o muestra el CTA solo para usuarios marcados como VIP.",
  },
  access_admin_cta: {
    label: "Usuarios con acceso al panel admin",
    help: "Util para CTA internos del panel; no concede acceso por si mismo.",
  },
};

export default function CtasClient({
  ctas,
  organizations,
  userCapabilityCatalog,
  upsertPublicCtaAction,
  deletePublicCtaAction,
}: {
  ctas: Cta[];
  organizations: OrgOption[];
  userCapabilityCatalog: CapabilityOption[];
  upsertPublicCtaAction: (formData: FormData) => Promise<ActionResult>;
  deletePublicCtaAction: (formData: FormData) => Promise<void>;
}) {
  const kindId = useId();
  const activeId = useId();
  const locationId = useId();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cta | null>(null);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<CtaKind>("link");
  const [location, setLocation] = useState<CtaLocation>("HOME_PRIMARY");
  const [url, setUrl] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [sortOrder, setSortOrder] = useState("0");
  const [variant, setVariant] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [onlyNewUsers, setOnlyNewUsers] = useState(false);
  const [requiredCapability, setRequiredCapability] = useState("");
  const [excludeOrganizationIds, setExcludeOrganizationIds] = useState<string[]>([]);
  const [excludeRoles, setExcludeRoles] = useState<Role[]>([]);
  const [excludeCapabilities, setExcludeCapabilities] = useState<string[]>([]);
  const [excludeUserIdsRaw, setExcludeUserIdsRaw] = useState("");
  const [actionConfigType, setActionConfigType] = useState<ActionConfigType>("");
  const [actionTitle, setActionTitle] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionTable, setActionTable] = useState("");
  const [actionImage, setActionImage] = useState<PublicFileAssetPayload | null>(null);
  const [actionImageError, setActionImageError] = useState("");
  const [uploadingActionImage, setUploadingActionImage] = useState(false);

  const { handleSubmit, saveState, saving, clearSaveState } = useAdminActionForm(
    upsertPublicCtaAction,
    "No fue posible guardar el CTA."
  );
  const capabilityLabelByKey = useMemo(
    () => new Map(userCapabilityCatalog.map((cap) => [cap.key, cap.label])),
    [userCapabilityCatalog]
  );
  const visualCapabilityCatalog = useMemo(() => {
    const filtered: VisualCapabilityOption[] = VISUAL_CAPABILITY_KEYS.filter((key) =>
      capabilityLabelByKey.has(key)
    ).map((key) => ({
      key,
      label: VISUAL_CAPABILITY_COPY[key].label,
      help: VISUAL_CAPABILITY_COPY[key].help,
    }));

    if (
      requiredCapability &&
      !filtered.some((cap) => cap.key === requiredCapability)
    ) {
      filtered.push({
        key: requiredCapability,
        label: `${capabilityLabelByKey.get(requiredCapability) ?? requiredCapability} (compatibilidad)`,
        help: "Filtro de compatibilidad. Conviene revisarlo y migrarlo a una regla visual vigente.",
      });
    }

    return filtered;
  }, [capabilityLabelByKey, requiredCapability]);
  const selectedLocationMeta = CTA_LOCATION_META[location];
  const selectedVisualCapability =
    visualCapabilityCatalog.find((cap) => cap.key === requiredCapability) ?? null;

  const excludedUserIds = useMemo(
    () =>
      Array.from(
        new Set(
          excludeUserIdsRaw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ),
    [excludeUserIdsRaw],
  );

  const toggleStringSelection = (
    currentValues: string[],
    nextValue: string,
    onChange: (nextValues: string[]) => void,
  ) => {
    if (currentValues.includes(nextValue)) {
      onChange(currentValues.filter((item) => item !== nextValue));
      return;
    }
    onChange([...currentValues, nextValue]);
  };

  const actionImagePayload = useMemo(
    () => (actionImage ? JSON.stringify(actionImage) : ""),
    [actionImage],
  );

  async function uploadActionImage(file: File | null) {
    if (!file) return;
    setActionImageError("");
    if (!file.type.startsWith("image/")) {
      setActionImageError("Selecciona una imagen PNG, JPG, WebP o GIF.");
      return;
    }

    setUploadingActionImage(true);
    try {
      const presignResponse = await fetch("/api/files/presigned-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      const presign = (await presignResponse.json()) as FileUploadResponse;
      if (!presign.ok) throw new Error(presign.error);

      const putResponse = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: presign.uploadHeaders ?? { "Content-Type": file.type },
        body: file,
      });
      if (!putResponse.ok) throw new Error("No fue posible subir la imagen a Storage.");

      const completeResponse = await fetch(`/api/files/${presign.asset.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etag: putResponse.headers.get("ETag") }),
      });
      const completed = (await completeResponse.json()) as FileCompleteResponse;
      if (!completed.ok) throw new Error(completed.error);

      const links = buildClientFileAssetLinks(completed.asset.id);
      setActionImage({
        fileId: completed.asset.id,
        fileName: completed.asset.fileName,
        mimeType: completed.asset.mimeType,
        sizeBytes: completed.asset.sizeBytes,
        previewUrl: links.previewUrl,
        downloadUrl: links.downloadUrl,
      });
    } catch (error) {
      setActionImageError(
        error instanceof Error ? error.message : "No fue posible subir la imagen.",
      );
    } finally {
      setUploadingActionImage(false);
    }
  }

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
    setLabel("");
    setKind("link");
    setLocation("HOME_PRIMARY");
    setUrl("");
    setIsActive("true");
    setSortOrder("0");
    setVariant("");
    setOrganizationId("");
    setOnlyNewUsers(false);
    setRequiredCapability("");
    setExcludeOrganizationIds([]);
    setExcludeRoles([]);
    setExcludeCapabilities([]);
    setExcludeUserIdsRaw("");
    setActionConfigType("");
    setActionTitle("");
    setActionMessage("");
    setActionTable("");
    setActionImage(null);
    setActionImageError("");
    setOpen(true);
  }

  function startEdit(c: Cta) {
    clearSaveState();
    setEditing(c);
    setLabel(c.label ?? "");
    setKind(c.kind ?? "link");
    setLocation(c.location ?? "HOME_PRIMARY");
    setUrl(c.url ?? "");
    setIsActive(c.isActive ? "true" : "false");
    setSortOrder(String(c.sortOrder ?? 0));
    setVariant(c.variant ?? "");
    setOrganizationId(c.organizationId ?? "");
    setOnlyNewUsers(c.onlyNewUsers ?? false);
    setRequiredCapability(c.requiredCapability ?? "");
    setExcludeOrganizationIds(c.excludeOrganizationIds ?? []);
    setExcludeRoles(c.excludeRoles ?? []);
    setExcludeCapabilities(c.excludeCapabilities ?? []);
    setExcludeUserIdsRaw((c.excludeUserIds ?? []).join(", "));
    setActionConfigType(c.actionConfig?.type === "popup" ? "popup" : "");
    setActionTitle(c.actionConfig?.title ?? "");
    setActionMessage(c.actionConfig?.message ?? "");
    setActionTable(
      c.actionConfig?.table
        ? [
            c.actionConfig.table.columns.join(" | "),
            ...c.actionConfig.table.rows.map((row) => row.join(" | ")),
          ].join("\n")
        : "",
    );
    setActionImage(c.actionConfig?.image ?? null);
    setActionImageError("");
    setOpen(true);
  }

  return (
    <section className="ui-admin-surface ui-card-pad">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
            M3
          </div>
          <h1 className="mt-1 text-lg font-semibold">CTAs en UI pública</h1>
        </div>

        <button
          type="button"
          onClick={startCreate}
          className="ui-admin-action"
        >
          Nuevo
        </button>
      </div>

      <div className="ui-admin-table-shell">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left font-semibold">CTA</th>
              <th className="p-3 text-left font-semibold">Mapa visual</th>
              <th className="p-3 text-left font-semibold">Comportamiento</th>
              <th className="p-3 text-left font-semibold">Visibilidad</th>
              <th className="p-3 text-left font-semibold">URL</th>
              <th className="p-3 text-left font-semibold">Orden</th>
              <th className="p-3 text-left font-semibold">Estado</th>
              <th className="p-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ctas.length ? (
              ctas.map((c) => (
                <tr key={c.id} className="border-t border-white/10">
                  <td className="p-3 text-slate-100">
                    <div className="font-semibold text-slate-100">{c.label}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {c.variant?.trim() ? `Estilo: ${c.variant}` : "Sin estilo visual adicional"}
                    </div>
                  </td>
                  <td className="p-3 text-slate-100">
                    <div className="font-medium text-slate-100">
                      {CTA_LOCATION_META[c.location].pageLabel}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {CTA_LOCATION_META[c.location].sectionLabel} · {CTA_LOCATION_META[c.location].slotLabel}
                    </div>
                  </td>
                  <td className="p-3 text-slate-100">
                    {c.kind === "action"
                      ? c.actionConfig
                        ? "Popup configurable"
                        : "Accion guiada"
                      : "Link / ruta"}
                  </td>
                  <td className="p-3 text-slate-200">
                    <div className="flex flex-wrap gap-2">
                      <span className="ui-admin-chip">
                        {c.organizationId
                          ? organizations.find((o) => o.id === c.organizationId)?.displayName ??
                            `${c.organizationId.slice(0, 8)}…`
                          : "Todas las organizaciones"}
                      </span>
                      {c.onlyNewUsers ? (
                        <span className="ui-admin-chip ui-admin-chip--warn">
                          Solo usuarios nuevos
                        </span>
                      ) : null}
                      {c.requiredCapability ? (
                        <span className="ui-admin-chip ui-admin-chip--accent">
                          {visualCapabilityCatalog.find((cap) => cap.key === c.requiredCapability)?.label ??
                            capabilityLabelByKey.get(c.requiredCapability) ??
                            c.requiredCapability}
                        </span>
                      ) : null}
                      {c.excludeOrganizationIds.length ? (
                        <span className="ui-admin-chip ui-admin-chip--danger">
                          Excepto orgs ({c.excludeOrganizationIds.length})
                        </span>
                      ) : null}
                      {c.excludeRoles.length ? (
                        <span className="ui-admin-chip ui-admin-chip--danger">
                          Excepto roles ({c.excludeRoles.length})
                        </span>
                      ) : null}
                      {c.excludeCapabilities.length ? (
                        <span className="ui-admin-chip ui-admin-chip--danger">
                          Excepto capabilities ({c.excludeCapabilities.length})
                        </span>
                      ) : null}
                      {c.excludeUserIds.length ? (
                        <span className="ui-admin-chip ui-admin-chip--danger">
                          Excepto usuarios ({c.excludeUserIds.length})
                        </span>
                      ) : null}
                      {!c.organizationId &&
                      !c.onlyNewUsers &&
                      !c.requiredCapability &&
                      c.excludeOrganizationIds.length === 0 &&
                      c.excludeRoles.length === 0 &&
                      c.excludeCapabilities.length === 0 &&
                      c.excludeUserIds.length === 0 ? (
                        <span className="ui-admin-chip">
                          Visible para todos
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-3 text-slate-200">{c.url ?? "-"}</td>
                  <td className="p-3 text-slate-100">{c.sortOrder}</td>
                  <td className="p-3 text-slate-100">
                    {c.isActive ? "Activo" : "Desactivado"}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="ui-admin-icon-action"
                        aria-label={`Editar CTA ${c.label}`}
                        title="Editar"
                      >
                        ✎
                      </button>
                      <form action={deletePublicCtaAction} onSubmit={(e) => { if (!window.confirm("¿Eliminar este CTA?")) e.preventDefault(); }}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="ui-admin-icon-action ui-admin-icon-action--danger"
                          aria-label={`Eliminar CTA ${c.label}`}
                          title="Eliminar"
                        >
                          ×
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-6 text-slate-300" colSpan={8}>
                  No hay CTAs configurados.
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
        title="CTA"
        description="Configura el CTA que se renderiza en la ubicación seleccionada de la app."
        size="xl"
      >
        {saveState?.ok === false && saveState.error ? (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {saveState.error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
              <input type="hidden" name="id" value={editing?.id ?? ""} />

              <div className="ui-admin-list-card">
          <label className="grid gap-2 text-sm">
            Texto visible del CTA
            <input
                  name="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="ui-control"
                  placeholder="Ej. Hablar con un asesor"
                />
          </label>

          <div className="rounded-2xl border border-[#D7E4ED] bg-[#F7FBFD] p-4 text-sm text-[#123348]">
            <div className="text-xs font-bold uppercase tracking-[0.1em] text-[#657D8F]">
              Vista real
            </div>
            <div className="mt-2 font-semibold">
              {selectedLocationMeta.pageLabel} · {selectedLocationMeta.sectionLabel}
            </div>
            <div className="mt-1 text-[#657D8F]">
              Slot: {selectedLocationMeta.slotLabel}. El CTA se pinta ahí si está activo y el
              usuario cumple la visibilidad configurada.
            </div>
          </div>

              <div className="grid gap-2">
                <div id={locationId} className="text-sm">
                  Mapa de ubicacion
                </div>
                <CtaLocationPicker
                  key={`${editing?.id ?? "new"}:${location}`}
                  value={location}
                  onChange={(nextValue) => setLocation(nextValue)}
                />
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-xs text-slate-300">
                Se vera en <span className="font-semibold text-slate-100">{selectedLocationMeta.pageLabel}</span>,
                {" "}
                seccion <span className="font-semibold text-slate-100">{selectedLocationMeta.sectionLabel}</span>,
                {" "}
                slot <span className="font-semibold text-slate-100">{selectedLocationMeta.slotLabel}</span>.
              </div>
              </div>
              <input type="hidden" name="location" value={location} />

              <div className="ui-admin-list-card">
              {kind === "link" ? (
                <label className="grid gap-2 text-sm">
                  URL
                  <input
                    name="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="ui-control"
                    placeholder="/unidep, /admin/oferta, https://..., mailto:..."
                  />
                </label>
              ) : (
                <label className="grid gap-2 text-sm">
                  URL (opcional)
                  <input
                    name="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="ui-control"
                    placeholder="/unidep, /admin/oferta, #calculadora, https://..."
                  />
                </label>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <div id={kindId} className="text-sm">
                    Tipo de CTA
                  </div>
                  <AppSelect
                    labelId={kindId}
                    placeholder="Selecciona..."
                    value={kind}
                    onValueChange={(nextValue) =>
                      setKind(nextValue === "action" ? "action" : "link")
                    }
                    options={[
                      { value: "link", label: "Link o ruta" },
                      { value: "action", label: "Accion guiada" },
                    ]}
                  />
                </div>

                <label className="grid gap-2 text-sm">
                  Orden
                  <input
                    name="sortOrder"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="ui-control"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  Estilo visual
                  <input
                    name="variant"
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    className="ui-control"
                    placeholder="primary | secondary | quiet"
                  />
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
              </div>

              {kind === "action" ? (
                <div className="grid gap-3 rounded-2xl border border-[#D7E4ED] bg-[#F7FBFD] p-4 text-sm text-[#123348]">
                  <div>
                    <div className="font-semibold text-[#123348]">
                      Acción configurable
                    </div>
                    <p className="mt-1 text-xs text-[#657D8F]">
                      Puedes mantener la acción por URL o mostrar una pantalla emergente con contenido editable.
                    </p>
                  </div>

                  <label className="grid gap-2">
                    Tipo de acción
                    <select
                      value={actionConfigType}
                      onChange={(event) =>
                        setActionConfigType(event.target.value === "popup" ? "popup" : "")
                      }
                      className="ui-control"
                    >
                      <option value="">Acción por URL / evento existente</option>
                      <option value="popup">Popup con información configurable</option>
                    </select>
                  </label>

                  {actionConfigType === "popup" ? (
                    <div className="grid gap-3">
                      <label className="grid gap-2">
                        Título del popup
                        <input
                          value={actionTitle}
                          onChange={(event) => setActionTitle(event.target.value)}
                          className="ui-control"
                          placeholder="Ej. Detalles de la promoción"
                        />
                      </label>

                      <label className="grid gap-2">
                        Mensaje
                        <textarea
                          value={actionMessage}
                          onChange={(event) => setActionMessage(event.target.value)}
                          className="ui-control min-h-[110px]"
                          placeholder="Texto breve para mostrar dentro del popup"
                        />
                      </label>

                      <div className="grid gap-2">
                        <div className="font-medium text-[#123348]">Imagen</div>
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="inline-flex cursor-pointer items-center rounded-full border border-[#B9CCD9] bg-white px-3 py-2 text-xs font-bold text-[#0F3C55]">
                            {uploadingActionImage ? "Subiendo..." : "Subir imagen Storage"}
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              disabled={uploadingActionImage}
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                void uploadActionImage(file);
                                event.target.value = "";
                              }}
                            />
                          </label>
                          {actionImage ? (
                            <button
                              type="button"
                              onClick={() => setActionImage(null)}
                              className="rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700"
                            >
                              Quitar imagen
                            </button>
                          ) : null}
                        </div>
                        {actionImage ? (
                          <div className="grid gap-2 rounded-xl border border-[#D7E4ED] bg-white p-2">
                            <div
                              data-testid="cta-admin-image-preview"
                              className="ui-scrollbar max-h-64 overflow-auto rounded-lg bg-[#F7FBFD]"
                            >
                              <Image
                                src={actionImage.previewUrl}
                                alt=""
                                width={960}
                                height={960}
                                unoptimized
                                className="h-auto w-full rounded-lg object-contain"
                              />
                            </div>
                            <div className="min-w-0 text-xs text-[#657D8F]">
                              <div className="truncate font-semibold text-[#123348]">
                                {actionImage.fileName}
                              </div>
                              <div>{actionImage.mimeType}</div>
                            </div>
                          </div>
                        ) : null}
                        {actionImageError ? (
                          <div className="text-xs font-semibold text-red-700">
                            {actionImageError}
                          </div>
                        ) : null}
                      </div>

                      <label className="grid gap-2">
                        Tabla sencilla
                        <textarea
                          value={actionTable}
                          onChange={(event) => setActionTable(event.target.value)}
                          className="ui-control min-h-[120px] font-mono text-xs"
                          placeholder={"Columna 1 | Columna 2\nDato 1 | Dato 2"}
                        />
                        <span className="text-xs text-[#657D8F]">
                          Primera línea: encabezados. Líneas siguientes: filas. Usa |, tab o coma como separador.
                        </span>
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : null}
              </div>

              <div className="ui-admin-list-card">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    Reglas visuales de visibilidad
                  </div>
                </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  Organizacion
                  <select
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                    className="ui-control"
                  >
                    <option value="">Todas las organizaciones</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-col gap-2">
                  <div className="text-sm">Solo usuarios nuevos</div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={onlyNewUsers}
                      onChange={(e) => setOnlyNewUsers(e.target.checked)}
                      className="h-4 w-4 rounded accent-emerald-500"
                    />
                    <span className="text-sm text-slate-200">
                      Mostrar solo a usuarios nuevos
                    </span>
                  </label>
                </div>

                <label className="grid gap-2 text-sm sm:col-span-2">
                  Segmento visual
                  <select
                    value={requiredCapability}
                    onChange={(e) => setRequiredCapability(e.target.value)}
                    className="ui-control"
                  >
                    <option value="">Sin restriccion adicional</option>
                    {visualCapabilityCatalog.map((cap) => (
                      <option key={cap.key} value={cap.key}>
                        {cap.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="ui-admin-list-card">
                <div className="text-sm font-semibold text-slate-100">
                  Excepciones (prioridad alta)
                </div>
                <p className="text-xs text-slate-400">
                  Si un usuario coincide con una excepción, el CTA no se muestra aunque cumpla inclusión.
                </p>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="grid gap-2">
                    <div className="text-sm text-slate-200">Excepto para organizaciones</div>
                    <div className="grid max-h-40 gap-2 overflow-auto rounded-xl border border-white/10 p-2">
                      {organizations.length ? (
                        organizations.map((org) => {
                          const checked = excludeOrganizationIds.includes(org.id);
                          return (
                            <label
                              key={org.id}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-200 hover:bg-white/5"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  toggleStringSelection(
                                    excludeOrganizationIds,
                                    org.id,
                                    setExcludeOrganizationIds,
                                  )
                                }
                                className="h-4 w-4 rounded accent-red-500"
                              />
                              <span>{org.displayName}</span>
                            </label>
                          );
                        })
                      ) : (
                        <div className="text-xs text-slate-500">No hay organizaciones disponibles.</div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="text-sm text-slate-200">Excepto para roles</div>
                    <div className="grid gap-2 rounded-xl border border-white/10 p-2">
                      {ROLE_OPTIONS.map((roleOption) => (
                        <label
                          key={roleOption.value}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-200 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={excludeRoles.includes(roleOption.value)}
                            onChange={() => {
                              if (excludeRoles.includes(roleOption.value)) {
                                setExcludeRoles(
                                  excludeRoles.filter((role) => role !== roleOption.value),
                                );
                                return;
                              }
                              setExcludeRoles([...excludeRoles, roleOption.value]);
                            }}
                            className="h-4 w-4 rounded accent-red-500"
                          />
                          <span>{roleOption.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2 xl:col-span-2">
                    <div className="text-sm text-slate-200">Excepto para capabilities</div>
                    <div className="grid gap-2 rounded-xl border border-white/10 p-2 sm:grid-cols-2">
                      {userCapabilityCatalog.map((capability) => (
                        <label
                          key={capability.key}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-200 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={excludeCapabilities.includes(capability.key)}
                            onChange={() =>
                              toggleStringSelection(
                                excludeCapabilities,
                                capability.key,
                                setExcludeCapabilities,
                              )
                            }
                            className="h-4 w-4 rounded accent-red-500"
                          />
                          <span>{capability.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="grid gap-2 text-sm xl:col-span-2">
                    Excepto para usuarios (IDs)
                    <input
                      value={excludeUserIdsRaw}
                      onChange={(event) => setExcludeUserIdsRaw(event.target.value)}
                      className="ui-control"
                      placeholder="uuid_1, uuid_2"
                    />
                    <span className="text-xs text-slate-500">
                      Lista separada por comas. Usa IDs de usuario de la app.
                    </span>
                  </label>
                </div>
              </div>
              {selectedVisualCapability ? (
                <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                  {selectedVisualCapability.help}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-slate-400">
                  Sin filtro adicional: el CTA se pinta para todos los usuarios que cumplan la superficie, organizacion y estado.
                </div>
              )}
              </div>

              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="isActive" value={isActive} />
              <input
                type="hidden"
                name="actionConfigType"
                value={kind === "action" ? actionConfigType : ""}
              />
              <input type="hidden" name="actionTitle" value={actionTitle} />
              <input type="hidden" name="actionMessage" value={actionMessage} />
              <input type="hidden" name="actionTable" value={actionTable} />
              <input type="hidden" name="actionImage" value={actionImagePayload} />
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="onlyNewUsers" value={String(onlyNewUsers)} />
              <input type="hidden" name="requiredCapability" value={requiredCapability} />
              <input
                type="hidden"
                name="excludeOrganizationIds"
                value={JSON.stringify(excludeOrganizationIds)}
              />
              <input
                type="hidden"
                name="excludeRoles"
                value={JSON.stringify(excludeRoles)}
              />
              <input
                type="hidden"
                name="excludeCapabilities"
                value={JSON.stringify(excludeCapabilities)}
              />
              <input
                type="hidden"
                name="excludeUserIds"
                value={JSON.stringify(excludedUserIds)}
              />

              <div className="sticky bottom-0 z-10 -mx-1 bg-slate-950/95 px-1 pt-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="ui-admin-action w-full disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
        </form>
      </AdminDialogShell>
    </section>
  );
}
