"use client";

import * as Select from "@radix-ui/react-select";
import { useEffect, useId, useState } from "react";

type Option = { value: string; label: string; disabled?: boolean };

export default function AppSelect({
  labelId,
  value,
  placeholder,
  disabled,
  error,
  options,
  onValueChange,
}: {
  labelId: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  error?: boolean;
  options: Option[];
  onValueChange: (value: string) => void;
}) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  const selectId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Radix Select doesn't always move focus into the list when opened via pointer.
    // We explicitly focus the checked item (or the first item) to guarantee ArrowUp/ArrowDown work.
    const raf = window.requestAnimationFrame(() => {
      const content = document.querySelector(
        `[data-app-select-id="${selectId}"]`
      ) as HTMLElement | null;
      const checked =
        (content?.querySelector('[data-state="checked"]') as HTMLElement | null) ??
        (content?.querySelector('[role="option"]') as HTMLElement | null);
      checked?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, selectId]);

  return (
    <Select.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
    >
      <Select.Trigger
        aria-labelledby={labelId}
        className={[
          "ui-control ui-control--select",
          error ? "ui-control--error" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={selectedLabel ? "" : "text-[color:var(--ui-text-secondary)]"}>
          {selectedLabel || placeholder}
        </span>
        <Select.Icon className="ui-select-icon" aria-hidden="true">
          {"\u25BE"}
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={8}
          collisionPadding={12}
          className="ui-select-content"
          data-app-select-id={selectId}
          style={{ maxWidth: "calc(100vw - 24px)" }}
        >
          <Select.Viewport className="ui-select-viewport">
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="ui-select-item"
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator className="ui-select-indicator">
                  {"\u2713"}
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
