"use client";

import * as Popover from "@radix-ui/react-popover";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

type Option = { value: string; label: string; disabled?: boolean; keywords?: string };

const MAX_VISIBLE = 8;
const ITEM_HEIGHT = 44;

export default function SmartMultiSelect({
  label,
  labelId,
  options,
  value,
  onChange,
  placeholder = "Selecciona...",
  disabled,
  error,
  searchEnabled,
}: {
  label: string;
  labelId: string;
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  searchEnabled?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const shouldSearch = searchEnabled ?? options.length > 10;

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
    if (!q || !shouldSearch) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.keywords ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query, shouldSearch]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      return;
    }
    setActiveIndex(0);
    window.requestAnimationFrame(() => {
      if (shouldSearch) {
        inputRef.current?.focus();
      } else {
        const active = listRef.current?.querySelector(
          `[data-index="0"]`
        ) as HTMLElement | null;
        active?.focus();
      }
    });
  };

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector(
      `[data-index="${activeIndex}"]`
    ) as HTMLElement | null;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function toggleOption(opt: Option) {
    if (opt.disabled) return;
    if (value.includes(opt.value)) {
      onChange(value.filter((v) => v !== opt.value));
    } else {
      onChange([...value, opt.value]);
    }
  }

  function moveActive(delta: number) {
    setActiveIndex((current) => {
      if (!filteredOptions.length) return 0;
      const next = Math.min(
        Math.max(current + delta, 0),
        filteredOptions.length - 1
      );
      return next;
    });
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const opt = filteredOptions[activeIndex];
      if (opt) toggleOption(opt);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleOpenChange(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div id={labelId} className="text-sm">
        {label}
      </div>

      <Popover.Root open={open} onOpenChange={handleOpenChange}>
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
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={listId}
          >
            <span className="truncate">{display}</span>
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
            onKeyDown={onKeyDown}
            style={{
              width: "var(--radix-popover-trigger-width)",
              maxWidth: "calc(100vw - 24px)",
            }}
          >
            {shouldSearch ? (
              <div className="ui-select-search">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  className="ui-control"
                  placeholder="Buscar..."
                />
              </div>
            ) : null}
            <div
              id={listId}
              ref={listRef}
              role="listbox"
              aria-multiselectable="true"
              className="ui-select-viewport ui-scrollbar"
              style={{ maxHeight: ITEM_HEIGHT * MAX_VISIBLE }}
            >
              {filteredOptions.map((opt, index) => {
                const checked = value.includes(opt.value);
                const isActive = index === activeIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    data-index={index}
                    data-state={checked ? "checked" : "unchecked"}
                    data-active={isActive ? "true" : "false"}
                    disabled={opt.disabled}
                    className="ui-select-item"
                    onClick={() => toggleOption(opt)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span className="truncate">{opt.label}</span>
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
            <span className="text-xs text-[color:var(--ui-text-secondary)]">
              +{selected.length - 6}
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="text-xs text-red-200">{error}</div> : null}
    </div>
  );
}
