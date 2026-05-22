"use client";

import * as Popover from "@radix-ui/react-popover";
import { useMemo, useState } from "react";

type Option = { value: string; label: string; disabled?: boolean };

export default function AppMultiSelect({
  label,
  labelId,
  options,
  value,
  onValueChange,
  placeholder = "Selecciona...",
  disabled,
  error,
}: {
  label: string;
  labelId: string;
  options: Option[];
  value: string[];
  onValueChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");

  const selected = useMemo(() => {
    const set = new Set(value);
    return options.filter((o) => set.has(o.value));
  }, [options, value]);

  const display =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]!.label
        : `${selected.length} seleccionados`;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="grid gap-2">
      <div id={labelId} className="text-sm">
        {label}
      </div>

      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={[
              "ui-control ui-control--select text-left",
              error ? "ui-control--error" : "",
              selected.length === 0 ? "text-[color:var(--ui-text-secondary)]" : "",
            ].join(" ")}
            disabled={disabled}
            aria-labelledby={labelId}
          >
            <span className="min-w-0 whitespace-normal break-words">{display}</span>
            <span className="ui-select-icon" aria-hidden="true">
              {"\u25BE"}
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            sideOffset={8}
            collisionPadding={12}
            className="ui-select-content"
            align="start"
            style={{
              width: "var(--radix-popover-trigger-width)",
              maxWidth: "calc(100vw - 24px)",
            }}
          >
            <div className="p-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="ui-control"
                placeholder="Buscar..."
              />
            </div>
            <div className="ui-select-viewport">
              {filteredOptions.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className="ui-select-item"
                    data-state={checked ? "checked" : "unchecked"}
                    disabled={opt.disabled}
                    onClick={() => {
                      if (opt.disabled) return;
                      if (checked) {
                        onValueChange(value.filter((v) => v !== opt.value));
                      } else {
                        onValueChange([...value, opt.value]);
                      }
                    }}
                  >
                    <span className="min-w-0 text-left whitespace-normal break-words">
                      {opt.label}
                    </span>
                    <span className="ui-select-indicator" aria-hidden="true">
                      {checked ? "\u2713" : ""}
                    </span>
                  </button>
                );
              })}
              {!filteredOptions.length ? (
                <div className="px-3 py-2 text-sm text-[color:var(--ui-text-secondary)]">
                  Sin resultados.
                </div>
              ) : null}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.slice(0, 6).map((s) => (
              <span
                key={s.value}
                className="rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-secondary)] px-2 py-1 text-xs text-[color:var(--ui-text-primary)]"
              >
                {s.label}
              </span>
            ))}
          {selected.length > 6 ? (
            <span className="text-xs text-[color:var(--ui-text-secondary)]">+{selected.length - 6}</span>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="text-xs font-semibold text-[#B42318]">{error}</div> : null}
    </div>
  );
}
