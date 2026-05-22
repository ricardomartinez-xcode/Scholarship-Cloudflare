"use client";

import { useState } from "react";

export default function ApplyChangesButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    setState("loading");
    try {
      const res = await fetch("/api/admin/revalidate", { method: "POST" });
      if (!res.ok) throw new Error("fetch failed");
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const label =
    state === "loading"
      ? "Aplicando…"
      : state === "done"
        ? "✓ Aplicado"
        : state === "error"
          ? "Error"
          : "Aplicar cambios";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "loading"}
      className="ui-cta-primary min-h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(17,78,109,0.28)] disabled:opacity-60"
    >
      {label}
    </button>
  );
}
