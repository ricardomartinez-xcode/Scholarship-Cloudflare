"use client";

import * as Popover from "@radix-ui/react-popover";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

type Option = { value: string; label: string; keywords?: string };

const MAX_VISIBLE = 8;
const ITEM_HEIGHT = 44;

export default function SmartSelect({
  labelId,
  value,
  placeholder,
  disabled,
  error,
  options,
  searchEnabled,
  onChange,
}: {
  labelId?: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  error?: boolean;
  options: Option[];
  searchEnabled?: boolean;
  onChange: (value: string) => void;
}) {
  const selectId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const shouldSearch = searchEnabled ?? options.length > 10;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !shouldSearch) return options;
    return options.filter((opt) => {
      const hay = `${opt.label} ${opt.keywords ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query, shouldSearch]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const focusActiveOption = (index: number) => {
    window.requestAnimationFrame(() => {
      if (shouldSearch) {
        inputRef.current?.focus();
        return;
      }

      const active = listRef.current?.querySelector(
        `[data-index="${index}"]`
      ) as HTMLElement | null;
      active?.focus();
    });
  };

  const openAtIndex = (index: number) => {
    setOpen(true);
    setActiveIndex(index);
    focusActiveOption(index);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setOpen(false);
      setQuery("");
      return;
    }

    const idx = filteredOptions.findIndex((o) => o.value === value);
    openAtIndex(idx >= 0 ? idx : 0);
  };

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector(
      `[data-index="${activeIndex}"]`
    ) as HTMLElement | null;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function selectOption(opt: Option) {
    onChange(opt.value);
    handleOpenChange(false);
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
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(filteredOptions.length - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const opt = filteredOptions[activeIndex];
      if (opt) selectOption(opt);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleOpenChange(false);
    }
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (open) return;

    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenChange(true);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      openAtIndex(Math.max(filteredOptions.length - 1, 0));
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
            className={[
              "ui-control ui-control--select text-left",
              error ? "ui-control--error" : "",
              !selectedLabel ? "text-[color:var(--ui-text-secondary)]" : "",
            ].join(" ")}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-labelledby={labelId}
          aria-controls={selectId}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="min-w-0 whitespace-normal break-words">
            {selectedLabel || placeholder}
          </span>
          <span className="ui-select-icon" aria-hidden="true">
            {"\u25BE"}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          avoidCollisions
          sideOffset={8}
          collisionPadding={12}
          className="ui-select-content"
          align="start"
          sticky="always"
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
            id={selectId}
            ref={listRef}
            role="listbox"
            className="ui-select-viewport ui-scrollbar"
            style={{ maxHeight: ITEM_HEIGHT * MAX_VISIBLE }}
          >
            {filteredOptions.map((opt, index) => {
              const checked = opt.value === value;
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
                  className="ui-select-item"
                  onClick={() => selectOption(opt)}
                  onMouseEnter={() => setActiveIndex(index)}
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
  );
}
