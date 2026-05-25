"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useId, type ReactNode } from "react";

type AdminDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  kicker?: string;
  size?: "md" | "lg" | "xl";
  children: ReactNode;
};

const sizeClassName: Record<NonNullable<AdminDialogShellProps["size"]>, string> = {
  md: "max-w-xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

export default function AdminDialogShell({
  open,
  onOpenChange,
  title,
  description,
  kicker,
  size = "lg",
  children,
}: AdminDialogShellProps) {
  const descriptionId = useId();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={descriptionId}
          className={[
            "fixed left-1/2 top-1/2 z-50 flex w-[94vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(11,61,92,0.98),rgba(13,45,86,1))] p-4 shadow-2xl outline-none sm:p-5",
            "max-h-[calc(100dvh-1.5rem)]",
            sizeClassName[size],
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {kicker ? (
                <div className="ui-kicker">
                  {kicker}
                </div>
              ) : null}
              <Dialog.Title className="mt-1 text-xl font-semibold tracking-[-0.02em] text-slate-100">
                {title}
              </Dialog.Title>
              <Dialog.Description
                id={descriptionId}
                className="mt-1 max-w-3xl text-sm text-slate-400"
              >
                {description}
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-slate-100 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                aria-label="Cerrar"
              >
                ×
              </button>
            </Dialog.Close>
          </div>

          <div className="ui-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto pr-1 sm:mt-6">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
