import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { listEnrollmentFormats } from "@/lib/enrollment-formats";
import {
  deleteEnrollmentFormatAction,
  upsertEnrollmentFormatAction,
} from "./actions";

export const dynamic = "force-dynamic";

function formatBytes(value: number | null) {
  if (!value) return "Link externo";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function EnrollmentFormatsAdminPage() {
  await requireAdminCapabilityUser(AdminCapability.manage_offers);

  const formats = await listEnrollmentFormats({ includeInactive: true });

  return (
    <div className="grid gap-6">
      <section className="ui-card p-4 sm:p-5">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
          Oferta académica
        </div>
        <h1 className="mt-1 text-xl font-semibold text-slate-100">Formatos</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Administra documentos útiles para inscripción. Puedes subir PDF, Word
          o registrar un link de descarga externo.
        </p>
      </section>

      <section className="ui-card grid gap-4 p-4 sm:p-5">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Nuevo formato
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">
            Archivo o link de descarga
          </h2>
        </div>

        <form action={upsertEnrollmentFormatAction} className="grid gap-4">
          <input type="hidden" name="isActive" value="on" />
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
            <label className="grid gap-2 text-sm">
              Título
              <input
                name="title"
                className="ui-control"
                placeholder="Ej. Formato de inscripción"
                required
              />
            </label>
            <label className="grid gap-2 text-sm">
              Orden
              <input
                name="sortOrder"
                type="number"
                className="ui-control"
                defaultValue={0}
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm">
            Descripción
            <textarea
              name="description"
              className="ui-control min-h-24"
              placeholder="Uso del formato, área responsable o notas internas visibles."
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              Subir archivo PDF/Word
              <input
                name="file"
                type="file"
                className="ui-control"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
            </label>
            <label className="grid gap-2 text-sm">
              Link de descarga
              <input
                name="fileUrl"
                className="ui-control"
                placeholder="https://..."
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="ui-button-info px-4 py-2 text-sm">
              Guardar formato
            </button>
          </div>
        </form>
      </section>

      <section className="ui-card grid gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Catálogo
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">
              Formatos publicados
            </h2>
          </div>
          <div className="text-sm text-slate-400">{formats.length} formato(s)</div>
        </div>

        <div className="grid gap-3">
          {formats.map((format) => (
            <details
              key={format.id}
              className="rounded-2xl border border-white/10 bg-slate-950/30 p-4"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="break-words font-semibold text-slate-100">
                    {format.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {format.isActive ? "Activo" : "Inactivo"} · {format.sourceType} ·{" "}
                    {formatBytes(format.fileSizeBytes)}
                  </div>
                </div>
                <a
                  href={format.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-button-secondary min-h-9 px-3 text-xs"
                >
                  Abrir
                </a>
              </summary>

              <form action={upsertEnrollmentFormatAction} className="mt-4 grid gap-4">
                <input type="hidden" name="id" value={format.id} />
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px_120px]">
                  <label className="grid gap-2 text-sm">
                    Título
                    <input
                      name="title"
                      className="ui-control"
                      defaultValue={format.title}
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Orden
                    <input
                      name="sortOrder"
                      type="number"
                      className="ui-control"
                      defaultValue={format.sortOrder}
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input
                      name="isActive"
                      type="checkbox"
                      defaultChecked={format.isActive}
                    />
                    Activo
                  </label>
                </div>
                <label className="grid gap-2 text-sm">
                  Descripción
                  <textarea
                    name="description"
                    className="ui-control min-h-20"
                    defaultValue={format.description ?? ""}
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    Reemplazar archivo PDF/Word
                    <input
                      name="file"
                      type="file"
                      className="ui-control"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Link de descarga
                    <input
                      name="fileUrl"
                      className="ui-control"
                      defaultValue={format.sourceType === "link" ? format.fileUrl : ""}
                      placeholder="https://..."
                    />
                  </label>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="submit" className="ui-button-info px-4 py-2 text-sm">
                    Guardar cambios
                  </button>
                  <button
                    form={`delete-format-${format.id}`}
                    type="submit"
                    className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/20"
                  >
                    Eliminar
                  </button>
                </div>
              </form>
              <form
                id={`delete-format-${format.id}`}
                action={deleteEnrollmentFormatAction}
              >
                <input type="hidden" name="id" value={format.id} />
              </form>
            </details>
          ))}
          {!formats.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
              Aún no hay formatos registrados.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
