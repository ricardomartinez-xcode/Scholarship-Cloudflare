"use client";

import { useRef, type KeyboardEvent } from "react";

type AdminSegmentedTabItem = {
  id: string;
  label: string;
};

export default function AdminSegmentedTabs({
  ariaLabel,
  items,
  activeId,
  onChange,
  tone = "dark",
}: {
  ariaLabel: string;
  items: AdminSegmentedTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  tone?: "dark" | "light";
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function moveToTab(index: number) {
    const item = items[index];
    if (!item) return;

    onChange(item.id);
    window.requestAnimationFrame(() => {
      tabRefs.current[index]?.focus();
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!items.length) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveToTab((index + 1) % items.length);
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveToTab((index - 1 + items.length) % items.length);
    }

    if (event.key === "Home") {
      event.preventDefault();
      moveToTab(0);
    }

    if (event.key === "End") {
      event.preventDefault();
      moveToTab(items.length - 1);
    }
  }

  return (
    <div
      className={[
        "flex flex-wrap gap-2 border-b pb-2",
        tone === "light" ? "border-[color:var(--ui-border)]" : "border-white/10",
      ].join(" ")}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item, index) => {
        const selected = activeId === item.id;
        return (
          <button
            key={item.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={[
              "rounded-t-xl border px-4 py-2 text-sm font-semibold transition",
              selected
                ? tone === "light"
                  ? "border-[color:var(--ui-border)] bg-[color:var(--ui-surface-secondary)] text-[color:var(--ui-text-primary)]"
                  : "border-white/10 bg-slate-950/30 text-slate-100"
                : tone === "light"
                  ? "border-transparent text-[color:var(--ui-text-secondary)] hover:text-[color:var(--ui-text-primary)]"
                  : "border-transparent text-slate-400 hover:text-slate-200",
            ].join(" ")}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
