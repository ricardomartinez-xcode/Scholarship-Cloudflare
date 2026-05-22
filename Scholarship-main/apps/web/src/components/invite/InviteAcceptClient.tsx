"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function InviteAcceptClient({
  token,
  successHref = "/unidep?welcome=1&newUser=1",
}: {
  token: string;
  successHref?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function acceptInvite() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        code?: string;
        alreadyUsed?: boolean;
      };
      if (!response.ok || !payload.ok) {
        if (payload.code === "INVITE_ALREADY_USED") {
          router.replace(successHref);
          router.refresh();
          return;
        }
        setError(payload.error ?? "No fue posible aceptar la invitación.");
        return;
      }
      router.replace(successHref);
      router.refresh();
    } catch {
      setError("No fue posible aceptar la invitación.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <div className="font-semibold">No se pudo aceptar</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}
      <button
        type="button"
        disabled={submitting}
        onClick={() => void acceptInvite()}
        className="w-full rounded-2xl bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {submitting ? "Aceptando..." : "Aceptar invitación"}
      </button>
    </div>
  );
}
