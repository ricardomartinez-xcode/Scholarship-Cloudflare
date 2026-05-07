"use client";

import { WHATSAPP_TEMPLATE_POSITIONAL_CATALOG } from "@/lib/whatsapp-templates";

type WhatsappVariableCatalogProps = {
  onInsert: (position: number) => void;
  title?: string;
  description?: string;
  className?: string;
  listClassName?: string;
};

export default function WhatsappVariableCatalog({
  onInsert,
  title = "Variables disponibles",
  description = "Haz click para insertar una variable en la posición del cursor.",
  className,
  listClassName,
}: WhatsappVariableCatalogProps) {
  return (
    <div className={["grid content-start gap-2", className].filter(Boolean).join(" ")}>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{title}</div>
      <div className="text-xs text-slate-500">{description}</div>
      <div
        className={[
          "rounded-2xl border border-white/10 bg-slate-950/40 p-2",
          "max-h-[260px] overflow-y-auto",
          listClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        data-testid="whatsapp-variable-catalog"
      >
        {WHATSAPP_TEMPLATE_POSITIONAL_CATALOG.map((field) => (
          <button
            key={field.key}
            type="button"
            onClick={() => onInsert(field.position)}
            className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/10"
            title={field.description}
            data-testid={`whatsapp-variable-token-${field.position}`}
          >
            <span className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-emerald-300">
              {field.token}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-200">{field.label}</span>
              <span className="mt-0.5 block text-xs text-slate-400">
                {field.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
