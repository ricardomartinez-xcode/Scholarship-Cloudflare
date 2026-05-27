import type { ReactNode } from "react";
import { AdminCapability } from "@prisma/client";

import {
  CANONICAL_ALIAS_TYPE_LABELS,
  CANONICAL_ALIAS_TYPES,
  type CanonicalAliasType,
} from "@/lib/admin-canonical-aliases";
import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

import {
  createCanonicalAliasAction,
  deleteCanonicalAliasAction,
  toggleCanonicalAliasAction,
  updateCanonicalAliasAction,
} from "./actions";

type FormServerAction = (formData: FormData) => Promise<void>;

const createAliasFormAction = createCanonicalAliasAction as unknown as FormServerAction;
const updateAliasFormAction = updateCanonicalAliasAction as unknown as FormServerAction;
const toggleAliasFormAction = toggleCanonicalAliasAction as unknown as FormServerAction;
const deleteAliasFormAction = deleteCanonicalAliasAction as unknown as FormServerAction;

export const dynamic = "force-dynamic";

const EXAMPLES = [
  ["business_line", "posgrado", "maestría"],
  ["business_line", "prepa", "bachillerato"],
  ["modality", "presencial", "escolarizada"],
  ["modality", "online", "en línea"],
  ["program", "psicologia", "psicología"],
] as const;

function AliasTypeSelect({
  name = "aliasType",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? "business_line"}
      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
    >
      {CANONICAL_ALIAS_TYPES.map((type) => (
        <option key={type} value={type}>
          {CANONICAL_ALIAS_TYPE_LABELS[type]}
        </option>
      ))}
    </select>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  name,
  defaultValue,
  placeholder,
  required = false,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      name={name}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      required={required}
      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
    />
  );
}

export default async function AdminAliasesPage() {
  await requireAdminCapabilityUser([
    AdminCapability.manage_prices,
    AdminCapability.manage_offers,
    AdminCapability.manage_benefits,
  ]);

  const aliases = await prisma.adminCanonicalAlias.findMany({
    orderBy: [
      { aliasType: "asc" },
      { canonicalNormalized: "asc" },
      { aliasNormalized: "asc" },
    ],
  });

  const countsByType = aliases.reduce<Record<string, number>>((acc, alias) => {
    acc[alias.aliasType] = (acc[alias.aliasType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-6">
      <section className="ui-card grid gap-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Fase 4A
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
              Catálogos y aliases configurables
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Administra equivalencias operativas sin tocar código. Esta primera fase guarda los aliases
              en base de datos y deja la UI lista; la conexión completa al runtime del cotizador se hará en Fase 4B.
            </p>
          </div>
          <div className="grid gap-2 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300 sm:grid-cols-3">
            {CANONICAL_ALIAS_TYPES.slice(0, 3).map((type) => (
              <div key={type}>
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  {CANONICAL_ALIAS_TYPE_LABELS[type]}
                </div>
                <div className="mt-1 text-lg font-semibold text-white">{countsByType[type] ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ui-card grid gap-4 p-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Nuevo alias</h2>
          <p className="mt-1 text-sm text-slate-400">
            Usa un valor canónico estable y todos los nombres alternativos que aparecen en archivos, UI o fuentes externas.
          </p>
        </div>
        <form action={createAliasFormAction} className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto]">
          <Field label="Tipo">
            <AliasTypeSelect />
          </Field>
          <Field label="Canónico">
            <TextInput name="canonicalValue" placeholder="posgrado" required />
          </Field>
          <Field label="Alias">
            <TextInput name="aliasValue" placeholder="maestría" required />
          </Field>
          <Field label="Notas">
            <TextInput name="notes" placeholder="Fuente o comentario operativo" />
          </Field>
          <div className="flex items-end">
            <button type="submit" className="ui-cta-primary w-full justify-center px-4 py-2 text-sm">
              Guardar
            </button>
          </div>
        </form>
      </section>

      <section className="ui-card grid gap-3 p-5">
        <h2 className="text-lg font-semibold text-white">Ejemplos recomendados</h2>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {EXAMPLES.map(([type, canonical, alias]) => (
            <div key={`${type}-${canonical}-${alias}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                {CANONICAL_ALIAS_TYPE_LABELS[type as CanonicalAliasType]}
              </div>
              <div className="mt-2 text-slate-300">
                <span className="font-semibold text-white">{alias}</span> → {canonical}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-lg font-semibold text-white">Aliases configurados</h2>
          <p className="mt-1 text-sm text-slate-400">
            El alias activo más específico será usado por los normalizadores configurables en la siguiente fase.
          </p>
        </div>

        <div className="grid divide-y divide-white/10">
          {aliases.length ? (
            aliases.map((alias) => (
              <form
                key={alias.id}
                action={updateAliasFormAction}
                className="grid gap-3 p-4 lg:grid-cols-[1.1fr_1fr_1fr_1.3fr_auto]"
              >
                <input type="hidden" name="id" value={alias.id} />
                <Field label="Tipo">
                  <AliasTypeSelect defaultValue={alias.aliasType} />
                </Field>
                <Field label="Canónico">
                  <TextInput name="canonicalValue" defaultValue={alias.canonicalValue} required />
                </Field>
                <Field label="Alias">
                  <TextInput name="aliasValue" defaultValue={alias.aliasValue} required />
                </Field>
                <Field label="Notas">
                  <TextInput name="notes" defaultValue={alias.notes} />
                </Field>
                <div className="grid content-end gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={alias.isActive}
                      className="h-4 w-4 rounded border-white/20 bg-black"
                    />
                    Activo
                  </label>
                  <button type="submit" className="ui-cta-secondary justify-center px-3 py-2 text-xs">
                    Actualizar
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      formAction={toggleAliasFormAction}
                      className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                    >
                      {alias.isActive ? "Pausar" : "Activar"}
                    </button>
                    <button
                      formAction={deleteAliasFormAction}
                      className="rounded-2xl border border-red-400/30 px-3 py-2 text-xs text-red-200 hover:bg-red-500/10"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              </form>
            ))
          ) : (
            <div className="p-6 text-sm text-slate-400">
              Todavía no hay aliases configurados. Crea el primero desde el formulario superior.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
