"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export type AdminActionResult = { ok: boolean; error?: string };

type ActionWithFormData = (formData: FormData) => Promise<AdminActionResult>;

export function useAdminActionForm(
  action: ActionWithFormData,
  fallbackMessage: string
) {
  const [saveState, setSaveState] = useState<AdminActionResult | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const result = await action(new FormData(event.currentTarget));
      setSaveState(result);
    } catch (error) {
      const digest =
        typeof error === "object" && error !== null && "digest" in error
          ? String((error as { digest?: string }).digest ?? "")
          : "";
      if (digest.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
      setSaveState({ ok: false, error: fallbackMessage });
    } finally {
      setSaving(false);
    }
  }

  return {
    handleSubmit,
    saveState,
    saving,
    clearSaveState: () => setSaveState(null),
  };
}
