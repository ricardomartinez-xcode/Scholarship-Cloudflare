"use client";

import { useMemo, useState } from "react";

type ShareState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string; credentialUrl?: string }
  | { status: "error"; message: string };

type ShareResponse = {
  ok?: boolean;
  shareId?: string;
  status?: string;
  message?: string;
  credentialUrl?: string;
  error?: string;
};

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalValue(value: string) {
  return value || undefined;
}

export default function MatriculaShareForm() {
  const [state, setState] = useState<ShareState>({ status: "idle" });

  const disabled = state.status === "loading";
  const helperCopy = useMemo(() => {
    if (state.status === "success") return state.message;
    if (state.status === "error") return state.message;
    return "El envío se procesa desde el backend de Scholarship para mantener segura la autenticación.";
  }, [state]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const matricula = formValue(formData, "matricula");

    if (!matricula) {
      setState({ status: "error", message: "Captura una matrícula antes de compartir." });
      return;
    }

    setState({ status: "loading" });

    try {
      const sourceRecordId = optionalValue(formValue(formData, "sourceRecordId"));
      const response = await fetch("/api/integrations/matricula/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula,
          student: {
            fullName: optionalValue(formValue(formData, "fullName")),
            email: optionalValue(formValue(formData, "email")),
            phone: optionalValue(formValue(formData, "phone")),
            externalId: sourceRecordId,
          },
          academic: {
            campus: optionalValue(formValue(formData, "campus")),
            region: optionalValue(formValue(formData, "region")),
            program: optionalValue(formValue(formData, "program")),
            modality: optionalValue(formValue(formData, "modality")),
            module: optionalValue(formValue(formData, "module")),
            cycle: optionalValue(formValue(formData, "cycle")),
          },
          scholarship: {
            enrollmentType: optionalValue(formValue(formData, "enrollmentType")),
            average: Number(formValue(formData, "average")) || undefined,
            scholarshipPercent: Number(formValue(formData, "scholarshipPercent")) || undefined,
          },
          metadata: {
            sourceRecordId,
            submittedFrom: "matricula-share-cta",
          },
        }),
      });

      const result = (await response.json().catch(() => ({}))) as ShareResponse;

      if (!response.ok || result.ok === false) {
        throw new Error(result.error ?? result.message ?? "No se pudo compartir la matrícula.");
      }

      const detail = result.shareId ? ` Folio: ${result.shareId}.` : "";
      setState({
        status: "success",
        message: result.message ?? `Matrícula compartida correctamente.${detail}`,
        credentialUrl: result.credentialUrl,
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "No fue posible compartir la matrícula.",
      });
    }
  }

  const inputClass = "rounded-2xl border border-[color:var(--ui-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[color:var(--ui-accent-blue)] focus:ring-2 focus:ring-sky-500/15";

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-5 rounded-[28px] border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-primary)] p-6 shadow-[0_18px_60px_rgba(15,41,61,0.10)]"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
          Matrícula
          <input name="matricula" required placeholder="Ej. A01234567" className={inputClass} />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Nombre completo
          <input name="fullName" placeholder="Nombre del alumno" className={inputClass} />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Email
          <input name="email" type="email" placeholder="alumno@correo.com" className={inputClass} />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Teléfono
          <input name="phone" placeholder="Opcional" className={inputClass} />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          ID externo / lead
          <input name="sourceRecordId" placeholder="Opcional" className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          Campus
          <input name="campus" placeholder="Ej. Tijuana" className={inputClass} />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Región
          <input name="region" placeholder="Ej. Noroeste" className={inputClass} />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Programa
          <input name="program" placeholder="Ej. Licenciatura" className={inputClass} />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Modalidad
          <input name="modality" placeholder="Presencial, online, mixta" className={inputClass} />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Módulo
          <input name="module" placeholder="Ej. M1" className={inputClass} />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Ciclo
          <input name="cycle" placeholder="Ej. C1" className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold">
          Tipo de ingreso
          <input name="enrollmentType" placeholder="nuevo_ingreso" className={inputClass} />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Promedio
          <input name="average" type="number" min="0" max="10" step="0.01" placeholder="9.2" className={inputClass} />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Beca %
          <input name="scholarshipPercent" type="number" min="0" max="100" step="0.01" placeholder="40" className={inputClass} />
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-secondary)] px-4 py-3 text-sm text-[color:var(--ui-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
        <span className={state.status === "error" ? "font-semibold text-red-700" : state.status === "success" ? "font-semibold text-emerald-700" : undefined}>
          {helperCopy}
        </span>
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--ui-text-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {disabled ? "Compartiendo..." : "Compartir matrícula"}
        </button>
      </div>

      {state.status === "success" && state.credentialUrl ? (
        <a
          href={state.credentialUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--ui-border)] bg-white px-5 py-2.5 text-sm font-bold text-[color:var(--ui-text-primary)] transition hover:bg-[color:var(--ui-hover)]"
        >
          Abrir credencial UNIDEP
        </a>
      ) : null}
    </form>
  );
}
