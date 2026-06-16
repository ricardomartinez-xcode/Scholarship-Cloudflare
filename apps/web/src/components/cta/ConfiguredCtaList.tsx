"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { CtaActionConfig } from "@/lib/cta-action-config";

type ConfiguredCta = {
  id: string;
  label: string;
  kind: "link" | "action";
  url: string | null;
  variant: string | null;
  placement?: string | null;
  actionConfig?: CtaActionConfig | null;
};

type CtaAppearance = "card" | "pill" | "zone" | "compact";

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function handleConfiguredAction(url: string, router: ReturnType<typeof useRouter>) {
  if (url === "#refresh-data") {
    window.dispatchEvent(new Event("recalc:refresh-data"));
    return;
  }

  if (url.startsWith("/")) {
    router.push(url);
    return;
  }

  if (url.startsWith("#")) {
    const el = document.getElementById(url.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (url.startsWith("mailto:") || url.startsWith("tel:")) {
    window.location.href = url;
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

const IconLink = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
    aria-hidden="true"
  >
    <path d="M10.5 13.5 13.5 10.5" />
    <path d="M8 16a3.5 3.5 0 0 1 0-5l2-2a3.5 3.5 0 0 1 5 5l-1 1" />
    <path d="M16 8a3.5 3.5 0 0 1 0 5l-2 2a3.5 3.5 0 1 1-5-5l1-1" />
  </svg>
);

const IconSpark = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
    aria-hidden="true"
  >
    <path d="m12 3 1.8 4.4L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.6L12 3Z" />
    <path d="M5 17h4M15 17h4M12 19v2" />
  </svg>
);

const IconSearch = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4-4" />
  </svg>
);

function resolveIconKind(cta: ConfiguredCta) {
  const signature = `${cta.label} ${cta.url ?? ""}`.toLowerCase();
  if (
    signature.includes("consulta") ||
    signature.includes("curp") ||
    signature.includes("buscar")
  ) {
    return "search" as const;
  }
  if (cta.kind === "action") return "spark" as const;
  return "link" as const;
}

function itemClass(cta: ConfiguredCta, itemClassName: string) {
  const variantTone =
    cta.variant === "primary"
      ? "border-[rgba(108,181,20,0.42)] bg-[rgba(108,181,20,0.16)] text-[color:var(--ui-text-primary)] shadow-[0_12px_24px_rgba(37,63,95,0.12)]"
      : "border-[color:var(--ui-border)] bg-[color:var(--ui-surface-primary)] text-[color:var(--ui-text-primary)]";

  return [
    "group flex w-full items-center justify-between gap-2.5 rounded-[20px] border px-3.5 py-2.5 text-[13px] transition hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(120,190,33,0.3)]",
    variantTone,
    itemClassName,
  ]
    .filter(Boolean)
    .join(" ");
}

function pillClass(cta: ConfiguredCta, itemClassName: string) {
  const variantTone =
    cta.variant === "primary"
      ? "border-[rgba(108,181,20,0.42)] bg-[rgba(108,181,20,0.16)] text-[color:var(--ui-text-primary)]"
      : "border-[color:var(--ui-border)] bg-[color:var(--ui-surface-primary)] text-[color:var(--ui-text-primary)]";

  return [
    "inline-flex min-h-[30px] items-center justify-center rounded-full border px-3 py-1.5 text-xs font-bold transition hover:border-[color:var(--ui-border-strong)] hover:bg-[color:var(--ui-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(120,190,33,0.3)]",
    variantTone,
    itemClassName,
  ]
    .filter(Boolean)
    .join(" ");
}

function zoneClass(cta: ConfiguredCta, itemClassName: string) {
  const variantTone =
    cta.variant === "primary"
      ? "ui-configured-cta--primary"
      : "ui-configured-cta--neutral";

  return [
    "ui-configured-cta ui-configured-cta--zone",
    variantTone,
    itemClassName,
  ]
    .filter(Boolean)
    .join(" ");
}

function compactClass(cta: ConfiguredCta, itemClassName: string) {
  const variantTone =
    cta.variant === "primary"
      ? "ui-configured-cta--primary"
      : "ui-configured-cta--neutral";

  return [
    "ui-configured-cta ui-configured-cta--compact",
    variantTone,
    itemClassName,
  ]
    .filter(Boolean)
    .join(" ");
}

function ItemContent({
  cta,
  appearance,
}: {
  cta: ConfiguredCta;
  appearance: CtaAppearance;
}) {
  if (appearance === "pill") {
    return <span className="min-w-0 whitespace-normal break-words">{cta.label}</span>;
  }

  const iconKind = resolveIconKind(cta);
  const labelClassName =
    appearance === "zone" || appearance === "compact"
      ? "ui-configured-cta__label"
      : "min-w-0 flex-1 text-left font-semibold tracking-[-0.01em]";

  return (
    <>
      <span className="ui-configured-cta__icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-secondary)] text-[color:var(--ui-accent-blue)]">
        {iconKind === "search" ? <IconSearch className="h-4 w-4" /> : null}
        {iconKind === "spark" ? <IconSpark className="h-4 w-4" /> : null}
        {iconKind === "link" ? <IconLink className="h-4 w-4" /> : null}
      </span>
      <span className={labelClassName}>
        {cta.label}
      </span>
      <span className="ui-configured-cta__arrow text-xs text-[color:var(--ui-text-secondary)] transition group-hover:text-[color:var(--ui-text-primary)]">
        →
      </span>
    </>
  );
}

function CtaPopupModal({
  config,
  onClose,
}: {
  config: CtaActionConfig;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="ui-cta-popup-overlay fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-auto rounded-[22px] border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-primary)] p-5 text-[color:var(--ui-text-primary)] shadow-[0_24px_70px_rgba(15,41,61,0.28)] outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-extrabold tracking-[-0.02em] text-[color:var(--ui-text-primary)]">
            {config.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--ui-border)] bg-white text-lg font-bold text-[color:var(--ui-text-primary)] transition hover:bg-[color:var(--ui-hover)]"
            aria-label="Cerrar popup"
          >
            ×
          </button>
        </div>

        {config.image ? (
          <div
            data-testid="cta-popup-image-preview"
            className="ui-scrollbar mt-4 max-h-[min(70dvh,520px)] overflow-auto rounded-2xl border border-[color:var(--ui-border)] bg-white"
          >
            <Image
              src={config.image.previewUrl}
              alt=""
              width={960}
              height={960}
              unoptimized
              className="h-auto w-full object-contain"
            />
          </div>
        ) : null}

        {config.message ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[color:var(--ui-text-secondary)]">
            {config.message}
          </p>
        ) : null}

        {config.table ? (
          <div className="mt-4 overflow-auto rounded-2xl border border-[color:var(--ui-border)]">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead className="bg-[#EAF3F8] text-[#0F3C55]">
                <tr>
                  {config.table.columns.map((column) => (
                    <th key={column} className="border-b border-[color:var(--ui-border)] px-3 py-2 text-left font-extrabold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="bg-white">
                    {row.map((cell, cellIndex) => (
                      <td key={`${rowIndex}-${cellIndex}`} className="border-b border-[color:var(--ui-border)] px-3 py-2 text-[#163247]">
                        {cell || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export default function ConfiguredCtaList({
  ctas,
  className = "grid gap-3",
  itemClassName = "",
  onCtaClick,
  appearance = "card",
}: {
  ctas: ConfiguredCta[];
  className?: string;
  itemClassName?: string;
  onCtaClick?: (cta: ConfiguredCta) => void;
  appearance?: CtaAppearance;
}) {
  const router = useRouter();
  const [activePopup, setActivePopup] = useState<CtaActionConfig | null>(null);

  if (!ctas.length) return null;

  return (
    <>
      <div className={className}>
        {ctas.map((cta) => {
        let classNameForItem = itemClass(cta, itemClassName);
        if (appearance === "pill") {
          classNameForItem = pillClass(cta, itemClassName);
        }
        if (appearance === "zone") {
          classNameForItem = zoneClass(cta, itemClassName);
        }
        if (appearance === "compact") {
          classNameForItem = compactClass(cta, itemClassName);
        }

        if (cta.kind === "action" && cta.actionConfig?.type === "popup") {
          return (
            <button
              key={cta.id}
              type="button"
              onClick={() => {
                onCtaClick?.(cta);
                setActivePopup(cta.actionConfig ?? null);
              }}
              className={classNameForItem}
              aria-haspopup="dialog"
            >
              <ItemContent cta={cta} appearance={appearance} />
            </button>
          );
        }

        if (cta.kind === "link" && cta.url) {
          if (cta.url.startsWith("/") && !isExternalUrl(cta.url)) {
            return (
              <Link
                key={cta.id}
                href={cta.url}
                className={classNameForItem}
                onClick={() => onCtaClick?.(cta)}
              >
                <ItemContent cta={cta} appearance={appearance} />
              </Link>
            );
          }

          return (
            <a
              key={cta.id}
              href={cta.url}
              target={isExternalUrl(cta.url) ? "_blank" : undefined}
              rel={isExternalUrl(cta.url) ? "noreferrer" : undefined}
              className={classNameForItem}
              onClick={() => onCtaClick?.(cta)}
            >
              <ItemContent cta={cta} appearance={appearance} />
            </a>
          );
        }

        if (cta.kind === "action" && cta.url) {
          return (
            <button
              key={cta.id}
              type="button"
              onClick={() => {
                onCtaClick?.(cta);
                handleConfiguredAction(cta.url!, router);
              }}
              className={classNameForItem}
            >
              <ItemContent cta={cta} appearance={appearance} />
            </button>
          );
        }

        return (
          <div key={cta.id} className={classNameForItem}>
            <ItemContent cta={cta} appearance={appearance} />
          </div>
        );
        })}
      </div>
      {activePopup ? (
        <CtaPopupModal config={activePopup} onClose={() => setActivePopup(null)} />
      ) : null}
    </>
  );
}
