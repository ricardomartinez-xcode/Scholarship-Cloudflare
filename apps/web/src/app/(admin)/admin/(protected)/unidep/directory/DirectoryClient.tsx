"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  buildDirectoryContactHref,
  parseDirectoryContactMethods,
} from "@/lib/directory-contact-methods";
import AdminDialogShell from "@/components/admin/AdminDialogShell";
import {
  applyDirectoryImportSessionAction,
  createDirectoryImportSessionAction,
  deleteDirectoryContactAction,
  rollbackDirectoryImportSessionAction,
  upsertDirectoryContactAction,
} from "./actions";

type Campus = { id: string; name: string; code: string };

type Contact = {
  id: string;
  campusId: string;
  zone: string | null;
  role: string | null;
  name: string | null;
  contact: string | null;
  methods?: Array<{
    type: string;
    value: string;
    normalizedValue: string;
    isPrimary: boolean;
    sortOrder: number;
    href?: string | null;
  }>;
  source: string | null;
  campus: Campus;
};

const DIRECTORY_AREAS = [
  "Comercial",
  "Marketing",
  "Servicios Escolares",
  "Administrativos",
  "Asesores",
  "Orientadores",
];

const STORAGE_KEY = "admin.unidep.directory.sections";

function getDisplayMethods(contact: Contact) {
  const methods =
    contact.methods?.length
      ? contact.methods.map((method) => ({
          value: method.value,
          href:
            method.href ??
            buildDirectoryContactHref({
              type: method.type as
                | "EMAIL"
                | "PHONE"
                | "WHATSAPP"
                | "URL"
                | "OTHER",
              value: method.value,
            }),
        }))
      : parseDirectoryContactMethods(contact.contact).map((method) => ({
          value: method.value,
          href: buildDirectoryContactHref(method),
        }));

  return methods;
}

export default function DirectoryClient({
  contacts,
  campuses,
}: {
  contacts: Contact[];
  campuses: Campus[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<Contact> | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [filterCampus, setFilterCampus] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterZone, setFilterZone] = useState("");
  const [query, setQuery] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState("");
  const [importSession, setImportSession] = useState<{
    sessionId: string;
    processed: number;
    ready: number;
    imported?: number;
    warnings: string[];
    errors: string[];
    sample?: Array<{
      campus: string;
      zone: string | null;
      role: string | null;
      name: string | null;
      contact: string | null;
    }>;
    applied?: boolean;
    rolledBack?: boolean;
  } | null>(null);
  const [importPending, startImportTransition] = useTransition();
  const [applyPending, startApplyTransition] = useTransition();
  const [rollbackPending, startRollbackTransition] = useTransition();
  const [sections, setSections] = useState({ import: true, table: true });

  useEffect(() => {
    let timer: number | undefined;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { import?: boolean; table?: boolean };
      timer = window.setTimeout(() => {
        setSections({
          import: parsed.import ?? true,
          table: parsed.table ?? true,
        });
      }, 0);
    } catch {
      // ignore persisted UI errors
    }
    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
    } catch {
      // ignore persisted UI errors
    }
  }, [sections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      const okCampus = !filterCampus || c.campusId === filterCampus;
      const okRole =
        !filterRole || (c.role ?? "").toLowerCase().includes(filterRole.toLowerCase());
      const okZone =
        !filterZone || (c.zone ?? "").toLowerCase().includes(filterZone.toLowerCase());
      const searchable = [c.name, c.role, c.zone, c.contact, c.campus.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const okQuery = !q || searchable.includes(q);
      return okCampus && okRole && okZone && okQuery;
    });
  }, [contacts, filterCampus, filterRole, filterZone, query]);

  function toggleSection(key: "import" | "table") {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError("");
    startTransition(async () => {
      const res = await upsertDirectoryContactAction(fd);
      if (res.ok) {
        setEditing(null);
        router.refresh();
      } else {
        setError(res.error ?? "Error.");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este contacto?")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deleteDirectoryContactAction(fd);
      router.refresh();
    });
  }

  function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setImportError("");
    setImportSession(null);

    if (!importFile) {
      setImportError("Selecciona un archivo .csv o .xlsx.");
      return;
    }

    const fd = new FormData();
    fd.set("file", importFile);

    startImportTransition(async () => {
      const res = await createDirectoryImportSessionAction(fd);
      if (!res.ok) {
        setImportError(res.error ?? "No fue posible validar el archivo.");
        return;
      }
      setImportSession({
        sessionId: res.sessionId ?? "",
        processed: res.processed ?? 0,
        ready: res.ready ?? 0,
        warnings: res.warnings ?? [],
        errors: res.errors ?? [],
        sample: res.sample ?? [],
      });
    });
  }

  function handleApplyImportSession() {
    if (!importSession?.sessionId) return;
    setImportError("");
    startApplyTransition(async () => {
      const fd = new FormData();
      fd.set("sessionId", importSession.sessionId);
      const res = await applyDirectoryImportSessionAction(fd);
      if (!res.ok) {
        setImportError(res.error ?? "No fue posible aplicar la sesión.");
        return;
      }
      setImportSession((current) =>
        current
          ? {
              ...current,
              imported: res.imported ?? 0,
              warnings: res.warnings ?? current.warnings,
              errors: res.errors ?? current.errors,
              applied: true,
              rolledBack: false,
            }
          : current,
      );
      setImportFile(null);
      router.refresh();
    });
  }

  function handleRollbackImportSession() {
    if (!importSession?.sessionId) return;
    setImportError("");
    startRollbackTransition(async () => {
      const fd = new FormData();
      fd.set("sessionId", importSession.sessionId);
      const res = await rollbackDirectoryImportSessionAction(fd);
      if (!res.ok) {
        setImportError(res.error ?? "No fue posible revertir la sesión.");
        return;
      }
      setImportSession((current) =>
        current
          ? {
              ...current,
              applied: false,
              rolledBack: true,
            }
          : current,
      );
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      <section className="ui-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Directorio
            </div>
            <h2 className="mt-1 text-lg font-semibold">Contactos UNIDEP</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">
              Usa el campo <span className="font-semibold text-slate-100">Contacto</span> para
              guardar correo, teléfono o ambos. Ejemplo:{" "}
              <span className="text-slate-100">
                admisiones@unidep.mx | 664 123 4567
              </span>
              .
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleSection("import")}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10"
            >
              {sections.import ? "Ocultar importación" : "Mostrar importación"}
            </button>
            <button
              type="button"
              onClick={() => toggleSection("table")}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10"
            >
              {sections.table ? "Ocultar tabla" : "Mostrar tabla"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing({});
                setError("");
              }}
              className="rounded-full border border-[#114E6D] bg-[#114E6D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0F3C55]"
            >
              + Agregar
            </button>
          </div>
        </div>
      </section>

      {sections.import ? (
        <form onSubmit={handleImport} className="ui-card grid gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Importación
              </div>
              <div className="mt-1 text-sm text-slate-200">
                La sesión valida primero el archivo y sólo después permite aplicar cambios al{" "}
                <span className="font-semibold text-slate-100">draft</span>. Lo visible al público
                no cambia hasta publicar el snapshot del módulo. Puede leer encabezados como{" "}
                <span className="font-semibold text-slate-100">
                  Área/Zona, Plantel, Rol/Cargo, Nombre y Contacto/Correo/Teléfono
                </span>
                .
              </div>
            </div>
            <Link
              href="/admin/importaciones"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10"
            >
              Ver validador
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4 text-xs text-slate-400">
            Si no detecta encabezados, seguirá usando el orden de compatibilidad:
            <code className="mx-1 rounded bg-black/30 px-1">Zona</code>,
            <code className="mx-1 rounded bg-black/30 px-1">Plantel</code>,
            <code className="mx-1 rounded bg-black/30 px-1">Rol</code>,
            <code className="mx-1 rounded bg-black/30 px-1">Nombre</code>,
            <code className="mx-1 rounded bg-black/30 px-1">Contacto</code>.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="text-xs text-slate-300 file:mr-3 file:rounded-full file:border file:border-white/20 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-slate-100"
            />
            <button
              type="submit"
              disabled={importPending || !importFile}
              className="rounded-full border border-[#114E6D] bg-[#114E6D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0F3C55] disabled:border-[#D7E4ED] disabled:bg-[#EAF3F8] disabled:text-[#657D8F] disabled:opacity-100"
            >
              {importPending ? "Validando..." : "Validar archivo"}
            </button>
            {importSession && !importSession.applied && !importSession.rolledBack ? (
              <button
                type="button"
                onClick={handleApplyImportSession}
                disabled={applyPending || importSession.errors.length > 0}
                className="rounded-full border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-100 transition hover:bg-blue-950/30 disabled:opacity-50"
              >
                {applyPending ? "Aplicando..." : "Aplicar al draft"}
              </button>
            ) : null}
            {importSession?.applied && !importSession.rolledBack ? (
              <button
                type="button"
                onClick={handleRollbackImportSession}
                disabled={rollbackPending}
                className="rounded-full border border-amber-500/30 bg-amber-500/20 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-50"
              >
                {rollbackPending ? "Revirtiendo..." : "Rollback lógico"}
              </button>
            ) : null}
          </div>

          {importError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {importError}
            </div>
          ) : null}

          {importSession ? (
            <div className="grid gap-3 rounded-2xl border border-blue-900/40 bg-blue-950/20 p-4">
              <div className="text-sm text-emerald-100">
                Sesión <b>{importSession.sessionId.slice(0, 8)}</b> · Procesadas:{" "}
                <b>{importSession.processed}</b> · listas para apply:{" "}
                <b>{importSession.ready}</b>
                {importSession.applied ? (
                  <>
                    {" "}· importadas/actualizadas: <b>{importSession.imported ?? 0}</b>
                  </>
                ) : null}
              </div>
              {importSession.rolledBack ? (
                <div className="text-sm text-amber-100">
                  Se ejecutó rollback lógico sobre el draft de directorio.
                </div>
              ) : null}
              {importSession.errors.length > 0 ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {importSession.errors.join(" ")}
                </div>
              ) : null}
              {importSession.warnings.length > 0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  <div className="font-semibold">Warnings</div>
                  <ul className="mt-2 grid gap-1">
                    {importSession.warnings.map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {importSession.sample?.length ? (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/15">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead className="bg-slate-950/40 text-slate-300">
                      <tr>
                        <th className="p-3 text-left font-semibold">Plantel</th>
                        <th className="p-3 text-left font-semibold">Área</th>
                        <th className="p-3 text-left font-semibold">Rol / Cargo</th>
                        <th className="p-3 text-left font-semibold">Nombre</th>
                        <th className="p-3 text-left font-semibold">Contacto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importSession.sample.map((row, index) => (
                        <tr key={`${row.campus}-${row.name}-${index}`} className="border-t border-white/10">
                          <td className="p-3 text-slate-100">{row.campus}</td>
                          <td className="p-3 text-slate-300">{row.zone ?? "—"}</td>
                          <td className="p-3 text-slate-300">{row.role ?? "—"}</td>
                          <td className="p-3 text-slate-100">{row.name ?? "—"}</td>
                          <td className="p-3 text-slate-300">{row.contact ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : null}

      <section className="ui-card grid gap-4 p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,180px)_minmax(0,180px)_minmax(0,220px)_minmax(0,1fr)]">
          <div className="grid gap-2 text-sm">
            Plantel
            <select
              value={filterCampus}
              onChange={(e) => setFilterCampus(e.target.value)}
              className="ui-control"
            >
              <option value="">Todos</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 text-sm">
            Área
            <select
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
              className="ui-control"
            >
              <option value="">Todas las áreas</option>
              {DIRECTORY_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 text-sm">
            Rol / Cargo
            <input
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="ui-control"
              placeholder="Director, Asesor..."
            />
          </div>
          <div className="grid gap-2 text-sm">
            Buscar
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ui-control"
              placeholder="Nombre, contacto, plantel..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-300">
            {filtered.length} de {contacts.length} contacto(s)
          </div>
        </div>

        {sections.table ? (
          <div className="ui-scrollbar grid max-h-[70vh] gap-3 overflow-auto rounded-2xl border border-[#D7E4ED] bg-[#F7FBFD] p-3">
            {filtered.map((c) => (
              <article
                key={c.id}
                className="grid gap-3 rounded-2xl border border-[#D7E4ED] bg-white p-4 text-sm text-[#123348] lg:grid-cols-[minmax(150px,0.75fr)_minmax(130px,0.6fr)_minmax(160px,0.75fr)_minmax(190px,0.85fr)_minmax(220px,1.1fr)_auto]"
              >
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#657D8F]">Plantel</div>
                  <div className="mt-1 font-semibold">{c.campus.name}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#657D8F]">Área</div>
                  <div className="mt-1">{c.zone ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#657D8F]">Rol / Cargo</div>
                  <div className="mt-1">{c.role ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#657D8F]">Nombre</div>
                  <div className="mt-1 font-semibold">{c.name ?? "—"}</div>
                  <div className="mt-1 text-xs text-[#657D8F]">{c.source ?? "Manual"}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#657D8F]">Contacto</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getDisplayMethods(c).length ? (
                      getDisplayMethods(c).map(({ value, href }) => {
                        const className =
                          "max-w-full break-all rounded-full border border-[#D7E4ED] bg-[#F4F9FC] px-2.5 py-1 text-xs font-medium text-[#123348]";
                        if (!href) {
                          return (
                            <span key={value} className={className}>
                              {value}
                            </span>
                          );
                        }
                        return (
                          <a
                            key={value}
                            href={href}
                            target={href.startsWith("http") ? "_blank" : undefined}
                            rel={href.startsWith("http") ? "noreferrer" : undefined}
                            className={`${className} transition hover:border-[#114E6D] hover:text-[#114E6D]`}
                          >
                            {value}
                          </a>
                        );
                      })
                    ) : (
                      <span className="text-xs text-[#657D8F]">—</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(c);
                      setError("");
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D7E4ED] bg-white text-[#114E6D] transition hover:bg-[#F4F9FC]"
                    aria-label={`Editar ${c.name ?? c.campus.name}`}
                    title="Editar"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    disabled={isPending}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                    aria-label={`Eliminar ${c.name ?? c.campus.name}`}
                    title="Eliminar"
                  >
                    ×
                  </button>
                </div>
              </article>
            ))}
            {!filtered.length ? (
              <div className="rounded-2xl border border-dashed border-[#D7E4ED] bg-white p-4 text-sm text-[#657D8F]">
                Sin resultados.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-sm text-slate-400">
            La tabla está contraída. Puedes volver a abrirla desde el encabezado del módulo.
          </div>
        )}
      </section>

      <AdminDialogShell
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing?.id ? "Editar contacto" : "Nuevo contacto"}
        description="Captura un único campo de contacto para correo, teléfono o ambos."
        kicker={editing?.id ? "Directorio" : "Nuevo"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          <input type="hidden" name="id" value={editing?.id ?? ""} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 text-sm sm:col-span-2">
              Plantel
              <select
                name="campusId"
                defaultValue={editing?.campusId ?? ""}
                className="ui-control"
                required
              >
                <option value="">Selecciona plantel</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 text-sm">
              Área
              <select
                name="zone"
                defaultValue={editing?.zone ?? ""}
                className="ui-control"
              >
                <option value="">Sin área asignada</option>
                {DIRECTORY_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 text-sm">
              Rol / Cargo
              <input
                name="role"
                defaultValue={editing?.role ?? ""}
                className="ui-control"
                placeholder="Director, Coordinador..."
              />
            </div>

            <div className="grid gap-2 text-sm">
              Nombre
              <input
                name="name"
                defaultValue={editing?.name ?? ""}
                className="ui-control"
                placeholder="Nombre completo"
              />
            </div>

            <div className="grid gap-2 text-sm">
              Fuente
              <input
                name="source"
                defaultValue={editing?.source ?? ""}
                className="ui-control"
                placeholder="Excel, Manual..."
              />
            </div>

            <div className="grid gap-2 text-sm sm:col-span-2">
              Contacto
              <input
                name="contact"
                defaultValue={editing?.contact ?? ""}
                className="ui-control"
                placeholder="correo@unidep.edu.mx | 664 123 4567"
              />
              <div className="text-xs text-slate-400">
                Puedes guardar correo, teléfono o ambos separados por <code className="rounded bg-black/30 px-1">|</code>.
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-white/10 bg-slate-950/95 pt-4">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm text-emerald-100 transition hover:bg-blue-950/30 disabled:opacity-50"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </AdminDialogShell>
    </div>
  );
}
