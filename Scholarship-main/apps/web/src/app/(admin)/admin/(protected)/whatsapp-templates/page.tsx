import Link from "next/link";
import { AdminCapability } from "@prisma/client";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import {
  listOfficialWhatsappTemplatesForAdmin,
  listSubmittedWhatsappTemplatesForAdmin,
  WHATSAPP_TEMPLATE_POSITIONAL_CATALOG,
} from "@/lib/whatsapp-templates";

import {
  reviewWhatsappTemplateAction,
  saveOfficialWhatsappTemplateAction,
} from "./actions";
import OfficialTemplateEditor from "./OfficialTemplateEditor";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX");
}

function getFieldLabel(position: number) {
  const field = WHATSAPP_TEMPLATE_POSITIONAL_CATALOG.find(
    (item) => item.position === position,
  );

  return field ? `${field.token} ${field.label}` : `{{${position}}}`;
}

export default async function AdminWhatsappTemplatesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    create?: string;
    edit?: string;
    error?: string;
    saved?: string;
  }>;
}) {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  await requireAdminCapabilityUser(AdminCapability.manage_ctas);

  const params = searchParams ? await searchParams : undefined;
  const [officialTemplates, reviewQueue] = await Promise.all([
    listOfficialWhatsappTemplatesForAdmin(),
    listSubmittedWhatsappTemplatesForAdmin(),
  ]);

  const editingTemplate =
    officialTemplates.find((template) => template.id === params?.edit) ?? null;
  const saveError = params?.error === "save";
  const saveSuccess = params?.saved === "1";

  return (
    <div className="grid gap-6 p-6">
      <section className="ui-card ui-card-pad">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
          Templates WhatsApp
        </div>
        <h1 className="mt-1 text-xl font-semibold">Catálogo oficial y revisión</h1>
      </section>

      {saveSuccess ? (
        <section className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          El template oficial se guardó correctamente.
        </section>
      ) : null}

      {saveError ? (
        <section className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          No fue posible guardar el template oficial. Revisa el nombre y el mensaje base.
        </section>
      ) : null}

      <section className="ui-card ui-card-pad grid gap-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Editor
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">
              {editingTemplate ? "Editar template oficial" : "Crear template oficial"}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/whatsapp-templates?create=1"
              className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/18"
            >
              Nuevo oficial
            </Link>
            {editingTemplate ? (
              <Link
                href="/admin/whatsapp-templates"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
              >
                Cancelar edición
              </Link>
            ) : null}
          </div>
        </div>

        <OfficialTemplateEditor
          key={editingTemplate?.id ?? "create"}
          editingTemplate={editingTemplate}
          saveAction={saveOfficialWhatsappTemplateAction}
        />
      </section>

      <section className="grid gap-4">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
          Templates oficiales actuales
        </div>
        {officialTemplates.length ? officialTemplates.map((template) => (
          <article key={template.id} className="ui-card ui-card-pad grid gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                  <span>{template.kind === "summary" ? "Resumen" : "Completo"}</span>
                  {template.isDefaultOfficial ? (
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-[11px] tracking-[0.16em] text-emerald-100">
                      Predeterminado
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">{template.name}</h2>
                <div className="mt-2 text-sm text-slate-300">
                  {template.baseText || "Sin texto base."}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/whatsapp-templates?edit=${template.id}`}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  Editar
                </Link>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.18fr)]">
              <div className="grid gap-2">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Campos activos
                </div>
                <div className="flex flex-wrap gap-2">
                  {template.fieldOrder.map((position) => (
                    <span
                      key={`${template.id}-${position}`}
                      className="inline-flex items-center whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                    >
                      {getFieldLabel(position)}
                    </span>
                  ))}
                </div>
              </div>

              <label className="grid gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                Preview estructural
                <textarea
                  readOnly
                  value={template.preview}
                  spellCheck={false}
                  className="min-h-[220px] rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm normal-case tracking-normal text-slate-100"
                />
              </label>
            </div>
          </article>
        )) : (
          <section className="ui-card ui-card-pad text-sm text-slate-300">
            No hay templates oficiales activos.
          </section>
        )}
      </section>

      {reviewQueue.length ? (
        <section className="grid gap-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Cola de revisión
          </div>
          {reviewQueue.map((template) => (
            <article key={template.id} className="ui-card ui-card-pad grid gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    {template.kind === "summary" ? "Resumen" : "Completo"} · {template.status}
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-100">
                    {template.name}
                  </h2>
                  <div className="mt-2 text-sm text-slate-300">
                    Autor: {template.authorEmail ?? "—"} · Propietario: {template.ownerEmail ?? "—"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Enviado: {formatDate(template.submittedAt)} · Revisado: {formatDate(template.reviewedAt)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {template.fieldOrder.map((position) => (
                    <span
                      key={`${template.id}-${position}`}
                      className="inline-flex items-center whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                    >
                      {getFieldLabel(position)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
                <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Resumen
                  </div>
                  <div className="text-sm text-slate-200">
                    Texto base: {template.baseText || "—"}
                  </div>
                  <div className="text-sm text-slate-200">
                    Notas de revisión: {template.reviewNotes || "—"}
                  </div>
                </div>

                <label className="grid gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                  Preview estructural
                  <textarea
                    readOnly
                    value={template.preview}
                    spellCheck={false}
                    className="min-h-[240px] rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm normal-case tracking-normal text-slate-100"
                  />
                </label>
              </div>

              <form
                action={reviewWhatsappTemplateAction}
                className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4"
              >
                <input type="hidden" name="templateId" value={template.id} />
                <label className="grid gap-2 text-sm text-slate-200">
                  Notas de revisión
                  <textarea
                    name="reviewNotes"
                    defaultValue={template.reviewNotes ?? ""}
                    className="ui-control min-h-[92px]"
                    placeholder="Comentarios para el autor o justificación de publicación."
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    name="decision"
                    value="approve"
                    className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/18"
                  >
                    Aprobar
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="reject"
                    className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/18"
                  >
                    Rechazar
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="publish"
                    className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/18"
                  >
                    Publicar como oficial
                  </button>
                </div>
              </form>
            </article>
          ))}
        </section>
      ) : (
        <section className="ui-card ui-card-pad text-sm text-slate-300">
          No hay templates pendientes de revisión en este momento.
        </section>
      )}
    </div>
  );
}
