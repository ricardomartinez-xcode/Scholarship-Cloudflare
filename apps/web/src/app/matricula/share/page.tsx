import type { Metadata } from "next";

import MatriculaShareForm from "@/components/matricula/MatriculaShareForm";

export const metadata: Metadata = {
  title: "Compartir matrícula | Scholarship",
  description: "Comparte una matrícula desde Scholarship hacia la integración configurada.",
};

export default function MatriculaSharePage() {
  return (
    <main className="min-h-screen bg-[color:var(--ui-bg)] px-4 py-10 text-[color:var(--ui-text-primary)]">
      <section className="mx-auto grid w-full max-w-3xl gap-6">
        <div className="rounded-[28px] border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-primary)] p-6 shadow-[0_22px_80px_rgba(15,41,61,0.12)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--ui-text-secondary)]">
            Integración
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[color:var(--ui-text-primary)]">
            Compartir matrícula
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--ui-text-secondary)]">
            Captura la matrícula y los datos mínimos del alumno. Scholarship enviará la información al servicio
            configurado mediante el SDK interno, sin exponer tokens en el navegador.
          </p>
        </div>

        <MatriculaShareForm />
      </section>
    </main>
  );
}
