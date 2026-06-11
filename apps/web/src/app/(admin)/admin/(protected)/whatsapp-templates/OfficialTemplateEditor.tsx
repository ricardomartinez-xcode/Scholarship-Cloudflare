"use client";

import { useRef, useState } from "react";

import WhatsappVariableCatalog from "@/components/whatsapp/WhatsappVariableCatalog";
import {
  WHATSAPP_TEMPLATE_KINDS,
  type AdminOfficialWhatsappTemplateItem,
} from "@/lib/whatsapp-templates.shared";

type EditableOfficialTemplate = Pick<
  AdminOfficialWhatsappTemplateItem,
  "id" | "systemKey" | "name" | "kind" | "baseText" | "isDefaultOfficial"
> | null;

type OfficialTemplateEditorProps = {
  editingTemplate: EditableOfficialTemplate;
  saveAction: (formData: FormData) => void | Promise<void>;
};

export default function OfficialTemplateEditor({
  editingTemplate,
  saveAction,
}: OfficialTemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [baseText, setBaseText] = useState(editingTemplate?.baseText ?? "");
  const selectedKind = editingTemplate?.kind ?? "detailed";
  const createMode = !editingTemplate;

  function insertToken(position: number) {
    const token = `{{${position}}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setBaseText((current) => current + token);
      return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;

    setBaseText((current) => current.slice(0, start) + token + current.slice(end));

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = start + token.length;
      textarea.selectionEnd = start + token.length;
    });
  }

  return (
    <form
      action={saveAction}
      className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4"
    >
      <input type="hidden" name="templateId" value={editingTemplate?.id ?? ""} />

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.86fr)_minmax(0,1.14fr)]">
        <div className="grid content-start gap-4">
          <label className="grid gap-2 text-sm text-slate-200">
            Nombre
            <input
              name="name"
              defaultValue={editingTemplate?.name ?? ""}
              className="ui-control"
              placeholder="Ej. Seguimiento beca mensual"
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-200">
            Tipo
            <select
              name="kind"
              defaultValue={selectedKind}
              disabled={Boolean(editingTemplate?.systemKey)}
              className="ui-control"
            >
              {WHATSAPP_TEMPLATE_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-slate-200">
            <input
              type="checkbox"
              name="setAsDefault"
              value="true"
              defaultChecked={editingTemplate?.isDefaultOfficial ?? false}
            />
            Usar como template oficial por defecto
          </label>
        </div>

        <div className="grid gap-4 rounded-2xl border border-white/10 bg-black/15 p-4">
          <label className="grid gap-2 text-sm text-slate-200">
            Mensaje base
            <textarea
              ref={textareaRef}
              name="baseText"
              value={baseText}
              onChange={(event) => setBaseText(event.target.value)}
              className="ui-control min-h-[220px]"
              placeholder="Escribe el mensaje y agrega variables desde el catálogo."
              spellCheck={false}
            />
          </label>

          <WhatsappVariableCatalog
            onInsert={insertToken}
            listClassName="max-h-[320px]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/18"
        >
          {createMode ? "Crear oficial" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
