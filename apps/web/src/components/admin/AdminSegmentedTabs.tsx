"use client";

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
  return (
    <div
      className={[
        "flex flex-wrap gap-2 border-b pb-2",
        tone === "light" ? "border-[color:var(--ui-border)]" : "border-white/10",
      ].join(" ")}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const selected = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
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
