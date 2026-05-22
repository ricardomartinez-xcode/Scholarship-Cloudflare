"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildWhatsappTemplatePreview,
  type WhatsappTemplateCollection,
  type WhatsappTemplatePreviewData,
} from "@/lib/whatsapp-templates";

type Feedback = {
  tone: "success" | "error";
  message: string;
};

function IconCopyStack({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="5" width="10" height="12" rx="2.5" />
      <path d="M7 9H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1" />
    </svg>
  );
}

async function copyTextWithFallback(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("copy_failed");
}

export default function ResultsWhatsappTemplatePanel({
  initialCollection,
  previewData,
}: {
  initialCollection: WhatsappTemplateCollection;
  previewData: WhatsappTemplatePreviewData;
}) {
  const [copyFeedback, setCopyFeedback] = useState<Feedback | null>(null);

  const activeTemplate =
    initialCollection.templates.find(
      (template) => template.id === initialCollection.activeTemplateId,
    ) ??
    initialCollection.templates.find(
      (template) => template.id === initialCollection.defaultOfficialTemplateId,
    ) ??
    initialCollection.templates[0] ??
    null;

  const previewMessage = useMemo(
    () =>
      activeTemplate
        ? buildWhatsappTemplatePreview(activeTemplate, previewData)
        : "",
    [activeTemplate, previewData],
  );

  useEffect(() => {
    if (!copyFeedback) return;
    const timeout = window.setTimeout(() => {
      setCopyFeedback(null);
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  async function handleCopy() {
    if (!previewMessage) return;
    try {
      await copyTextWithFallback(previewMessage);
      setCopyFeedback({
        tone: "success",
        message: "Template copiado.",
      });
    } catch {
      setCopyFeedback({
        tone: "error",
        message: "No se pudo copiar automáticamente.",
      });
    }
  }

  if (!activeTemplate) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-300">
        No hay template oficial activo.
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"
      data-testid="whatsapp-template-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.28em] text-emerald-200/80">
            Template activo
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-100">
            {activeTemplate.name}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={!previewMessage}
          aria-label="Copiar template para WhatsApp"
          title="Copiar template para WhatsApp"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="copy-whatsapp-button"
        >
          <IconCopyStack className="h-5 w-5" />
        </button>
      </div>

      {copyFeedback ? (
        <div
          className={[
            "mt-3 rounded-xl border px-3 py-2 text-xs",
            copyFeedback.tone === "success"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
              : "border-red-400/30 bg-red-500/10 text-red-100",
          ].join(" ")}
        >
          {copyFeedback.message}
        </div>
      ) : null}

      <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
        <pre className="ui-scrollbar max-h-[320px] overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate-100">
          {previewMessage}
        </pre>
      </div>
    </div>
  );
}
