"use client";

import { useMemo, useState } from "react";

import {
  CTA_LOCATIONS,
  CTA_LOCATION_META,
  type CtaLocation,
} from "@/config/adminCatalogs";

type PageKey = "public" | "app" | "admin";

const PAGE_TABS: Array<{ key: PageKey; label: string; description: string }> = [
  {
    key: "public",
    label: "Inicio público",
    description: "Antes de iniciar sesión.",
  },
  {
    key: "app",
    label: "App UNIDEP",
    description: "Experiencia autenticada.",
  },
  {
    key: "admin",
    label: "Admin",
    description: "Panel interno.",
  },
];

const PAGE_SECTIONS: Record<
  PageKey,
  Array<{ title: string; description: string; keys: CtaLocation[] }>
> = {
  public: [
    {
      title: "Navegación global",
      description: "Visible arriba del home y de pantallas compartidas.",
      keys: ["NAV_BANNER"],
    },
    {
      title: "Hero principal",
      description: "Acceso y mensaje principal del inicio.",
      keys: ["HOME_PRIMARY"],
    },
    {
      title: "Columna lateral",
      description: "Contenido de apoyo, contacto o acciones secundarias.",
      keys: ["HOME_SECONDARY"],
    },
  ],
  app: [
    {
      title: "Barra superior del workspace",
      description: "Se muestra junto a la navegación principal.",
      keys: ["UNIDEP_PRIMARY"],
    },
    {
      title: "Panel de resultado",
      description: "Visible arriba del bloque donde aparece la cotización final.",
      keys: ["APP_RESULTS_ABOVE"],
    },
    {
      title: "Workspace",
      description: "Acciones ligadas al resultado y al cierre del flujo.",
      keys: ["APP_RESULTS_INSIDE", "CALCULATOR_FOOTER"],
    },
  ],
  admin: [
    {
      title: "Encabezado del panel",
      description: "Mensajes y atajos antes del contenido del módulo.",
      keys: ["ADMIN_HEADER_BANNER"],
    },
    {
      title: "Módulo activo",
      description: "Atajos dentro del módulo abierto.",
      keys: ["ADMIN_CONTENT_TOP"],
    },
  ],
};

export default function CtaLocationPicker({
  value,
  onChange,
}: {
  value: CtaLocation;
  onChange: (value: CtaLocation) => void;
}) {
  const selectedLocation = useMemo(
    () => CTA_LOCATIONS.find((location) => location.value === value) ?? CTA_LOCATIONS[0],
    [value],
  );
  const selectedMeta = CTA_LOCATION_META[selectedLocation.value];
  const [pageKey, setPageKey] = useState<PageKey>(selectedMeta.pageKey);
  const sections = useMemo(() => {
    const baseSections = PAGE_SECTIONS[pageKey];
    const visibleKeys = new Set(baseSections.flatMap((section) => section.keys));
    if (visibleKeys.has(value)) {
      return baseSections;
    }

    return [
      ...baseSections,
      {
        title: "Compatibilidad / oculto",
        description: "Slot de compatibilidad que ya no se recomienda para nuevas piezas.",
        keys: [value],
      },
    ];
  }, [pageKey, value]);

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Ubicación seleccionada
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-100">
              {selectedLocation.label}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-slate-200">
            <span className="rounded-full border border-emerald-400/25 bg-blue-950/20 px-3 py-1">
              Página: {selectedMeta.pageLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Sección: {selectedMeta.sectionLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Slot: {selectedMeta.slotLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {PAGE_TABS.map((tab) => {
          const selected = pageKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setPageKey(tab.key)}
              className={[
                "rounded-2xl border px-4 py-3 text-left transition",
                selected
                  ? "border-emerald-400/40 bg-blue-950/20 text-emerald-100"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
              ].join(" ")}
            >
              <div className="text-sm font-semibold">{tab.label}</div>
              <div className="mt-1 text-xs text-slate-400">{tab.description}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {sections.map((section) => (
          <section
            key={`${pageKey}-${section.title}`}
            className="rounded-2xl border border-white/10 bg-slate-950/30 p-4"
          >
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              {section.title}
            </div>

            <div className="mt-4 grid gap-2">
              {section.keys.map((key) => {
                const location = CTA_LOCATIONS.find((item) => item.value === key);
                if (!location) return null;
                const meta = CTA_LOCATION_META[key];
                const selected = value === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    className={[
                      "rounded-2xl border px-3 py-3 text-left transition",
                      selected
                        ? "border-emerald-400/45 bg-blue-950/12 text-emerald-100"
                        : "border-white/10 bg-black/10 text-slate-200 hover:bg-white/5",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {meta.shortLabel}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {meta.sectionLabel} · {meta.slotLabel}
                        </div>
                      </div>
                      {selected ? (
                        <span className="rounded-full border border-emerald-400/35 bg-blue-950/12 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-200">
                          Activo
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
